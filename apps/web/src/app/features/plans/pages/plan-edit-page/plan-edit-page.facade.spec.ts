import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ExerciseDto, PlanDto, ProfileDto } from '@txg/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '@features/sessions/api/session.service';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { PlanEditPageFacade } from './plan-edit-page.facade';
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

describe('PlanEditPageFacade', () => {
  let facade: PlanEditPageFacade;
  let planService: {
    getPlan: ReturnType<typeof vi.fn>;
    updatePlan: ReturnType<typeof vi.fn>;
    createPlanDay: ReturnType<typeof vi.fn>;
  };
  let profileService: { getProfile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    planService = {
      getPlan: vi.fn().mockReturnValue(of({ data: PLAN, error: null })),
      updatePlan: vi.fn().mockReturnValue(of({ data: PLAN, error: null })),
      createPlanDay: vi.fn().mockReturnValue(of({ data: null, error: null })),
    };
    profileService = {
      getProfile: vi.fn().mockReturnValue(of({ data: { id: USER.id, active_plan_id: null } as ProfileDto, error: null })),
    };

    TestBed.configureTestingModule({
      providers: [
        PlanEditPageFacade,
        { provide: AuthService, useValue: { currentUser: signal(USER), currentUser$: of(USER) } },
        { provide: PlanService, useValue: planService },
        { provide: ProfileService, useValue: profileService },
        { provide: ExerciseService, useValue: { getExercises: vi.fn().mockReturnValue(of({ data: EXERCISES, error: null })) } },
        { provide: SessionService, useValue: { getSessions: vi.fn().mockReturnValue(of({ data: [], totalCount: 0, error: null })) } },
      ],
    });
    facade = TestBed.inject(PlanEditPageFacade);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('should surface a thrown mutation error on the view model', () => {
      // The message must land on `error`, the field the template renders. Writing it to a
      // non-existent `message` property left the user with no feedback at all.
      facade.loadPlanData(PLAN_ID);
      planService.updatePlan.mockReturnValue(throwError(() => new Error('Update exploded')));

      facade.updatePlan({ name: 'New name' }).subscribe();

      expect(facade.viewModel().error).toBe('Update exploded');
      expect(facade.viewModel().isLoading).toBe(false);
    });

    it('should keep the loaded plan when a mutation fails', () => {
      // Discarding the plan blanked the entire editor over a single failed edit.
      facade.loadPlanData(PLAN_ID);
      const planBefore = facade.viewModel().plan;
      expect(planBefore).not.toBeNull();

      planService.createPlanDay.mockReturnValue(throwError(() => new Error('Day creation failed')));
      facade.createPlanDay({ name: 'Day A' }).subscribe();

      expect(facade.viewModel().error).toBe('Day creation failed');
      expect(facade.viewModel().plan).toEqual(planBefore);
    });

    it('should surface a load failure as an error message', () => {
      planService.getPlan.mockReturnValue(throwError(() => new Error('Plan fetch failed')));

      facade.loadPlanData(PLAN_ID);

      expect(facade.viewModel().error).toBe('Plan fetch failed');
      expect(facade.viewModel().isLoading).toBe(false);
    });

    it('should prefer an error envelope string over the default message', () => {
      facade.loadPlanData(PLAN_ID);
      planService.updatePlan.mockReturnValue(throwError(() => ({ error: 'Name already taken' })));

      facade.updatePlan({ name: 'Duplicate' }).subscribe();

      expect(facade.viewModel().error).toBe('Name already taken');
    });
  });
});
