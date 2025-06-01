import { Injectable, computed, inject, signal } from '@angular/core';
import { of, forkJoin, from } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { HistoryPageViewModel, HistoryFiltersViewModel } from '@features/history/models/history-page.viewmodel';
import { PlanService } from '@features/plans/api/plan.service';
import { GetSessionsParams, SessionService } from '@features/sessions/api/session.service';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { mapToSessionCardViewModel } from '@features/sessions/models/session.mapping';
import { TrainingSessionDto, TrainingPlanDto, ExerciseDto, UserProfileDto } from '@shared/api/api.types';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';

const initialHistoryPageViewModel: HistoryPageViewModel = {
  sessions: [],
  filters: {
    selectedTrainingPlanId: '',
    dateFrom: null,
    dateTo: null,
    availableTrainingPlans: [],
    pageSize: 10,
    pageSizeOptions: [5, 10, 25, 100],
  },
  totalSessions: 0,
  currentPage: 0,
  isLoading: false,
  error: null,
};

@Injectable({
  providedIn: 'root',
})
export class HistoryPageFacade {
  private readonly planService = inject(PlanService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly profileService = inject(ProfileService);
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);

  readonly viewModel = signal<HistoryPageViewModel>(initialHistoryPageViewModel);
  private readonly internalPlans = signal<TrainingPlanDto[]>([]);
  private readonly internalExercises = signal<ExerciseDto[]>([]);
  private readonly currentUser = computed(() => this.authService.currentUser());

  loadHistoryPageData(): void {
    this.viewModel.update(vm => ({ ...vm, isLoading: true, error: null }));
    const user = this.currentUser();

    forkJoin({
      plans: this.planService.getPlans().pipe(map(res => res.data || []), catchError(() => of([] as TrainingPlanDto[]))),
      exercises: from(this.exerciseService.refresh()).pipe(map(res => res ?? []), catchError(() => of([] as ExerciseDto[]))),
      profile: this.profileService.getUserProfile(user!.id).pipe(map(res => res.data), catchError(() => of(null as UserProfileDto | null)))
    }).pipe(
      tap(({ plans, exercises, profile }) => {
        this.internalPlans.set(plans);
        this.internalExercises.set(exercises);

        const availablePlansForFilter = plans.map(p => ({ id: p.id, name: p.name }));
        const activePlanId = profile?.active_training_plan_id;

        this.viewModel.update(vm => ({
          ...vm,
          filters: {
            ...vm.filters,
            availableTrainingPlans: availablePlansForFilter,
            selectedTrainingPlanId: activePlanId || (availablePlansForFilter.length > 0 ? availablePlansForFilter[0].id : ''),
          }
        }));

        this.loadSessions();
      }),
      catchError((error: Error) => {
        console.error('Error in initial data loading sequence:', error);
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          error: 'Failed to load initial page configuration. Please try again later.'
        }));
        return of(null);
      })
    ).subscribe();
  }

  loadSessions(): void {
    const currentViewModel = this.viewModel();
    const filters = currentViewModel.filters;
    const currentPage = currentViewModel.currentPage;
    const pageSize = currentViewModel.filters.pageSize;

    this.viewModel.update(vm => ({ ...vm, isLoading: true, error: null }));

    const queryParams: GetSessionsParams = {
      limit: pageSize,
      offset: currentPage * pageSize,
      order: 'session_date.desc',
      status: ['COMPLETED'],
      date_from: filters.dateFrom ?? undefined,
      date_to: filters.dateTo ?? undefined,
      plan_id: filters.selectedTrainingPlanId ?? undefined,
    };

    const plansMap = new Map(this.internalPlans().map(p => [p.id, p]));
    const exercises = this.internalExercises();

    this.sessionService.getSessions(queryParams).pipe(
      map(response => {
        if (!response.data) {
          return { sessions: [], totalCount: 0 };
        }
        const mappedSessions = response.data.map((dto: TrainingSessionDto) => {
          const plan = plansMap.get(dto.training_plan_id);
          return mapToSessionCardViewModel(dto, plan!, exercises);
        });
        return { sessions: mappedSessions, totalCount: response.totalCount || 0 };
      }),
      catchError((error: Error) => {
        console.error('Error loading sessions:', error);
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          error: 'Failed to load training sessions. Please try again later.',
          sessions: [],
          totalSessions: 0
        }));
        throw error;
      })
    ).subscribe((result: { sessions: SessionCardViewModel[], totalCount: number }) => {
      this.viewModel.update(vm => ({
        ...vm,
        sessions: result.sessions,
        totalSessions: result.totalCount,
        isLoading: false,
        error: null
      }));
    });
  }

  updateFilters(newFilters: Partial<HistoryFiltersViewModel>): void {
    this.viewModel.update(vm => ({
      ...vm,
      filters: { ...vm.filters, ...newFilters },
      currentPage: 0
    }));
    this.loadSessions();
  }

  updatePagination(currentPage: number, pageSize: number): void {
    this.viewModel.update(vm => ({
      ...vm,
      currentPage,
      pageSize
    }));
    this.loadSessions();
  }
}
