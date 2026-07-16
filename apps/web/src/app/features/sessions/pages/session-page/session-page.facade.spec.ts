import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { SessionSetDto, SessionSetStatus } from '@txg/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanService } from '@features/plans/api/plan.service';
import { ExerciseService } from '@shared/api/exercise.service';
import { KeyedDebouncerService } from '@shared/services/keyed-debouncer.service';
import { ServerClockService } from '@shared/services/server-clock.service';
import { SessionPageFacade } from './session-page.facade';
import { SessionService } from '../../api/session.service';
import { SessionPageViewModel, SessionSetViewModel } from '../../models/session-page.viewmodel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CapturedEnqueue = { successSubject: Subject<any>; failureSubject: Subject<any>; context: any; buildSuccess: any };

const SERVER_NOW = new Date('2023-01-01T10:00:00.000Z').getTime();

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

  const seedViewModel = (sets: SessionSetViewModel[]): void => {
    const viewModel: SessionPageViewModel = {
      id: 'session1',
      isLoading: false,
      error: null,
      metadata: { status: 'IN_PROGRESS' },
      exercises: [{ planExerciseId: 'tpe1', exerciseName: 'Bench Press', order: 1, plannedSetsCount: 1, sets }],
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
        { provide: PlanService, useValue: { updatePlan: vi.fn() } },
        { provide: ExerciseService, useValue: {} },
        { provide: SessionService, useValue: { completeSet: vi.fn(), failSet: vi.fn(), resetSet: vi.fn(), updateSession: vi.fn() } },
        { provide: KeyedDebouncerService, useValue: { enqueue: enqueueMock, flushCurrentActiveDebounce: () => of(undefined) } },
        { provide: ServerClockService, useValue: { now: () => SERVER_NOW } },
      ],
    });
    facade = TestBed.inject(SessionPageFacade);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('enqueueSetPatch timer anchor', () => {
    it.each<SessionSetStatus>(['COMPLETED', 'FAILED', 'PENDING'])(
      'should restart the timer at the server-clock instant when a set is set to %s',
      (status) => {
        seedViewModel([buildSet()]);

        facade.enqueueSetPatch(buildSet({ status, actualReps: status === 'COMPLETED' ? 10 : 0 }), 'tpe1', buildSet());

        expect(facade.timerStartTimestamp()).toBe(SERVER_NOW);
      }
    );

    it('should not move the timer anchor when the debounced server response arrives later', () => {
      seedViewModel([buildSet()]);
      facade.enqueueSetPatch(buildSet({ status: 'COMPLETED', actualReps: 10 }), 'tpe1', buildSet());
      expect(facade.timerStartTimestamp()).toBe(SERVER_NOW);

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

      // Anchor stays put; the server's later completed_at must not snap the timer.
      expect(facade.timerStartTimestamp()).toBe(SERVER_NOW);
    });
  });

  describe('saveNotes', () => {
    const seedNotesViewModel = (notes: string | null, planNotes: string | null): void => {
      facade.viewModel.set({
        id: 'session1',
        isLoading: false,
        error: null,
        metadata: { status: 'IN_PROGRESS', planId: 'plan1', notes, planNotes },
        exercises: [],
      });
    };

    it('should update the session note and metadata when it changed', () => {
      seedNotesViewModel(null, null);
      const sessionService = TestBed.inject(SessionService);
      vi.mocked(sessionService.updateSession).mockReturnValue(of({ data: null, error: null }));

      let result: boolean | undefined;
      facade.saveNotes('New session note', null).subscribe(r => (result = r));

      expect(result).toBe(true);
      expect(sessionService.updateSession).toHaveBeenCalledWith('session1', { notes: 'New session note' });
      expect(facade.viewModel().metadata?.notes).toBe('New session note');
    });

    it('should update the plan note via the plan service when it changed', () => {
      seedNotesViewModel('unchanged', null);
      const planService = TestBed.inject(PlanService);
      vi.mocked(planService.updatePlan).mockReturnValue(of({ data: null, error: null }));

      let result: boolean | undefined;
      facade.saveNotes('unchanged', 'New plan note').subscribe(r => (result = r));

      expect(result).toBe(true);
      expect(planService.updatePlan).toHaveBeenCalledWith('plan1', { notes: 'New plan note' });
      expect(facade.viewModel().metadata?.planNotes).toBe('New plan note');
      expect(TestBed.inject(SessionService).updateSession).not.toHaveBeenCalled();
    });

    it('should make no API calls when nothing changed', () => {
      seedNotesViewModel('same', 'same plan');

      let result: boolean | undefined;
      facade.saveNotes('same', 'same plan').subscribe(r => (result = r));

      expect(result).toBe(true);
      expect(TestBed.inject(SessionService).updateSession).not.toHaveBeenCalled();
      expect(TestBed.inject(PlanService).updatePlan).not.toHaveBeenCalled();
    });

    it('should not touch plan notes when the plan section was not shown (undefined)', () => {
      seedNotesViewModel(null, 'existing plan note');
      const sessionService = TestBed.inject(SessionService);
      vi.mocked(sessionService.updateSession).mockReturnValue(of({ data: null, error: null }));

      facade.saveNotes('note from history', undefined).subscribe();

      expect(TestBed.inject(PlanService).updatePlan).not.toHaveBeenCalled();
      expect(facade.viewModel().metadata?.planNotes).toBe('existing plan note');
    });

    it('should return false and keep the old metadata when the update fails', () => {
      seedNotesViewModel('old note', null);
      const sessionService = TestBed.inject(SessionService);
      vi.mocked(sessionService.updateSession).mockReturnValue(of({ data: null, error: 'boom' }));

      let result: boolean | undefined;
      facade.saveNotes('new note', null).subscribe(r => (result = r));

      expect(result).toBe(false);
      expect(facade.viewModel().metadata?.notes).toBe('old note');
    });
  });

  describe('getLatestCompletionTime', () => {
    const getLatestCompletionTime = (viewModel: SessionPageViewModel): number | null =>
      (facade as unknown as { getLatestCompletionTime(vm: SessionPageViewModel): number | null }).getLatestCompletionTime(viewModel);

    it('should return the newest completion time across all sets', () => {
      seedViewModel([
        buildSet({ id: 'a', completedAt: new Date('2023-01-01T09:58:00.000Z') }),
        buildSet({ id: 'b', completedAt: new Date('2023-01-01T09:59:30.000Z') }),
        buildSet({ id: 'c', completedAt: null }),
      ]);

      expect(getLatestCompletionTime(facade.viewModel())).toBe(new Date('2023-01-01T09:59:30.000Z').getTime());
    });

    it('should return null when no set has been completed', () => {
      seedViewModel([buildSet({ completedAt: null })]);

      expect(getLatestCompletionTime(facade.viewModel())).toBeNull();
    });
  });
});
