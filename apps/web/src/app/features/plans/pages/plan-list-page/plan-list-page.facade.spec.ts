import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ExerciseDto, PlanDto, ProfileDto } from '@txg/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { PlanListPageFacade } from './plan-list-page.facade';
import { PlanService } from '../../api/plan.service';

const USER = { id: 'user-1' };
const PLAN_ID = 'plan-1';

// The loader treats an empty exercise catalog as a failure, so the fixture needs at least one.
const EXERCISES = [{ id: 'ex-1', name: 'Squat', description: null }] as ExerciseDto[];

const PLAN = {
  id: PLAN_ID,
  user_id: USER.id,
  name: 'Starting Strength',
  description: null,
  days: [],
} as unknown as PlanDto;

const profileWithActivePlan = (activePlanId: string | null) =>
  ({ data: { id: USER.id, active_plan_id: activePlanId } as ProfileDto, error: null });

describe('PlanListPageFacade', () => {
  let facade: PlanListPageFacade;
  let planService: {
    getPlans: ReturnType<typeof vi.fn>;
    getPlan: ReturnType<typeof vi.fn>;
  };
  let profileService: { getProfile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // `GET /plans` returns every plan the user owns, the active one included; the list is what
    // filters it out, which is why this fixture is the duplication scenario in miniature.
    planService = {
      getPlans: vi.fn().mockReturnValue(of({ data: [PLAN], totalCount: 1, error: null })),
      getPlan: vi.fn().mockReturnValue(of({ data: PLAN, error: null })),
    };
    profileService = {
      getProfile: vi.fn().mockReturnValue(of(profileWithActivePlan(PLAN_ID))),
    };

    TestBed.configureTestingModule({
      providers: [
        PlanListPageFacade,
        { provide: AuthService, useValue: { currentUser: signal(USER), currentUser$: of(USER) } },
        { provide: PlanService, useValue: planService },
        { provide: ProfileService, useValue: profileService },
        { provide: ExerciseService, useValue: { getExercises: vi.fn().mockReturnValue(of({ data: EXERCISES, error: null })) } },
      ],
    });
    facade = TestBed.inject(PlanListPageFacade);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('the active plan', () => {
    it('should show an active plan on the card and keep it out of the general list', () => {
      facade.loadPlanData();

      expect(facade.viewModel().activePlan?.id).toBe(PLAN_ID);
      expect(facade.viewModel().plans).toEqual([]);
    });

    it('should stop showing a deactivated plan as active on the next load', () => {
      // The facade is a root singleton, so its cached active plan outlives the page. Deactivating
      // and navigating back used to render the plan twice: the card from the stale cache, and a
      // row in the list, which derives `isActive` from the freshly fetched profile.
      facade.loadPlanData();
      profileService.getProfile.mockReturnValue(of(profileWithActivePlan(null)));

      facade.loadPlanData();

      expect(facade.viewModel().activePlan).toBeNull();
      expect(facade.viewModel().plans.map(p => p.id)).toEqual([PLAN_ID]);
    });

    it('should replace the cached active plan when a different plan is activated', () => {
      const otherPlan = { ...PLAN, id: 'plan-2', name: 'GZCLP' } as PlanDto;
      facade.loadPlanData();

      planService.getPlans.mockReturnValue(of({ data: [PLAN, otherPlan], totalCount: 2, error: null }));
      planService.getPlan.mockReturnValue(of({ data: otherPlan, error: null }));
      profileService.getProfile.mockReturnValue(of(profileWithActivePlan('plan-2')));
      facade.loadPlanData();

      expect(facade.viewModel().activePlan?.id).toBe('plan-2');
      expect(facade.viewModel().plans.map(p => p.id)).toEqual([PLAN_ID]);
    });
  });
});
