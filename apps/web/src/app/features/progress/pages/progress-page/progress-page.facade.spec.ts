import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ExerciseProgressDto } from '@txg/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanService } from '@features/plans/api/plan.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { ProgressPageFacade } from './progress-page.facade';
import { ProgressService } from '../../api/progress.service';

const PLANS = [
  { id: 'plan-1', name: 'Starting Strength' },
  { id: 'plan-2', name: 'Texas Method' },
];

function makeDto(exerciseId: string, exerciseName: string): ExerciseProgressDto {
  return {
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    points: [
      { session_id: 's-1', session_date: '2026-06-01T10:00:00.000Z', plan_id: 'plan-1', top_weight: 100, reps: [5, 5, 5] },
    ],
  };
}

describe('ProgressPageFacade', () => {
  let facade: ProgressPageFacade;
  let getExerciseProgressMock: ReturnType<typeof vi.fn>;
  let getProfileMock: ReturnType<typeof vi.fn>;

  const configure = (activePlanId: string | null, user: { id: string } | null = { id: 'user-1' }) => {
    getExerciseProgressMock = vi.fn().mockReturnValue(
      of({ data: [makeDto('ex-1', 'Bench Press'), makeDto('ex-2', 'Squat')], error: null })
    );
    getProfileMock = vi.fn().mockReturnValue(
      of({ data: { active_plan_id: activePlanId }, error: null })
    );

    TestBed.configureTestingModule({
      providers: [
        ProgressPageFacade,
        { provide: ProgressService, useValue: { getExerciseProgress: getExerciseProgressMock } },
        { provide: PlanService, useValue: { getPlans: () => of({ data: PLANS, error: null }) } },
        { provide: ProfileService, useValue: { getProfile: getProfileMock } },
        { provide: AuthService, useValue: { currentUser: () => user } },
      ],
    });
    facade = TestBed.inject(ProgressPageFacade);
  };

  describe('loadProgressPageData', () => {
    beforeEach(() => configure('plan-2'));

    it('should default the plan filter to the active plan from the profile', () => {
      facade.loadProgressPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-2');
      expect(getExerciseProgressMock).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: 'plan-2' })
      );
    });

    it('should request the last 3 months by default', () => {
      const now = Date.now();
      facade.loadProgressPageData();

      const params = getExerciseProgressMock.mock.calls[0][0];
      const threeMonthsMs = 92 * 24 * 60 * 60 * 1000;
      expect(now - new Date(params.date_from).getTime()).toBeLessThanOrEqual(threeMonthsMs);
      expect(now - new Date(params.date_from).getTime()).toBeGreaterThan(88 * 24 * 60 * 60 * 1000);
    });

    it('should select all exercises by default', () => {
      facade.loadProgressPageData();

      expect(facade.viewModel().series).toHaveLength(2);
      expect(facade.viewModel().series.every(s => s.selected)).toBe(true);
      expect(facade.viewModel().isLoading).toBe(false);
    });

    it('should surface an error when loading progress fails', () => {
      getExerciseProgressMock.mockReturnValue(throwError(() => new Error('boom')));

      facade.loadProgressPageData();

      expect(facade.viewModel().error).toContain('Failed to load exercise progress');
      expect(facade.viewModel().isLoading).toBe(false);
      expect(facade.viewModel().series).toEqual([]);
    });
  });

  describe('loadProgressPageData without a signed-in user', () => {
    // forkJoin builds its argument object eagerly, so reading the id off a null user would
    // throw synchronously, before the pipe exists for catchError to handle it.
    it('should surface an error instead of throwing', () => {
      configure('plan-1', null);

      expect(() => facade.loadProgressPageData()).not.toThrow();

      expect(facade.viewModel().error).toContain('Please sign in again');
      expect(facade.viewModel().isLoading).toBe(false);
      expect(getProfileMock).not.toHaveBeenCalled();
      expect(getExerciseProgressMock).not.toHaveBeenCalled();
    });
  });

  describe('loadProgressPageData without a usable active plan', () => {
    it('should fall back to all plans when the profile has no active plan', () => {
      configure(null);

      facade.loadProgressPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBeNull();
      expect(getExerciseProgressMock).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: undefined })
      );
    });

    it('should fall back to all plans when the active plan no longer exists', () => {
      configure('plan-deleted');

      facade.loadProgressPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBeNull();
    });
  });

  describe('updateFilters', () => {
    beforeEach(() => {
      configure('plan-1');
      facade.loadProgressPageData();
    });

    it('should re-select all exercises when the plan filter changes', () => {
      facade.toggleExercise('ex-1');
      expect(facade.viewModel().series.find(s => s.exerciseId === 'ex-1')!.selected).toBe(false);

      facade.updateFilters({ ...facade.viewModel().filters, selectedPlanId: 'plan-2' });

      expect(facade.viewModel().series.every(s => s.selected)).toBe(true);
    });

    it('should preserve the selection when only the date range changes', () => {
      facade.toggleExercise('ex-1');

      facade.updateFilters({ ...facade.viewModel().filters, dateRangePreset: '1Y' });

      expect(facade.viewModel().series.find(s => s.exerciseId === 'ex-1')!.selected).toBe(false);
      expect(facade.viewModel().series.find(s => s.exerciseId === 'ex-2')!.selected).toBe(true);
    });

    it('should select exercises that the previous result did not contain', () => {
      getExerciseProgressMock.mockReturnValueOnce(of({ data: [], error: null }));
      facade.updateFilters({ ...facade.viewModel().filters, dateRangePreset: '6M' });
      expect(facade.viewModel().series).toEqual([]);

      facade.updateFilters({ ...facade.viewModel().filters, dateRangePreset: 'ALL' });

      expect(facade.viewModel().series).toHaveLength(2);
      expect(facade.viewModel().series.every(s => s.selected)).toBe(true);
    });

    it('should send no date_from for the ALL preset', () => {
      facade.updateFilters({ ...facade.viewModel().filters, dateRangePreset: 'ALL' });

      const calls = getExerciseProgressMock.mock.calls;
      const params = calls[calls.length - 1][0];
      expect(params.date_from).toBeUndefined();
    });
  });

  describe('toggleExercise', () => {
    beforeEach(() => {
      configure('plan-1');
      facade.loadProgressPageData();
    });

    it('should flip only the toggled series', () => {
      facade.toggleExercise('ex-2');

      expect(facade.viewModel().series.find(s => s.exerciseId === 'ex-1')!.selected).toBe(true);
      expect(facade.viewModel().series.find(s => s.exerciseId === 'ex-2')!.selected).toBe(false);

      facade.toggleExercise('ex-2');
      expect(facade.viewModel().series.find(s => s.exerciseId === 'ex-2')!.selected).toBe(true);
    });
  });
});
