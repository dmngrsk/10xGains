import { inject, signal, Injectable, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, forkJoin, EMPTY } from 'rxjs';
import { ExerciseDto, PlanDto, SessionSetDto, CreateSessionSetCommand, UpdateSessionSetCommand, SessionStatus } from '@txg/shared';
import { catchError, map, switchMap, tap, finalize } from 'rxjs/operators';
import { PlanService } from '@features/plans/api/plan.service';
import { ExerciseService } from '@shared/api/exercise.service';
import { KeyedDebouncerService, DebouncerSuccessEvent, DebouncerFailureEvent } from '@shared/services/keyed-debouncer.service';
import { ServerClockService } from '@shared/services/server-clock.service';
import { resetOnUserChange } from '@shared/utils/auth/reset-on-user-change';
import { tapIf } from '@shared/utils/operators/tap-if.operator';
import { SessionService } from '../../api/session.service';
import { SessionPageViewModel, SessionSetViewModel } from '../../models/session-page.viewmodel';
import { mapToSessionPageViewModel, mapToSessionSetViewModel } from '../../models/session.mapping';

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
  private readonly serverClock = inject(ServerClockService);

  readonly viewModel = signal<SessionPageViewModel>(initialState);

  // The instant the rest timer counts up from. Seeded on load from the latest completed set so it
  // survives app freezes and view re-entry, then bumped to "now" on every set interaction.
  readonly timerStartTimestamp = signal<number | null>(null);

  constructor() {
    resetOnUserChange(() => this.clearUserScopedState());
  }

  /**
   * Drops the session currently held for the user who was signed in.
   *
   * The view model survives navigation because this facade is a root singleton, so without this a
   * second user in the same tab briefly sees the previous user's workout before the load for their
   * own session resolves - or keeps seeing it if that load fails.
   */
  private clearUserScopedState(): void {
    this.viewModel.set(initialState);
    this.timerStartTimestamp.set(null);
  }

  loadSessionData(sessionId: string | null): void {
    if (!sessionId) {
      console.error('Session ID is missing. Cannot load session data.');
      this.viewModel.set(initialState);
      this.timerStartTimestamp.set(null);
      this.flushPendingSetUpdate();
      return;
    }

    this.flushPendingSetUpdate();
    this.viewModel.set({ ...initialState, id: sessionId, isLoading: true });
    this.timerStartTimestamp.set(null);

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
          plan: this.planService.getPlan(res.data.plan_id).pipe(
            map(res => res.data),
            catchError(() => of(null as PlanDto | null))
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
      // The map above returns null when it could not build a view model, having already reported
      // that on the existing one, so a value here means the mapping succeeded.
      if (updatedViewModel) {
        this.viewModel.set(updatedViewModel);
        this.timerStartTimestamp.set(this.getLatestCompletionTime(updatedViewModel));
      }
    });
  }

  enqueueSetPatch(setPayload: SessionSetViewModel, exerciseId: string, originalSetSnapshotForRevert: SessionSetViewModel): void {
    const currentSessionId = this.viewModel().id!;
    this.updateSessionViewModelWithUpsertedSet(setPayload, exerciseId);

    // Every set interaction (complete, fail or reset) restarts the rest timer from now.
    this.timerStartTimestamp.set(this.serverClock.now());

    const setId = setPayload.id;
    let apiCallProvider: () => Observable<SessionSetDto>;

    // A patch can come back with no set: the API answers 404 when the set was deleted in another
    // tab or the session has since been completed, and `ApiService` resolves that rather than
    // throwing. For an optimistic update that is a failure - feeding null into the success path
    // would leave the optimistic state in place and throw while mapping the view model.
    const requireSet = map((res: { data: SessionSetDto | null } | null): SessionSetDto => {
      if (!res?.data) {
        throw new Error('This set no longer exists. Refresh the session to see its current state.');
      }
      return res.data;
    });

    switch (setPayload.status) {
      case 'COMPLETED':
        apiCallProvider = () => this.sessionService.completeSet(currentSessionId, setId).pipe(requireSet);
        break;
      case 'FAILED':
        apiCallProvider = () => this.sessionService.failSet(currentSessionId, setId, setPayload.actualReps ?? 0).pipe(requireSet);
        break;
      case 'PENDING':
      default:
        apiCallProvider = () => this.sessionService.resetSet(currentSessionId, setId).pipe(requireSet);
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
      SessionSetDto,
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
      (data, context, key) => ({ data, context, key }),
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

  addSet(command: CreateSessionSetCommand, planExerciseId: string): Observable<SessionSetDto | null> {
    const operation$ = this.sessionService.createSet(command).pipe(
      map(response => response?.data ?? null),
      tapIf(setDto => !!setDto, (newSetDto) =>
        this.updateSessionViewModelWithUpsertedSet(mapToSessionSetViewModel(newSetDto!), planExerciseId)
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
      // A 404 resolves without an error, so the absence of one is not enough to call the delete a
      // success - it would report a set that was never there as removed.
      map(response => !response?.error && response?.status !== 404),
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
            const planId = currentSessionData.metadata?.planId;
            if (planId) {
              return this.sessionService.createSession(planId).pipe(
                map(() => true),
                catchError(err => {
                  console.error(`Failed to create next session from plan ${planId}:`, err);
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

  saveNotes(sessionNotes: string | null, planNotes: string | null | undefined): Observable<boolean> {
    const state = this.viewModel();
    const sessionId = state.id!;
    const metadata = state.metadata;

    const operations: Observable<boolean>[] = [];

    if (sessionNotes !== (metadata?.notes ?? null)) {
      operations.push(
        this.sessionService.updateSession(sessionId, { notes: sessionNotes }).pipe(
          map(res => !res?.error),
          tapIf(success => success, () =>
            this.viewModel.update(s => ({ ...s, metadata: { ...s.metadata, notes: sessionNotes } }))
          ),
          catchError(err => {
            console.error('Failed to save session notes:', err);
            return of(false);
          })
        )
      );
    }

    const planId = metadata?.planId;
    if (planNotes !== undefined && planId && planNotes !== (metadata?.planNotes ?? null)) {
      operations.push(
        this.planService.updatePlan(planId, { notes: planNotes }).pipe(
          map(res => !res?.error),
          tapIf(success => success, () =>
            this.viewModel.update(s => ({ ...s, metadata: { ...s.metadata, planNotes } }))
          ),
          catchError(err => {
            console.error('Failed to save plan notes:', err);
            return of(false);
          })
        )
      );
    }

    if (operations.length === 0) {
      return of(true);
    }

    return forkJoin(operations).pipe(map(results => results.every(success => success)));
  }

  flushPendingSetUpdate(): void {
    this.debouncerService.flushCurrentActiveDebounce().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  private getExerciseDetailsMap(allExercises: ExerciseDto[]): Map<string, Pick<ExerciseDto, 'name'>> {
    const map = new Map<string, Pick<ExerciseDto, 'name'>>();
    allExercises.forEach(ex => map.set(ex.id, { name: ex.name }));
    return map;
  }

  private getLatestCompletionTime(viewModel: SessionPageViewModel): number | null {
    let latest: number | null = null;
    for (const exercise of viewModel.exercises) {
      for (const set of exercise.sets) {
        if (!set.completedAt) continue;
        const time = set.completedAt.getTime();
        if (latest === null || time > latest) {
          latest = time;
        }
      }
    }
    return latest;
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
      const updatedSessionStatus = session.metadata?.status === 'PENDING' ? 'IN_PROGRESS' as SessionStatus : session.metadata?.status;
      const updatedSessionDate = session.metadata?.date ?? new Date();
      const updatedMetadata = { ...session.metadata, status: updatedSessionStatus, date: updatedSessionDate };

      const updatedExercises = session.exercises.map(ex => {
        if (ex.planExerciseId === exerciseId) {
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

      return { ...session, metadata: updatedMetadata, exercises: updatedExercises, error: null };
    });
  }

  private updateSessionViewModelWithDeletedSet(setId: string, planExerciseId: string): void {
    this.viewModel.update(session => {
      const updatedExercises = session.exercises.map(ex => {
        if (ex.planExerciseId === planExerciseId) {
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
