import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PlanService } from '@features/plans/api/plan.service';
import { SessionService } from '@features/sessions/api/session.service';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { HistoryPageFacade } from './history-page.facade';

const PLANS = [
  { id: 'plan-1', name: 'Starting Strength' },
  { id: 'plan-2', name: 'Texas Method' },
];

describe('HistoryPageFacade', () => {
  let facade: HistoryPageFacade;
  let getProfileMock: ReturnType<typeof vi.fn>;
  let getSessionsMock: ReturnType<typeof vi.fn>;

  const configure = (activePlanId: string | null, user: { id: string } | null = { id: 'user-1' }) => {
    getProfileMock = vi.fn().mockReturnValue(of({ data: { active_plan_id: activePlanId }, error: null }));
    getSessionsMock = vi.fn().mockReturnValue(of({ data: [], totalCount: 0, error: null }));

    TestBed.configureTestingModule({
      providers: [
        HistoryPageFacade,
        { provide: PlanService, useValue: { getPlans: () => of({ data: PLANS, error: null }) } },
        { provide: ExerciseService, useValue: { getExercises: () => of({ data: [], error: null }) } },
        { provide: ProfileService, useValue: { getProfile: getProfileMock } },
        { provide: SessionService, useValue: { getSessions: getSessionsMock } },
        { provide: AuthService, useValue: { currentUser: () => user } },
      ],
    });
    facade = TestBed.inject(HistoryPageFacade);
  };

  describe('loadHistoryPageData', () => {
    it('should default the plan filter to the active plan from the profile', () => {
      configure('plan-2');

      facade.loadHistoryPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-2');
      expect(getSessionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: 'plan-2' })
      );
    });

    it('should surface an error when loading sessions fails', () => {
      configure('plan-2');
      getSessionsMock.mockReturnValue(throwError(() => new Error('boom')));

      facade.loadHistoryPageData();

      expect(facade.viewModel().error).toContain('Failed to load sessions');
      expect(facade.viewModel().isLoading).toBe(false);
      expect(facade.viewModel().sessions).toEqual([]);
    });
  });

  describe('loadHistoryPageData without a usable active plan', () => {
    it('should fall back to the first plan when the profile has no active plan', () => {
      configure(null);

      facade.loadHistoryPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-1');
    });

    it('should fall back to the first plan when the active plan no longer exists', () => {
      configure('plan-deleted');

      facade.loadHistoryPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-1');
    });
  });

  describe('loadHistoryPageData without a signed-in user', () => {
    it('should surface an error instead of throwing', () => {
      configure('plan-1', null);

      expect(() => facade.loadHistoryPageData()).not.toThrow();

      expect(facade.viewModel().error).toContain('Please sign in again');
      expect(facade.viewModel().isLoading).toBe(false);
      expect(getProfileMock).not.toHaveBeenCalled();
      expect(getSessionsMock).not.toHaveBeenCalled();
    });
  });

  describe('updateFilters', () => {
    beforeEach(() => {
      configure('plan-1');
      facade.loadHistoryPageData();
    });

    const lastQuery = () => getSessionsMock.mock.calls[getSessionsMock.mock.calls.length - 1][0];

    it('should send the selected plan and reset to the first page', () => {
      facade.viewModel.update(vm => ({ ...vm, currentPage: 3 }));

      facade.updateFilters({ selectedPlanId: 'plan-2' });

      expect(lastQuery().plan_id).toBe('plan-2');
      expect(lastQuery().offset).toBe(0);
      expect(facade.viewModel().currentPage).toBe(0);
    });

    it('should send the date range bounds from the filter', () => {
      facade.updateFilters({ dateRange: { preset: null, dateFrom: '2026-03-01T00:00:00.000Z', dateTo: '2026-04-01T23:59:59.999Z' } });

      expect(lastQuery().date_from).toBe('2026-03-01T00:00:00.000Z');
      expect(lastQuery().date_to).toBe('2026-04-01T23:59:59.999Z');
    });

    it('should reload with the new page size', () => {
      facade.updateFilters({ pageSize: 5 });

      expect(lastQuery().limit).toBe(5);
    });
  });
});
