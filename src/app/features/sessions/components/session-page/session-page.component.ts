import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, filter, switchMap, debounceTime, map, tap, finalize } from 'rxjs/operators';
import { Observable, of, Subject, forkJoin } from 'rxjs';
import { CreateSessionSetCommand, SessionSetDto, UpdateSessionSetCommand, TrainingSessionDto, ExerciseDto, TrainingPlanDto } from '@shared/api/api.types';
import { ExerciseService } from '@shared/services/exercise.service';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '@shared/ui/dialogs/confirmation-dialog/confirmation-dialog.component';
import { FullScreenLayoutComponent } from '@shared/ui/layouts/full-screen-layout/full-screen-layout.component';
import { AddEditSetDialogComponent, AddEditSetDialogData, AddEditSetDialogCloseResult, DeleteSetResult } from './dialogs/add-edit-set-dialog/add-edit-set-dialog.component';
import { SessionExerciseListComponent } from './session-exercise-list/session-exercise-list.component';
import { SessionHeaderComponent } from './session-header/session-header.component';
import { SessionTimerComponent } from './session-timer/session-timer.component';
import { PlanService } from '../../../plans/services/plan.service';
import { mapDtosToSessionDetailsViewModel, SessionDetailsViewModel, SessionExerciseViewModel, SessionSetStatus, SessionSetViewModel, SessionStatus } from '../../models/session-view.models';
import { SessionService, SessionServiceResponse } from '../../services/session.service';

@Component({
  selector: 'txg-session-page',
  standalone: true,
  imports: [
    CommonModule,
    FullScreenLayoutComponent,
    SessionHeaderComponent,
    SessionExerciseListComponent,
    SessionTimerComponent
  ],
  templateUrl: './session-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private exerciseService = inject(ExerciseService);
  private planService = inject(PlanService);
  private sessionService = inject(SessionService);

  readonly errorSignal = signal<string | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly session = signal<SessionDetailsViewModel | null>(null);
  readonly sessionIdSignal = signal<string | null>(null);
  readonly timerResetTrigger: WritableSignal<number | null> = signal(null);
  readonly updatingSetId = signal<string | null>(null);

  readonly exercises = computed<SessionExerciseViewModel[]>(() => {
    return this.session()?.exercises ?? [];
  });

  readonly allExercisesAndSetsComplete = computed<boolean>(() => {
    const exercises = this.exercises();
    if (!exercises || exercises.length === 0) {
      return true;
    }
    return exercises.every(exercise => {
      if (!exercise.sets || exercise.sets.length === 0) {
        return true;
      }
      return exercise.sets.every(set => set.status === 'COMPLETED' || set.status === 'FAILED');
    });
  });

  readonly isReadOnly = computed<boolean>(() => {
    const status = this.session()?.metadata?.status;
    return status === 'COMPLETED' || status === 'CANCELLED';
  });

  private setUpdateApiCallSubject = new Subject<{
    setPayload: SessionSetViewModel;
    exerciseId: string;
    currentSessionId: string;
    originalSetSnapshotForRevert: SessionSetViewModel;
  }>();

  private latestSetUpdateDataForDebounce: {
    setPayload: SessionSetViewModel;
    exerciseId: string;
    currentSessionId: string;
    originalSetSnapshotForRevert: SessionSetViewModel;
  } | null = null;

  constructor() {
    effect(() => {
      const currentSessionId = this.sessionIdSignal();
      if (currentSessionId) {
        this.loadSessionData(currentSessionId);
      } else {
        this.isLoading.set(false);
        this.session.set(null);
        this.errorSignal.set(null);
      }
    });

    this.setUpdateApiCallSubject.pipe(
      tap(data => this.latestSetUpdateDataForDebounce = data),
      debounceTime(1000),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(debouncedData => {
      this.handleDebouncedSetUpdate(debouncedData);
    });
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.sessionIdSignal.set(params.get('sessionId'));
      });
  }

  handleSetClicked(event: { set: SessionSetViewModel; exerciseId: string }): void {
    if (this.isReadOnly()) return;

    const newClickedSetId = event.set.id;
    this.flushPendingSetUpdate(newClickedSetId);

    const setToUpdateTo = { ...event.set };
    const exerciseId = event.exerciseId;
    const setId = setToUpdateTo.id;

    this.errorSignal.set(null);

    const currentSessionId = this.sessionIdSignal();
    if (!currentSessionId) {
      this.snackBar.open('Session ID is missing. Cannot update set.', 'Close', { duration: 3000 });
      return;
    }

    let originalSetStateForRevert: SessionSetViewModel | undefined;
    const currentGlobalTrainingSession = this.session();
    if (currentGlobalTrainingSession) {
      const exercise = currentGlobalTrainingSession.exercises.find(ex => ex.trainingPlanExerciseId === exerciseId);
      if (exercise) {
        const setInSignal = exercise.sets.find(s => s.id === setId);
        if (setInSignal) {
          originalSetStateForRevert = { ...setInSignal };
        }
      }
    }

    if (!originalSetStateForRevert) {
      this.snackBar.open('Internal error: Set state inconsistent. Cannot update set.', 'Close', { duration: 3000 });
      return;
    }

    this.timerResetTrigger.set(Date.now());
    this.updateLocalSessionDataWithViewModel(setToUpdateTo, exerciseId);

    this.setUpdateApiCallSubject.next({
      setPayload: setToUpdateTo,
      exerciseId: exerciseId,
      currentSessionId: currentSessionId,
      originalSetSnapshotForRevert: originalSetStateForRevert
    });
  }

  handleSetLongPressed(event: { set: SessionSetViewModel; exerciseId: string }): void {
    if (this.isReadOnly() || this.updatingSetId()) return;

    const currentSessionId = this.sessionIdSignal();
    if (!currentSessionId) {
      this.snackBar.open('Session ID is missing. Cannot edit set.', 'Close', { duration: 3000 });
      return;
    }

    const setToEdit = event.set;
    const exerciseId = event.exerciseId;

    const currentTrainingSession = this.session();
    const exerciseViewModel = currentTrainingSession?.exercises.find(ex => ex.trainingPlanExerciseId === exerciseId);

    if (!exerciseViewModel) {
        this.snackBar.open('Exercise data not found for this set. Cannot determine delete eligibility.', 'Close', { duration: 3000 });
        return;
    }

    const maxPlannedSetIndex = exerciseViewModel.plannedSetsCount > 0 ? exerciseViewModel.plannedSetsCount : -1;

    const dialogData: AddEditSetDialogData = {
      mode: 'edit',
      setToEditDetails: setToEdit,
      trainingPlanExerciseId: exerciseId,
      maxPlannedSetIndex: maxPlannedSetIndex
    };

    const dialogRef: MatDialogRef<AddEditSetDialogComponent, AddEditSetDialogCloseResult> = this.dialog.open(
      AddEditSetDialogComponent,
      {
        width: '400px',
        data: dialogData,
        disableClose: true,
      }
    );

    dialogRef.afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((result): result is UpdateSessionSetCommand | DeleteSetResult => this.isUpdateCommand(result) || this.isDeleteSetResult(result)))
      .subscribe((result) => {
        if (this.isUpdateCommand(result)) {
          const command = result;
          this.updatingSetId.set(setToEdit.id);
          this.errorSignal.set(null);
          this.sessionService.updateSet(currentSessionId, setToEdit.id, command)
            .pipe(catchError(err => this.handleApiError(err, 'Failed to update details for set', setToEdit.id, this.updatingSetId)))
            .subscribe((response: SessionServiceResponse<SessionSetDto | null> | null) => {
              const updatedSetDto = response?.data;
              if (updatedSetDto) {
                this.updateLocalSessionDataWithViewModel(this.mapSetDtoToViewModel(updatedSetDto), event.exerciseId);
              }
              this.updatingSetId.set(null);
            });
        } else if (this.isDeleteSetResult(result)) {
          const deletePayload = result;
          this.updatingSetId.set(deletePayload.setId);
          this.errorSignal.set(null);

          this.sessionService.deleteSet(currentSessionId, deletePayload.setId)
            .pipe(
              takeUntilDestroyed(this.destroyRef),
              catchError(err => this.handleApiError(err, 'Failed to delete set', deletePayload.setId, this.updatingSetId)))
            .subscribe((response: SessionServiceResponse<null> | null) => {
              if (response && !response.error && !this.errorSignal()) {
                this.session.update(currentSession => {
                  if (!currentSession) return null;
                  const updatedExercises = currentSession.exercises.map(ex => {
                    if (ex.trainingPlanExerciseId === exerciseId) {
                      const filteredSets = ex.sets.filter(s => s.id !== deletePayload.setId);
                      const reorderedSets = filteredSets.sort((a, b) => a.order - b.order);
                      return { ...ex, sets: reorderedSets };
                    }
                    return ex;
                  });
                  return { ...currentSession, exercises: updatedExercises };
                });
              }
              this.updatingSetId.set(null);
            });
        }
      });
  }

  handleSetAdded(trainingPlanExerciseId: string): void {
    if (this.isReadOnly()) return;

    const currentSessionId = this.sessionIdSignal();
    if (!currentSessionId) {
      this.snackBar.open('Session ID is missing. Cannot add set.', 'Close', { duration: 3000 });
      return;
    }

    const currentTrainingSession = this.session();
    if (!currentTrainingSession) {
      this.snackBar.open('Session data not loaded. Cannot add set.', 'Close', { duration: 3000 });
      return;
    }

    const exercise = this.exercises().find(ex => ex.trainingPlanExerciseId === trainingPlanExerciseId);
    if (!exercise) {
      this.snackBar.open('Exercise not found. Cannot add set.', 'Close', { duration: 3000 });
      return;
    }

    const setIndexForNewSet = exercise.sets.length + 1;
    const lastSetForPreFill = exercise.sets.length > 0 ? exercise.sets[exercise.sets.length - 1] : undefined;

    const dialogData: AddEditSetDialogData = {
      mode: 'add',
      trainingSessionId: currentSessionId,
      trainingPlanExerciseId: trainingPlanExerciseId,
      setIndexForNewSet: setIndexForNewSet,
      lastSetForPreFill: lastSetForPreFill,
    };

    const dialogRef: MatDialogRef<AddEditSetDialogComponent, AddEditSetDialogCloseResult> = this.dialog.open(
      AddEditSetDialogComponent,
      {
        width: '400px',
        data: dialogData,
        disableClose: true,
      }
    );

    dialogRef.afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((result): result is CreateSessionSetCommand => this.isCreateCommand(result)))
      .subscribe((command) => {
        this.isLoading.set(true);
        this.sessionService.addSet(command)
          .pipe(catchError(err => this.handleApiError(err, 'Failed to add new set', null, this.isLoading, true)))
          .subscribe((response: SessionServiceResponse<SessionSetDto | null> | null) => {
            const newSetDto = response?.data;
            if (newSetDto) {
              this.session.update(currentSession => {
                if (!currentSession) return null;
                const updatedExercises = currentSession.exercises.map(ex => {
                  if (ex.trainingPlanExerciseId === trainingPlanExerciseId) {
                    const newSetViewModel: SessionSetViewModel = {
                      id: newSetDto.id,
                      trainingPlanExerciseId: newSetDto.training_plan_exercise_id,
                      order: newSetDto.set_index,
                      status: newSetDto.status as SessionSetStatus,
                      expectedReps: newSetDto.expected_reps,
                      actualReps: newSetDto.actual_reps,
                      weight: newSetDto.actual_weight,
                    };
                    return { ...ex, sets: [...ex.sets, newSetViewModel] };
                  }
                  return ex;
                });
                return { ...currentSession, exercises: updatedExercises };
              });
            }
            this.isLoading.set(false);
          });
      });
  }

  handleSessionCompleted(): void {
    if (this.isReadOnly()) return;

    this.flushPendingSetUpdate();

    const currentSession = this.session();
    if (!currentSession) {
      this.snackBar.open('Cannot complete session: Session data is not loaded.', 'Close', { duration: 5000 });
      return;
    }

    const sessionId = currentSession.id;
    const trainingPlanId = currentSession.metadata?.trainingPlanId;

    const completeSessionInner = () => {
      this.isLoading.set(true);
      this.sessionService.completeSession(sessionId)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(err => {
            this.handleApiError(err, `Failed to mark session ${sessionId} as completed`);
            return of(null);
          }),
          finalize(() => {
            this.session.update(s => {
              if (!s || !s.metadata) return s;
              return {
                ...s,
                metadata: { ...s.metadata, status: 'COMPLETED' as SessionStatus }
              };
            });

            const navigateHomeAndShowSnackbar = () => {
              this.router.navigate(['/home']);
              this.snackBar.open('Session completed. See you soon!', 'Close', { duration: 3000 });
              this.isLoading.set(false);
            };

            if (trainingPlanId) {
              this.sessionService.createSession(trainingPlanId)
                .pipe(
                  takeUntilDestroyed(this.destroyRef),
                  catchError(err => {
                    console.error(`Failed to create next session from plan ${trainingPlanId}:`, err);
                    this.snackBar.open('Failed to schedule next session. Please do it manually.', 'Close', { duration: 5000 });
                    return of(null);
                  })
                )
                .subscribe({
                  complete: () => navigateHomeAndShowSnackbar()
                });
            } else {
              this.snackBar.open('Training plan ID not found. Cannot schedule next session automatically.', 'Close', { duration: 5000 });
              navigateHomeAndShowSnackbar();
            }
          })
        )
        .subscribe();
    };

    const scheduleSessionCompletion = () => {
      const attemptToComplete = () => {
        if (this.updatingSetId() === null) {
          completeSessionInner();
        } else {
          setTimeout(attemptToComplete, 100);
        }
      };
      attemptToComplete();
    };

    if (this.allExercisesAndSetsComplete()) {
      scheduleSessionCompletion();
    } else {
      const dialogData: ConfirmationDialogData = {
        title: 'Complete Session',
        message: 'Not all sets are marked as completed or failed. Are you sure you want to complete this training session now?',
        confirmButtonText: 'Complete',
        cancelButtonText: 'Cancel'
      };

      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        width: '400px',
        data: dialogData
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          scheduleSessionCompletion();
        }
      });
    }
  }

  private loadSessionData(sessionId: string): void {
    this.isLoading.set(true);
    this.errorSignal.set(null);
    this.session.set(null);

    this.sessionService.getSession(sessionId).pipe(
      takeUntilDestroyed(this.destroyRef),
      map((response: SessionServiceResponse<TrainingSessionDto | null>) => response.data),
      switchMap((sessionDto: TrainingSessionDto | null) => {
        if (!sessionDto) {
          this.errorSignal.set('Session data not found.');
          this.isLoading.set(false);
          return forkJoin({
            sessionDto: of(null as TrainingSessionDto | null),
            planDto: of(null as TrainingPlanDto | null),
            exerciseDetailsMap: of(new Map<string, Pick<ExerciseDto, 'name'>>())
          });
        }

        const plan$: Observable<TrainingPlanDto | null> = sessionDto.training_plan_id
          ? this.planService.getPlan(sessionDto.training_plan_id).pipe(
              map(response => response.data),
              catchError(err => {
                console.error(`Error fetching training plan ${sessionDto.training_plan_id}:`, err);
                return of(null);
              })
            )
          : of(null);

        return forkJoin({
          sessionDto: of(sessionDto),
          planDto: plan$,
          exerciseDetailsMap: of(this.getExerciseDetailsMap(this.exerciseService.getAll()))
        });
      }),
      catchError(err => {
        console.error('Error in session data processing pipeline:', err);
        this.errorSignal.set('Failed to load full session details.');
        this.isLoading.set(false);
        return of(null);
      })
    ).subscribe((result: { sessionDto: TrainingSessionDto | null; planDto: TrainingPlanDto | null; exerciseDetailsMap: Map<string, Pick<ExerciseDto, 'name'>>; } | null) => {
      if (result && result.sessionDto) {
        const { sessionDto, planDto, exerciseDetailsMap } = result;
        const mappedViewModel = mapDtosToSessionDetailsViewModel(sessionDto, planDto, exerciseDetailsMap);
        this.session.set(mappedViewModel);
      }
      this.isLoading.set(false);
    });
  }

  private handleDebouncedSetUpdate(debouncedData: {
    setPayload: SessionSetViewModel;
    exerciseId: string;
    currentSessionId: string;
    originalSetSnapshotForRevert: SessionSetViewModel;
  }): void {
    if (this.latestSetUpdateDataForDebounce &&
        this.latestSetUpdateDataForDebounce.setPayload.id === debouncedData.setPayload.id &&
        this.latestSetUpdateDataForDebounce.exerciseId === debouncedData.exerciseId &&
        this.latestSetUpdateDataForDebounce.currentSessionId === debouncedData.currentSessionId
    ) {
      this.processDebouncedSetUpdate(
        this.latestSetUpdateDataForDebounce.setPayload,
        this.latestSetUpdateDataForDebounce.exerciseId,
        this.latestSetUpdateDataForDebounce.currentSessionId,
        this.latestSetUpdateDataForDebounce.originalSetSnapshotForRevert
      );
      this.latestSetUpdateDataForDebounce = null;
    }
  }

  private flushPendingSetUpdate(excludeSetId?: string): void {
    if (this.latestSetUpdateDataForDebounce) {
      if (excludeSetId && this.latestSetUpdateDataForDebounce.setPayload.id === excludeSetId) {
        return;
      }
      this.processDebouncedSetUpdate(
        this.latestSetUpdateDataForDebounce.setPayload,
        this.latestSetUpdateDataForDebounce.exerciseId,
        this.latestSetUpdateDataForDebounce.currentSessionId,
        this.latestSetUpdateDataForDebounce.originalSetSnapshotForRevert
      );
      this.latestSetUpdateDataForDebounce = null;
    }
  }

  private processDebouncedSetUpdate(
    setVMForApi: SessionSetViewModel,
    exerciseId: string,
    sessionId: string,
    originalSetStateToRevertTo: SessionSetViewModel
  ): void {
    if (this.updatingSetId() === setVMForApi.id && !this.latestSetUpdateDataForDebounce) {
      // Intentionally empty: This condition is a defensive check to prevent re-processing.
      // The main logic in the .subscribe() of the setUpdateApiCallSubject handles debouncing.
    }

    const setId = setVMForApi.id;
    this.updatingSetId.set(setId);

    let apiCall: Observable<SessionServiceResponse<SessionSetDto>>;

    switch (setVMForApi.status) {
      case 'COMPLETED':
        apiCall = this.sessionService.completeSet(sessionId, setId) as Observable<SessionServiceResponse<SessionSetDto>>;
        break;
      case 'FAILED':
        apiCall = this.sessionService.failSet(sessionId, setId, setVMForApi.actualReps ?? 0) as Observable<SessionServiceResponse<SessionSetDto>>;
        break;
      case 'PENDING':
      default: {
        apiCall = this.sessionService.resetSet(sessionId, setId) as Observable<SessionServiceResponse<SessionSetDto>>;
        break;
      }
    }

    apiCall.pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(err => {
        this.updateLocalSessionDataWithViewModel(originalSetStateToRevertTo, exerciseId);
        return this.handleApiError(err, 'Failed to sync set changes for set', setId, this.updatingSetId);
      })
    ).subscribe((response: SessionServiceResponse<SessionSetDto> | null) => {
      const updatedSetDto = response?.data;
      if (updatedSetDto) {
        this.updateLocalSessionDataWithViewModel(this.mapSetDtoToViewModel(updatedSetDto, originalSetStateToRevertTo.expectedReps), exerciseId);
      } else if (this.errorSignal() === null) {
        // Intentionally empty: Error was handled by catchError in the pipe, UI should have been reverted.
      }
      this.updatingSetId.set(null);
    });
  }

  private isCreateCommand(result: AddEditSetDialogCloseResult | undefined): result is CreateSessionSetCommand {
    return !!result && typeof result === 'object' && 'training_session_id' in result;
  }

  private isUpdateCommand(result: AddEditSetDialogCloseResult | undefined): result is UpdateSessionSetCommand {
    return !!result && typeof result === 'object' && !('training_session_id' in result) && ('actual_reps' in result || 'actual_weight' in result || 'status' in result) ;
  }

  private isDeleteSetResult(result: AddEditSetDialogCloseResult | undefined): result is DeleteSetResult {
    return !!result && typeof result === 'object' && 'action' in result && result.action === 'delete';
  }

  private updateLocalSessionDataWithViewModel(updatedSetVM: SessionSetViewModel, exerciseId: string): void {
    this.session.update(currentSession => {
      if (!currentSession || !currentSession.metadata) return null;

      const currentStatus = currentSession.metadata.status;
      const newStatus = currentStatus === 'PENDING' ? 'IN_PROGRESS' : currentStatus;

      let newDate = currentSession.metadata.date;
      if (newStatus === 'IN_PROGRESS' && !newDate) {
        newDate = new Date().toISOString();
      }

      const updatedExercises = currentSession.exercises.map(ex => {
        if (ex.trainingPlanExerciseId === exerciseId) {
          const updatedSets = ex.sets.map(s => {
            if (s.id === updatedSetVM.id) {
              return updatedSetVM;
            }
            return s;
          });
          return { ...ex, sets: updatedSets };
        }
        return ex;
      });

      return {
        ...currentSession,
        exercises: updatedExercises,
        metadata: {
          ...currentSession.metadata,
          date: newDate ?? new Date().toISOString(),
          status: newStatus,
        },
      };
    });
  }

  private getExerciseDetailsMap(allExercises: ExerciseDto[]): Map<string, Pick<ExerciseDto, 'name'>> {
    const map = new Map<string, Pick<ExerciseDto, 'name'>>();
    allExercises.forEach(ex => map.set(ex.id, { name: ex.name }));
    return map;
  }

  private mapSetDtoToViewModel(dto: SessionSetDto, expectedRepsOverride: number | null = null): SessionSetViewModel {
    const currentTrainingSession = this.session();
    let determinedExpectedReps: number | undefined | null = null;

    if (expectedRepsOverride !== null) {
        determinedExpectedReps = expectedRepsOverride;
    } else if (currentTrainingSession?.exercises) {
      const exerciseVm = currentTrainingSession.exercises.find(
        ex => ex.trainingPlanExerciseId === dto.training_plan_exercise_id
      );
      if (exerciseVm) {
        const originalVmSet = exerciseVm.sets.find(s => s.id === dto.id);
        if (originalVmSet) {
          determinedExpectedReps = originalVmSet.expectedReps;
        }
      }
    }

    return {
      id: dto.id,
      trainingPlanExerciseId: dto.training_plan_exercise_id,
      order: dto.set_index,
      status: dto.status as SessionSetStatus,
      expectedReps: determinedExpectedReps ?? 0,
      actualReps: dto.actual_reps ?? null,
      weight: dto.actual_weight,
    };
  }

  private handleApiError(
    error: unknown,
    messagePrefix: string,
    itemId: string | null = null,
    loadingSignalToReset: WritableSignal<boolean | string | null> | null = null,
    isGeneralLoadingFlag: boolean = false
  ): Observable<null> {
    const baseMessage = itemId ? `${messagePrefix} ${itemId}` : messagePrefix;
    const fullMessage = `${baseMessage}.`;

    console.error(`${baseMessage}:`, error);
    this.errorSignal.set(fullMessage);
    this.snackBar.open(baseMessage, 'Close', { duration: 3000 });

    if (loadingSignalToReset) {
      if (isGeneralLoadingFlag) {
        (loadingSignalToReset as WritableSignal<boolean>).set(false);
      } else {
        (loadingSignalToReset as WritableSignal<string | null>).set(null);
      }
    }
    return of(null);
  }
}
