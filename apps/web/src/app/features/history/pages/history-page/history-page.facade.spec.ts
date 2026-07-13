import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
});
