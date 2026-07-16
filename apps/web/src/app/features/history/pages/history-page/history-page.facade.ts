import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, of, forkJoin } from 'rxjs';
import { SessionDto, PlanDto, ExerciseDto, ProfileDto } from '@txg/shared';
import { catchError, map, tap } from 'rxjs/operators';
import { HistoryPageViewModel, HistoryFiltersViewModel } from '@features/history/models/history-page.viewmodel';
import { PlanService } from '@features/plans/api/plan.service';
import { GetSessionsParams, SessionService } from '@features/sessions/api/session.service';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { mapToSessionCardViewModel } from '@features/sessions/models/session.mapping';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';

const initialHistoryPageViewModel: HistoryPageViewModel = {
  sessions: [],
  filters: {
    selectedPlanId: '',
    dateRange: { preset: null, dateFrom: null, dateTo: null },
    availablePlans: [],
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
  private readonly internalPlans = signal<PlanDto[]>([]);
  private readonly internalExercises = signal<ExerciseDto[]>([]);
  private readonly currentUser = computed(() => this.authService.currentUser());

  loadHistoryPageData(): void {
    this.viewModel.update(vm => ({ ...vm, isLoading: true, error: null }));

    const user = this.currentUser();
    if (!user) {
      this.viewModel.update(vm => ({
        ...vm,
        isLoading: false,
        error: 'Failed to load your session. Please sign in again.'
      }));
      return;
    }

    forkJoin({
      plans: this.planService.getPlans().pipe(map(res => res.data || []), catchError(() => of([] as PlanDto[]))),
      exercises: this.exerciseService.getExercises().pipe(map(res => res.data ?? []), catchError(() => of([] as ExerciseDto[]))),
      profile: this.profileService.getProfile(user.id).pipe(map(res => res.data), catchError(() => of(null as ProfileDto | null)))
    }).pipe(
      tap(({ plans, exercises, profile }) => {
        this.internalPlans.set(plans);
        this.internalExercises.set(exercises);

        const availablePlansForFilter = plans.map(p => ({ id: p.id, name: p.name }));
        const activePlanId = profile?.active_plan_id;

        const selectedPlanId = activePlanId && plans.some(p => p.id === activePlanId)
          ? activePlanId
          : (availablePlansForFilter[0]?.id ?? '');

        this.viewModel.update(vm => ({
          ...vm,
          filters: {
            ...vm.filters,
            availablePlans: availablePlansForFilter,
            selectedPlanId,
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
      sort: 'session_date.desc',
      status: ['COMPLETED'],
      date_from: filters.dateRange.dateFrom ?? undefined,
      date_to: filters.dateRange.dateTo ?? undefined,
      plan_id: filters.selectedPlanId ?? undefined,
    };

    const plansMap = new Map(this.internalPlans().map(p => [p.id, p]));
    const exercises = this.internalExercises();

    this.sessionService.getSessions(queryParams).pipe(
      map(response => {
        if (!response.data) {
          return { sessions: [], totalCount: 0 };
        }
        const mappedSessions = response.data.map((dto: SessionDto) => {
          const plan = plansMap.get(dto.plan_id);
          return mapToSessionCardViewModel(dto, plan!, exercises);
        });
        return { sessions: mappedSessions, totalCount: response.totalCount || 0 };
      }),
      catchError((error: Error) => {
        console.error('Error loading sessions:', error);
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          error: 'Failed to load sessions. Please try again later.',
          sessions: [],
          totalSessions: 0
        }));
        return EMPTY;
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

  saveSessionNotes(sessionId: string, notes: string | null): Observable<boolean> {
    return this.sessionService.updateSession(sessionId, { notes }).pipe(
      map(res => !res?.error),
      tap(success => {
        if (!success) return;
        this.viewModel.update(vm => ({
          ...vm,
          sessions: vm.sessions.map(s => s.id === sessionId ? { ...s, notes } : s)
        }));
      }),
      catchError(err => {
        console.error(`Failed to save notes for session ${sessionId}:`, err);
        return of(false);
      })
    );
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
