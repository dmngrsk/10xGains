import { inject, signal, computed, Injectable } from '@angular/core';
import { EMPTY, forkJoin, of, from } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { PlanService } from '@features/plans/services/plan.service';
import { SessionService, GetSessionsParams } from '@features/sessions/api/session.service';
import { SessionCardViewModel, mapToSesssionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { TrainingSessionDto, ExerciseDto, TrainingPlanDto } from '@shared/api/api.types';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { HomePageViewModel } from '../../models/home-page.viewmodel';

const initialState: HomePageViewModel = {
  isLoading: true,
  error: null,
  name: null,
  activeTrainingPlanId: null,
  sessions: [],
};

@Injectable({
  providedIn: 'root',
})
export class HomePageFacade {
  private readonly authService = inject(AuthService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly planService = inject(PlanService);
  private readonly profileService = inject(ProfileService);
  private readonly sessionService = inject(SessionService);

  readonly viewModel = signal<HomePageViewModel>(initialState);
  private readonly currentUser = computed(() => this.authService.currentUser());

  loadHomePageData(): void {
    this.viewModel.update(state => ({ ...state, isLoading: true, error: null }));
    const user = this.currentUser();
    if (!user) {
      this.viewModel.set({ ...initialState, isLoading: false, error: 'User not authenticated.' });
      return;
    }

    this.profileService.getUserProfile(user.id).pipe(
      switchMap(profileResponse => {
        if (profileResponse.error || !profileResponse.data) {
          this.viewModel.update(state => ({ ...state, isLoading: false, error: profileResponse.error || 'User profile data not found.', sessions: [] }));
          return EMPTY;
        }
        const profile = profileResponse.data;
        this.viewModel.update(state => ({ ...state, name: profile.first_name, activeTrainingPlanId: profile.active_training_plan_id }));
        if (!profile.active_training_plan_id) {
          this.viewModel.update(state => ({ ...state, isLoading: false, sessions: [] }));
          return of({ sessions: [], plan: null, exercises: [] });
        }

        const sessionsParams: GetSessionsParams = {
          order: 'session_date.desc',
          limit: 1,
          status: ['PENDING', 'IN_PROGRESS'],
          plan_id: profile.active_training_plan_id,
        };

        return forkJoin({
          sessions: this.sessionService.getSessions(sessionsParams).pipe(
            map(res => res.data ?? [] as TrainingSessionDto[]),
            catchError(() => of([] as TrainingSessionDto[]))
          ),
          plan: this.planService.getPlan(profile.active_training_plan_id).pipe(
            map(res => res.data),
            catchError(() => of(null as TrainingPlanDto | null))
          ),
          exercises: from(this.exerciseService.refresh()).pipe(
            map(res => res ?? [] as ExerciseDto[]),
            catchError(() => of([] as ExerciseDto[]))
          )
        });
      }),
      map(({ sessions, plan, exercises }) => {
        const currentProfileActivePlanId = this.viewModel().activeTrainingPlanId;

        if (!sessions || !plan || !exercises) {
          if (!currentProfileActivePlanId) {
            return { ...this.viewModel(), isLoading: false, sessions: [] };
          }
          return { ...this.viewModel(), isLoading: false, error: 'Failed to load some home page data.', sessions: [] };
        }

        const displaySessions: SessionCardViewModel[] = [];

        if (sessions.length > 0) {
          displaySessions.push(mapToSesssionCardViewModel(sessions[0], plan, exercises));
        }

        return {
          ...this.viewModel(),
          sessions: displaySessions,
          isLoading: false,
        };
      }),
      catchError((error: Error) => {
        this.viewModel.update(state => ({ ...state, isLoading: false, error: error.message, sessions: [] }));
        return EMPTY;
      })
    ).subscribe(updatedViewModel => {
      if (updatedViewModel && typeof updatedViewModel.isLoading !== 'undefined') {
        this.viewModel.set(updatedViewModel as HomePageViewModel);
      }
    });
  }

  createSession(): void {
    const currentViewModel = this.viewModel();
    if (!currentViewModel.activeTrainingPlanId) {
      console.error('Cannot create session without an active training plan.');
      this.viewModel.update(state => ({ ...state, error: 'Active training plan is required to create a session.', isLoading: false }));
      return;
    }

    this.viewModel.update(state => ({ ...state, isLoading: true, error: null }));

    this.sessionService.createSession(currentViewModel.activeTrainingPlanId).pipe(
      tap(() => {
        this.loadHomePageData();
      }),
      catchError((error: Error) => {
        this.viewModel.update(state => ({ ...state, isLoading: false, error: error.message }));
        return EMPTY;
      })
    ).subscribe();
  }
}
