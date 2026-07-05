import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { CreateSessionSetCommand, UpdateSessionSetCommand } from '@txg/shared';
import { concatMap, filter, map, switchMap } from 'rxjs/operators';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '@shared/ui/dialogs/confirmation-dialog/confirmation-dialog.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { tapIf } from '@shared/utils/operators/tap-if.operator';
import { selectCurrentSet } from '../../models/session-page.selectors';
import { SessionPageViewModel, SessionSetViewModel } from '../../models/session-page.viewmodel';
import { SessionNotificationAction, SessionNotificationService } from '../../shared/session-notification.service';
import { AddEditSetDialogComponent, AddEditSetDialogData, AddEditSetDialogCloseResult, DeleteSetResult } from './components/dialogs/add-edit-set-dialog/add-edit-set-dialog.component';
import { SessionExerciseListComponent } from './components/session-exercise-list/session-exercise-list.component';
import { SessionHeaderComponent } from './components/session-header/session-header.component';
import { SessionTimerComponent } from './components/session-timer/session-timer.component';
import { SessionPageFacade } from './session-page.facade';
@Component({
  selector: 'txg-session-page',
  standalone: true,
  imports: [
    CommonModule,
    MainLayoutComponent,
    SessionHeaderComponent,
    SessionExerciseListComponent,
    SessionTimerComponent,
    NoticeComponent
  ],
  templateUrl: './session-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionPageComponent implements OnDestroy {
  private destroyRef = inject(DestroyRef);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private facade = inject(SessionPageFacade);
  private route = inject(ActivatedRoute);
  private notificationService = inject(SessionNotificationService);

  readonly viewModel = this.facade.viewModel;
  readonly timerResetTrigger = this.facade.timerResetTrigger;

  // A notification action captured on cold start, applied once the session loads.
  private readonly pendingAction = signal<SessionNotificationAction | null>(null);

  // Serializes async notification updates so a later state always wins over an
  // earlier one (concatMap waits for each show/clear to finish before the next).
  private readonly notificationSync$ = new Subject<SessionPageViewModel>();

  readonly isLoadingSignal = computed(() => this.viewModel().isLoading);

  readonly isReadOnly = computed(() => {
    const status = this.viewModel().metadata?.status;
    return status === 'COMPLETED' || status === 'CANCELLED';
  });

  readonly allExercisesComplete = computed(() => {
    const exercises = this.viewModel().exercises;
    if (!exercises || exercises.length === 0) return true;
    return exercises.every(exercise => {
      if (!exercise.sets || exercise.sets.length === 0) return true;
      return exercise.sets.every(set => set.status === 'COMPLETED' || set.status === 'FAILED');
    });
  });

  get title(): string {
    if (this.viewModel().isLoading) return 'Loading Session...';
    return this.viewModel().metadata?.status === 'COMPLETED' ? 'Completed Session' : 'Active Session';
  }

  get navigation(): string {
    return this.viewModel().metadata?.status === 'COMPLETED' ? '/history' : '/home';
  }

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const sessionIdFromRoute = params.get('sessionId');
        this.facade.loadSessionData(sessionIdFromRoute);
      });

    effect(() => {
      const error = this.viewModel().error;
      if (error) {
        this.snackBar.open(error, 'Close', { duration: 5000 });
      }
    });

    // Keep the ongoing OS notification in sync with the current set. The async
    // updates run through a serialized stream to avoid overlapping show/clear.
    this.notificationSync$
      .pipe(
        concatMap(viewModel => this.syncNotification(viewModel)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    effect(() => {
      const viewModel = this.viewModel();
      this.notificationSync$.next(viewModel);
    });

    // Quick actions while the app is in the foreground (warm path).
    this.notificationService.actions$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(action => this.handleNotificationAction(action));

    // Quick actions after a cold start: the tapped action arrives as a query
    // param; capture it and strip it so a refresh cannot replay it.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const action = params.get('action');
        if (action !== 'complete-set' && action !== 'reset-timer') return;

        this.pendingAction.set(action);
        this.router.navigate([], { relativeTo: this.route, queryParams: { action: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });

    // Apply a captured cold-start action once the session has finished loading.
    effect(() => {
      const viewModel = this.viewModel();
      const action = this.pendingAction();
      if (!action || viewModel.isLoading || !viewModel.id) return;

      untracked(() => {
        this.pendingAction.set(null);
        this.handleNotificationAction(action);
      });
    });
  }

  onSetClicked(event: { set: SessionSetViewModel; exerciseId: string }): void {
    if (this.isReadOnly()) return;

    const session = this.viewModel();
    const exerciseId = event.exerciseId;
    const setToUpdateTo = { ...event.set };

    const exercise = session.exercises.find(ex => ex.planExerciseId === exerciseId)!;
    const setInSignal = exercise.sets.find(s => s.id === setToUpdateTo.id)!;
    const originalSetStateForRevert = { ...setInSignal };

    this.facade.triggerTimerReset(setToUpdateTo.status);
    this.facade.enqueueSetPatch(setToUpdateTo, exerciseId, originalSetStateForRevert);
    this.requestNotificationPermission();
  }

  onSetLongPressed(event: { set: SessionSetViewModel; exerciseId: string }): void {
    if (this.isReadOnly()) return;

    const session = this.viewModel()!;
    const exerciseId = event.exerciseId;
    const setToEdit = event.set;

    const exercise = session.exercises.find(ex => ex.planExerciseId === exerciseId)!;
    const maxPlannedSetIndex = exercise.plannedSetsCount > 0 ? exercise.plannedSetsCount : -1;

    const dialogData: AddEditSetDialogData = {
      mode: 'edit',
      setToEditDetails: setToEdit,
      planExerciseId: exerciseId,
      maxPlannedSetIndex: maxPlannedSetIndex
    };

    this.dialog
      .open(AddEditSetDialogComponent, { width: '400px', data: dialogData, disableClose: true })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((result): result is UpdateSessionSetCommand | DeleteSetResult => this.isUpdateCommand(result) || this.isDeleteSetResult(result)),
        switchMap(result => {
          if (this.isUpdateCommand(result)) {
            const updateCommand = result;
            return this.facade.updateSet(setToEdit.id, exerciseId, updateCommand).pipe(
              tapIf(success => !!success, () => this.showSnackbar('Set details updated successfully.', 2000)),
              tapIf(success => !success && !session.error, () => this.showSnackbar('Failed to update set details. Please try again.')),
            );
          } else if (this.isDeleteSetResult(result)) {
            const deletePayload = result;
            return this.facade.deleteSet(deletePayload.setId, exerciseId).pipe(
              tapIf(success => !!success, () => this.showSnackbar('Set deleted successfully.', 2000)),
              tapIf(success => !success && !session.error, () => this.showSnackbar('Failed to delete set. Please try again.'))
            );
          }
          return of(null);
        })
      )
      .subscribe();
  }

  onSetAdded(planExerciseId: string): void {
    if (this.isReadOnly()) return;

    const session = this.viewModel()!;
    const exercise = session.exercises.find(ex => ex.planExerciseId === planExerciseId)!;
    const setIndexForNewSet = exercise.sets.length + 1;
    const lastSetForPreFill = exercise.sets.length > 0 ? exercise.sets[exercise.sets.length - 1] : undefined;

    const dialogData: AddEditSetDialogData = {
      mode: 'add',
      sessionId: session.id!,
      planExerciseId: planExerciseId,
      setIndexForNewSet: setIndexForNewSet,
      lastSetForPreFill: lastSetForPreFill,
    };

    this.dialog
      .open(AddEditSetDialogComponent, { width: '400px', data: dialogData, disableClose: true })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((result): result is CreateSessionSetCommand => this.isCreateCommand(result)),
        switchMap(command => {
          return this.facade.addSet(command, planExerciseId).pipe(
            tapIf(success => !!success, () => this.showSnackbar('Set added successfully.', 2000)),
            tapIf(success => !success && !session.error, () => this.showSnackbar('Failed to add set. Please try again.'))
          );
        })
      )
      .subscribe();
  }

  onSessionCompleted(): void {
    if (this.isReadOnly()) return;

    let confirmation$: Observable<boolean>;
    if (this.allExercisesComplete()) {
      confirmation$ = of(true);
    } else {
      const dialogData: ConfirmationDialogData = {
        title: 'Complete Session',
        message: 'Not all sets have been marked as completed or failed. Are you sure you want to complete this session now?',
        confirmButtonText: 'Complete',
        cancelButtonText: 'Cancel'
      };

      confirmation$ = this.dialog
        .open(ConfirmationDialogComponent, { width: '400px', data: dialogData })
        .afterClosed().pipe(map(result => !!result));
    }

    confirmation$.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(b => b),
      switchMap(() => this.facade.completeSession().pipe(takeUntilDestroyed(this.destroyRef)))
    ).subscribe(success => {
      if (success) {
        this.router.navigate(['/home']);
        this.showSnackbar('Session completed. See you soon!', 5000);
      } else if (!this.viewModel().error) {
        this.showSnackbar('Failed to complete session. Please try again.', 5000);
      }
    });
  }

  ngOnDestroy(): void {
    this.facade.flushPendingSetUpdate();
    this.facade.triggerTimerReset();
    void this.notificationService.clear();
  }

  private requestNotificationPermission(): void {
    void this.notificationService.requestPermission().then(permission => {
      if (permission === 'granted') {
        void this.notificationService.subscribeToPush();
        this.notificationSync$.next(this.viewModel());
      }
    });
  }

  private async syncNotification(viewModel: SessionPageViewModel): Promise<void> {
    try {
      const status = viewModel.metadata?.status;
      const isActive = !!viewModel.id && status !== 'COMPLETED' && status !== 'CANCELLED';
      const current = isActive ? selectCurrentSet(viewModel) : null;

      if (!current) {
        await this.notificationService.clear();
        return;
      }

      await this.notificationService.show({
        sessionId: viewModel.id!,
        title: viewModel.metadata?.dayName || viewModel.metadata?.planName || 'Active workout',
        exerciseName: current.exercise.exerciseName,
        reps: current.set.expectedReps,
        weight: current.set.weight,
      });
    } catch {
      // Notifications are best-effort; keep the sync stream alive on failure.
    }
  }

  private handleNotificationAction(action: SessionNotificationAction): void {
    if (this.isReadOnly()) return;

    if (action === 'reset-timer') {
      this.facade.triggerTimerReset();
      return;
    }

    const current = selectCurrentSet(this.viewModel());
    if (!current) return;

    const completedSet: SessionSetViewModel = {
      ...current.set,
      status: 'COMPLETED',
      actualReps: current.set.expectedReps,
    };

    this.facade.triggerTimerReset('COMPLETED');
    this.facade.enqueueSetPatch(completedSet, current.exercise.planExerciseId, { ...current.set });
  }

  private showSnackbar(message: string, duration: number = 3000): void {
    this.snackBar.open(message, 'Close', { duration });
  }

  private isCreateCommand(result: AddEditSetDialogCloseResult | undefined): result is CreateSessionSetCommand {
    return !!result && typeof result === 'object' && 'session_id' in result;
  }

  private isUpdateCommand(result: AddEditSetDialogCloseResult | undefined): result is UpdateSessionSetCommand {
    return !!result && typeof result === 'object' && !('session_id' in result) && !('action' in result && (result as DeleteSetResult).action === 'delete');
  }

  private isDeleteSetResult(result: AddEditSetDialogCloseResult | undefined): result is DeleteSetResult {
    return !!result && typeof result === 'object' && 'action' in result && result.action === 'delete';
  }
}
