import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { SessionSetDto } from '@txg/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanService } from '@features/plans/api/plan.service';
import { ExerciseService } from '@shared/api/exercise.service';
import { KeyedDebouncerService } from '@shared/services/keyed-debouncer.service';
import { SessionPageFacade } from './session-page.facade';
import { SessionService } from '../../api/session.service';
import { SessionPageViewModel, SessionSetViewModel } from '../../models/session-page.viewmodel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CapturedEnqueue = { successSubject: Subject<any>; failureSubject: Subject<any>; context: any; buildSuccess: any };

describe('SessionPageFacade', () => {
  let facade: SessionPageFacade;
  let captured: CapturedEnqueue;

  const buildSet = (overrides: Partial<SessionSetViewModel> = {}): SessionSetViewModel => ({
    id: 'set1',
    planExerciseId: 'tpe1',
    order: 1,
    status: 'PENDING',
    expectedReps: 10,
    actualReps: null,
    weight: 50,
    completedAt: null,
    ...overrides,
  });

  const seedViewModel = (set: SessionSetViewModel): void => {
    const viewModel: SessionPageViewModel = {
      id: 'session1',
      isLoading: false,
      error: null,
      metadata: { status: 'IN_PROGRESS' },
      exercises: [{ planExerciseId: 'tpe1', exerciseName: 'Bench Press', order: 1, plannedSetsCount: 1, sets: [set] }],
    };
    facade.viewModel.set(viewModel);
  };

  beforeEach(() => {
    const enqueueMock = vi.fn((_key, _apiCall, successContext, _failureContext, buildSuccess) => {
      const successSubject = new Subject();
      const failureSubject = new Subject();
      captured = { successSubject, failureSubject, context: successContext, buildSuccess };
      return {
        response$: of(null),
        successEvent$: successSubject.asObservable(),
        failureEvent$: failureSubject.asObservable(),
      };
    });

    TestBed.configureTestingModule({
      providers: [
        SessionPageFacade,
        { provide: PlanService, useValue: {} },
        { provide: ExerciseService, useValue: {} },
        { provide: SessionService, useValue: { completeSet: vi.fn() } },
        { provide: KeyedDebouncerService, useValue: { enqueue: enqueueMock, flushCurrentActiveDebounce: () => of(undefined) } },
      ],
    });
    facade = TestBed.inject(SessionPageFacade);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('enqueueSetPatch timer anchor', () => {
    it('should keep the optimistic completion time as the timer anchor after the server responds', () => {
      const optimisticCompletedAt = new Date('2023-01-01T10:00:00.000Z');
      const original = buildSet();
      seedViewModel(original);

      const optimisticSet = buildSet({ status: 'COMPLETED', actualReps: 10, completedAt: optimisticCompletedAt });
      facade.enqueueSetPatch(optimisticSet, 'tpe1', original);

      // Optimistic anchor is applied immediately.
      expect(facade.timerStartTimestamp()).toBe(optimisticCompletedAt.getTime());

      // Server confirms ~1 debounce later, with a *later* completed_at.
      const serverDto: SessionSetDto = {
        id: 'set1',
        plan_exercise_id: 'tpe1',
        session_id: 'session1',
        set_index: 1,
        status: 'COMPLETED',
        expected_reps: 10,
        actual_reps: 10,
        actual_weight: 50,
        completed_at: '2023-01-01T10:00:01.200Z',
      };
      captured.successSubject.next(captured.buildSuccess(serverDto, captured.context, 'set1'));

      // The anchor must not snap forward to the server's completed_at.
      expect(facade.timerStartTimestamp()).toBe(optimisticCompletedAt.getTime());
      const syncedSet = facade.viewModel().exercises[0].sets[0];
      expect(syncedSet.completedAt).toEqual(optimisticCompletedAt);
      expect(syncedSet.actualReps).toBe(10);
    });

    it('should restore the previous anchor when the server call fails', () => {
      const previousCompletedAt = new Date('2023-01-01T09:59:00.000Z');
      const original = buildSet({ status: 'COMPLETED', actualReps: 10, completedAt: previousCompletedAt });
      seedViewModel(original);

      const optimisticSet = buildSet({ status: 'PENDING', completedAt: null });
      facade.enqueueSetPatch(optimisticSet, 'tpe1', original);
      expect(facade.timerStartTimestamp()).toBeNull();

      captured.failureSubject.next({ error: 'boom', context: { originalSetSnapshot: original, exerciseId: 'tpe1' }, key: 'set1' });

      expect(facade.timerStartTimestamp()).toBe(previousCompletedAt.getTime());
    });
  });
});
