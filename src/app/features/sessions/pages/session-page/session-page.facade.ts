import { inject, signal, Injectable, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, forkJoin, EMPTY } from 'rxjs';
import { catchError, map, switchMap, tap, finalize } from 'rxjs/operators';
import { PlanService } from '@features/plans/api/plan.service';
import { ExerciseDto, TrainingPlanDto, SessionSetDto, CreateSessionSetCommand, UpdateSessionSetCommand } from '@shared/api/api.types';
import { ExerciseService } from '@shared/api/exercise.service';
import { KeyedDebouncerService, DebouncerSuccessEvent, DebouncerFailureEvent } from '@shared/services/keyed-debouncer.service';
import { tapIf } from '@shared/utils/operators/tap-if.operator';
import { SessionService } from '../../api/session.service';
import { SessionPageViewModel, SessionSetViewModel } from '../../models/session-page.viewmodel';
import { mapToSessionPageViewModel, mapToSessionSetViewModel } from '../../models/session.mapping';
import { SessionStatus } from '../../models/session.types';

// Types used by KeyedDebouncerService for session set update operations
type SessionSetUpdateSuccessDataContext = { exerciseId: string; originalExpectedReps: number | null };
type SessionSetUpdateSuccessPayload = DebouncerSuccessEvent<SessionSetDto, SessionSetUpdateSuccessDataContext>;
type SessionSetUpdateFailureDataContext = { originalSetSnapshot: SessionSetViewModel; exerciseId: string };
type SessionSetUpdateFailurePayload = DebouncerFailureEvent<SessionSetUpdateFailureDataContext, string | Error>;

const initialState: SessionPageViewModel = {
  id: null,
  isLoading: true,
  error: null,
  exercises: [],
  metadata: {},
};

@Injectable({
  providedIn: 'root',
})
export class SessionPageFacade {
  private readonly planService = inject(PlanService);
  private readonly sessionService = inject(SessionService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly debouncerService = inject(KeyedDebouncerService);

  readonly viewModel = signal<SessionPageViewModel>(initialState);
  readonly timerResetTrigger = signal<number | null>(null);

  loadSessionData(sessionId: string | null): void {
    if (!sessionId) {
      console.error('Session ID is missing. Cannot load session data.');
      this.viewModel.set(initialState);
      this.timerResetTrigger.set(null);
      this.flushPendingSetUpdate();
      return;
    }

    this.flushPendingSetUpdate();
    this.viewModel.set({ ...initialState, id: sessionId, isLoading: true });

    this.sessionService.getSession(sessionId).pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(res => {
        if (!res || !res.data) {
          this.viewModel.update(s => ({ ...s, isLoading: false, error: 'Session data not found.', exercises: [] }));
          return EMPTY;
        }

        return forkJoin({
          session: of(
            res.data
          ),
          plan: this.planService.getPlan(res.data.training_plan_id).pipe(
            map(res => res.data),
            catchError(() => of(null as TrainingPlanDto | null))
          ),
          exercises: this.exerciseService.getExercises().pipe(
            map(res => res.data ?? [] as ExerciseDto[]),
            catchError(() => of([] as ExerciseDto[]))
          )
        });
      }),
      map(({ session, plan, exercises }) => {
        const exerciseDetailsMap = this.getExerciseDetailsMap(exercises);
        const mappedViewModel = mapToSessionPageViewModel(session, plan, exerciseDetailsMap);

        if (!mappedViewModel) {
          this.viewModel.update(s => ({ ...s, isLoading: false, error: 'Failed to map session data to view model.', exercises: [] }));
          return null;
        }
        return mappedViewModel;
      }),
      catchError(error => {
        const errorMessage = error.message || 'An unexpected error occurred while loading session data.';
        this.viewModel.update(state => ({ ...state, isLoading: false, error: errorMessage, exercises: [] }));
        return EMPTY;
      })
    ).subscribe(updatedViewModel => {
      if (updatedViewModel && typeof updatedViewModel.isLoading !== 'undefined') {
        this.viewModel.set(updatedViewModel as SessionPageViewModel);
      }
    });
  }

  enqueueSetPatch(setPayload: SessionSetViewModel, exerciseId: string, originalSetSnapshotForRevert: SessionSetViewModel): void {
    const currentSessionId = this.viewModel().id!;
    this.updateSessionViewModelWithUpsertedSet(setPayload, exerciseId);

    const setId = setPayload.id;
    let apiCallProvider: () => Observable<SessionSetDto | null>;

    switch (setPayload.status) {
      case 'COMPLETED':
        apiCallProvider = () => this.sessionService.completeSet(currentSessionId, setId).pipe(map(res => res?.data ?? null));
        break;
      case 'FAILED':
        apiCallProvider = () => this.sessionService.failSet(currentSessionId, setId, setPayload.actualReps ?? 0).pipe(map(res => res?.data ?? null));
        break;
      case 'PENDING':
      default:
        apiCallProvider = () => this.sessionService.resetSet(currentSessionId, setId).pipe(map(res => res?.data ?? null));
        break;
    }

    const successContext: SessionSetUpdateSuccessDataContext = {
      exerciseId,
      originalExpectedReps: originalSetSnapshotForRevert.expectedReps
    };
    const failureContext: SessionSetUpdateFailureDataContext = {
      originalSetSnapshot: originalSetSnapshotForRevert,
      exerciseId
    };

    const { successEvent$, failureEvent$ } = this.debouncerService.enqueue<
      SessionSetDto | null,
      SessionSetUpdateSuccessPayload,
      SessionSetUpdateFailurePayload,
      SessionSetUpdateSuccessDataContext,
      SessionSetUpdateFailureDataContext,
      string | Error
    >(
      setId,
      apiCallProvider,
      successContext,
      failureContext,
      (data, context, key) => ({ data: data!, context, key }),
      (error, context, key) => ({ error, context, key })
    );

    successEvent$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(eventPayload => {
      const updatedViewModel = mapToSessionSetViewModel(eventPayload.data, eventPayload.context.originalExpectedReps);
      this.updateSessionViewModelWithUpsertedSet(updatedViewModel, eventPayload.context.exerciseId);
      this.viewModel.update(s => ({ ...s, error: null }));
    });

    failureEvent$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(eventPayload => {
      this.updateSessionViewModelWithUpsertedSet(eventPayload.context.originalSetSnapshot, eventPayload.context.exerciseId);
      const errorMessage = typeof eventPayload.error === 'string' ? eventPayload.error : (eventPayload.error as Error)?.message || 'Failed to sync set changes.';
      this.viewModel.update(s => ({ ...s, error: errorMessage }));
    });
  }

  addSet(command: CreateSessionSetCommand, trainingPlanExerciseId: string): Observable<SessionSetDto | null> {
    const operation$ = this.sessionService.createSet(command).pipe(
      map(response => response?.data ?? null),
      tapIf(setDto => !!setDto, (newSetDto) =>
        this.updateSessionViewModelWithUpsertedSet(mapToSessionSetViewModel(newSetDto!), trainingPlanExerciseId)
      )
    );

    return this.handleSessionOperation(operation$, 'Failed to add new set');
  }

  updateSet(setId: string, exerciseId: string, command: UpdateSessionSetCommand): Observable<SessionSetDto | null> {
    const currentSessionId = this.viewModel().id!;

    const operation$ = this.sessionService.updateSet(currentSessionId, setId, command).pipe(
      map(response => response?.data ?? null),
      tapIf(setDto => !!setDto, (updatedSetDto) =>
        this.updateSessionViewModelWithUpsertedSet(mapToSessionSetViewModel(updatedSetDto!), exerciseId)
      )
    );

    return this.handleSessionOperation(operation$, `Failed to update details for set ${setId}`);
  }

  deleteSet(setId: string, exerciseId: string): Observable<boolean> {
    const currentSessionId = this.viewModel().id!;

    const operation$ = this.sessionService.deleteSet(currentSessionId, setId).pipe(
      map(response => !response?.error),
      tapIf(success => success, () =>
        this.updateSessionViewModelWithDeletedSet(setId, exerciseId)
      )
    );

    return this.handleSessionOperation(operation$, `Failed to delete set ${setId}`).pipe(map(s => !!s));
  }

  completeSession(): Observable<boolean> {
    const originalSessionState = { ...this.viewModel() };
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null, metadata: { ...s.metadata!, status: 'COMPLETED' as SessionStatus } }));

    return this.debouncerService.flushCurrentActiveDebounce().pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(() => {
        const currentSessionData = this.viewModel();
        const sessionId = currentSessionData.id!;

        return this.sessionService.completeSession(sessionId).pipe(
          switchMap(() => {
            const trainingPlanId = currentSessionData.metadata?.trainingPlanId;
            if (trainingPlanId) {
              return this.sessionService.createSession(trainingPlanId).pipe(
                map(() => true),
                catchError(err => {
                  console.error(`Failed to create next session from plan ${trainingPlanId}:`, err);
                  this.viewModel.update(s => ({ ...s, error: 'Session completed, but failed to schedule the next one automatically.' }));
                  return of(true);
                })
              );
            }
            return of(true);
          }),
          catchError(err => {
            const errorMessage = `Failed to mark session ${sessionId} as completed.`;
            console.error(errorMessage, err);
            this.viewModel.set(originalSessionState);
            this.viewModel.update(s => ({ ...s, error: errorMessage, isLoading: false }));
            return of(false);
          })
        );
      }),
      catchError(flushError => {
        console.error('Error during flush of pending updates before completing session:', flushError);
        this.viewModel.update(s => ({
          ...s,
          isLoading: false,
          error: 'Failed to save pending changes before completing session.',
          metadata: { ...s.metadata!, status: 'IN_PROGRESS' as SessionStatus }
        }));
        return of(false);
      }),
      finalize(() => {
        this.viewModel.update(s => ({ ...s, isLoading: false }));
      })
    );
  }

  triggerTimerReset(disable: boolean = false): void {
    this.timerResetTrigger.set(disable ? null : Date.now());
  }

  flushPendingSetUpdate(): void {
    this.debouncerService.flushCurrentActiveDebounce().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  private getExerciseDetailsMap(allExercises: ExerciseDto[]): Map<string, Pick<ExerciseDto, 'name'>> {
    const map = new Map<string, Pick<ExerciseDto, 'name'>>();
    allExercises.forEach(ex => map.set(ex.id, { name: ex.name }));
    return map;
  }

  private handleSessionOperation<T>(
    operation$: Observable<T>,
    errorMessagePrefix: string,
    onSuccess?: (result: T) => void
  ): Observable<T | null> {
    this.flushPendingSetUpdate();
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null }));

    return operation$.pipe(
      tap(result => {
        if (onSuccess) {
          onSuccess(result);
        }
      }),
      catchError(err => {
        const errorMessage = `${errorMessagePrefix}: ${err.message || 'Unknown error'}`;
        console.error(errorMessagePrefix, err);
        this.viewModel.update(s => ({ ...s, error: errorMessage, isLoading: false }));
        return of(null);
      }),
      finalize(() => {
        this.viewModel.update(s => ({ ...s, isLoading: false }));
      })
    );
  }

  private updateSessionViewModelWithUpsertedSet(set: SessionSetViewModel, exerciseId: string): void {
    this.viewModel.update(session => {
      const updatedExercises = session.exercises.map(ex => {
        if (ex.trainingPlanExerciseId === exerciseId) {
          const setIndex = ex.sets.findIndex(s => s.id === set.id);
          let updatedSets;
          if (setIndex > -1) {
            updatedSets = ex.sets.map(s => s.id === set.id ? set : s);
          } else {
            updatedSets = [...ex.sets, set];
            updatedSets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          }
          return { ...ex, sets: updatedSets };
        }
        return ex;
      });
      return { ...session, exercises: updatedExercises, error: null };
    });
  }

  private updateSessionViewModelWithDeletedSet(setId: string, trainingPlanExerciseId: string): void {
    this.viewModel.update(session => {
      const updatedExercises = session.exercises.map(ex => {
        if (ex.trainingPlanExerciseId === trainingPlanExerciseId) {
          const filteredSets = ex.sets.filter(s_ => s_.id !== setId);
          const reorderedSets = filteredSets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          return { ...ex, sets: reorderedSets };
        }
        return ex;
      });
      return { ...session, exercises: updatedExercises };
    });
  }
}
