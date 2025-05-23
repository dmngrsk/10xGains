import { inject, signal, computed, Injectable } from '@angular/core';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { EMPTY, forkJoin, of, from } from 'rxjs';
import { PlanService } from '@features/plans/services/plan.service';
import { SessionCardViewModel, SessionCardExerciseViewModel, SessionCardSetViewModel } from '@features/sessions/models/session-card.viewmodel';
import { SessionStatus, SessionSetStatus } from '@features/sessions/models/session.enum';
import { SessionService, GetSessionsParams } from '@features/sessions/services/session.service';
import { TrainingSessionDto, ExerciseDto, TrainingPlanDto } from '@shared/api/api.types';
import { AuthService } from '@shared/services/auth.service';
import { ExerciseService } from '@shared/services/exercise.service';
import { ProfileService } from '@shared/services/profile.service';
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
          displaySessions.push(this.transformSessionToViewModel(sessions[0], plan, exercises));
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

  private transformSessionToViewModel(
    session: TrainingSessionDto,
    plan: TrainingPlanDto,
    allExercises: ExerciseDto[],
  ): SessionCardViewModel {
    const planDay = plan.days?.find(d => d.id === session.training_plan_day_id);

    const sessionExercises: SessionCardExerciseViewModel[] = [];
    if (planDay?.exercises && allExercises) {
      for (const planExercise of planDay.exercises) {
        const exerciseDetail = allExercises.find(e => e.id === planExercise.exercise_id);
        if (exerciseDetail) {
          const relevantSetsDto = session.sets?.filter(s => s.training_plan_exercise_id === planExercise.id) || [];
          const setsViewModel: SessionCardSetViewModel[] = relevantSetsDto.map(dto => ({
            expectedReps: dto.expected_reps,
            actualReps: dto.actual_reps,
            actualWeight: dto.actual_weight,
            status: dto.status as SessionSetStatus,
            completedAt: dto.completed_at ? new Date(this.ensureUtc(dto.completed_at)) : null,
          }));
          sessionExercises.push({
            name: exerciseDetail.name,
            sets: setsViewModel,
          });
        }
      }
    }

    return {
      id: session.id,
      title: planDay?.name || 'N/A',
      sessionDate: session.session_date ? new Date(this.ensureUtc(session.session_date)) : null,
      status: session.status as SessionStatus,
      exercises: sessionExercises,
    };
  }

  private ensureUtc(dateString: string | null | undefined): string {
    if (!dateString) {
      return new Date().toISOString();
    }
    if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
      return dateString;
    }
    return dateString + 'Z';
  }
}
