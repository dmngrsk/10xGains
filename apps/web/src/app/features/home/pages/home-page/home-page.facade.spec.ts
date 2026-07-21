import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProfileDto } from '@txg/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanService } from '@features/plans/api/plan.service';
import { SessionService } from '@features/sessions/api/session.service';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { HomePageFacade } from './home-page.facade';

const USER = { id: 'user-1' };
const ACTIVE_PLAN_ID = 'plan-1';

describe('HomePageFacade', () => {
  let facade: HomePageFacade;
  let sessionService: {
    createSession: ReturnType<typeof vi.fn>;
    completeSession: ReturnType<typeof vi.fn>;
    getSessions: ReturnType<typeof vi.fn>;
  };

  const profile = { id: USER.id, first_name: 'Ada', active_plan_id: ACTIVE_PLAN_ID } as ProfileDto;

  beforeEach(() => {
    sessionService = {
      createSession: vi.fn().mockReturnValue(of({ data: { id: 'session-new' }, error: null })),
      completeSession: vi.fn().mockReturnValue(of({ data: { id: 'session-old' }, error: null })),
      getSessions: vi.fn().mockReturnValue(of({ data: [], error: null })),
    };

    TestBed.configureTestingModule({
      providers: [
        HomePageFacade,
        { provide: AuthService, useValue: { currentUser: signal(USER), currentUser$: of(USER) } },
        { provide: ProfileService, useValue: { getProfile: vi.fn().mockReturnValue(of({ data: profile, error: null })) } },
        { provide: PlanService, useValue: { getPlan: vi.fn().mockReturnValue(of({ data: null, error: null })) } },
        { provide: ExerciseService, useValue: { getExercises: vi.fn().mockReturnValue(of({ data: [], error: null })) } },
        { provide: SessionService, useValue: sessionService },
      ],
    });
    facade = TestBed.inject(HomePageFacade);
    facade.viewModel.update(state => ({ ...state, activePlanId: ACTIVE_PLAN_ID, isLoading: false }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('abandonSession', () => {
    it('should start a new session for the active plan', () => {
      facade.abandonSession();

      expect(sessionService.createSession).toHaveBeenCalledWith(ACTIVE_PLAN_ID);
    });

    it('should never complete the abandoned session', () => {
      // Completing it would mark a half-finished workout COMPLETED, skip its pending sets and
      // apply weight progressions from it - and for a PENDING session the API rejects completion,
      // which used to dead-end the user with an error and no new session.
      facade.abandonSession();

      expect(sessionService.completeSession).not.toHaveBeenCalled();
    });

    it('should surface an error without creating a session when no plan is active', () => {
      facade.viewModel.update(state => ({ ...state, activePlanId: null }));

      facade.abandonSession();

      expect(sessionService.createSession).not.toHaveBeenCalled();
      expect(facade.viewModel().error).toBe('Active plan is required to create a session.');
    });

    it('should report a failed creation on the view model', () => {
      sessionService.createSession.mockReturnValue(throwError(() => new Error('Creation failed')));

      facade.abandonSession();

      expect(facade.viewModel().error).toBe('Creation failed');
      expect(facade.viewModel().isLoading).toBe(false);
    });
  });
});
