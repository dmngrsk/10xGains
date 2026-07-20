import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, of, forkJoin } from 'rxjs';
import { SessionDto, PlanDto, ExerciseDto, ProfileDto } from '@txg/shared';
import { addMonths, endOfMonth, endOfQuarter, format, parse, startOfMonth, startOfQuarter } from 'date-fns';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { HistoryPageViewModel, HistoryFiltersViewModel, HistoryViewMode } from '@features/history/models/history-page.viewmodel';
import { PlanService } from '@features/plans/api/plan.service';
import { GetSessionsParams, SessionService } from '@features/sessions/api/session.service';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { mapToSessionCardViewModel } from '@features/sessions/models/session.mapping';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { resetOnUserChange } from '@shared/utils/auth/reset-on-user-change';

const CALENDAR_PAGE_SIZE = 100;
const CALENDAR_PREFETCH_RADIUS = 3;

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
  viewMode: 'list',
  calendarMonth: format(new Date(), 'yyyy-MM'),
  calendarSessions: [],
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

  private readonly calendarMonthSessions = new Map<string, SessionCardViewModel[]>();
  private readonly pendingCalendarMonths = new Set<string>();

  private listNeedsReload = false;

  constructor() {
    resetOnUserChange(() => this.clearUserScopedState());
  }

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

        this.loadActiveViewSessions();
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

    this.sessionService.getSessions(queryParams).pipe(
      map(response => this.mapSessionsResponse(response.data, response.totalCount)),
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

  loadCalendarSessions(): void {
    const { filters, calendarMonth } = this.viewModel();

    const anchor = parse(calendarMonth, 'yyyy-MM', new Date());
    const spanStart = startOfQuarter(addMonths(anchor, -CALENDAR_PREFETCH_RADIUS));
    const spanEnd = endOfQuarter(addMonths(anchor, CALENDAR_PREFETCH_RADIUS));
    const monthsToLoad: string[] = [];
    for (let date = spanStart; date <= spanEnd; date = addMonths(date, 1)) {
      const month = format(date, 'yyyy-MM');
      if (!this.calendarMonthSessions.has(month) && !this.pendingCalendarMonths.has(month)) {
        monthsToLoad.push(month);
      }
    }

    if (monthsToLoad.length === 0) {
      return;
    }

    const isInitialLoad = this.pendingCalendarMonths.size === 0 && this.calendarMonthSessions.size === 0;

    monthsToLoad.forEach(month => this.pendingCalendarMonths.add(month));
    if (isInitialLoad) {
      this.viewModel.update(vm => ({ ...vm, isLoading: true, error: null }));
    }

    for (const run of this.toContiguousRuns(monthsToLoad)) {
      this.loadCalendarBatch(run, filters.selectedPlanId ?? undefined, isInitialLoad);
    }
  }

  seedViewState(viewMode: HistoryViewMode, calendarMonth: string): void {
    this.viewModel.update(vm => ({ ...vm, viewMode, calendarMonth }));
  }

  setViewMode(mode: HistoryViewMode): void {
    if (this.viewModel().viewMode === mode) {
      return;
    }

    if (mode === 'calendar') {
      const { dateRange } = this.viewModel().filters;
      const hadDateRange = !!(dateRange.preset || dateRange.dateFrom || dateRange.dateTo);

      this.viewModel.update(vm => ({
        ...vm,
        viewMode: mode,
        filters: { ...vm.filters, dateRange: { preset: null, dateFrom: null, dateTo: null } },
      }));

      if (hadDateRange) {
        this.listNeedsReload = true;
      }
      this.loadCalendarSessions();
      return;
    }

    if (mode === 'list') {
      this.viewModel.update(vm => ({ ...vm, viewMode: mode }));

      if (this.listNeedsReload) {
        this.listNeedsReload = false;
        this.loadSessions();
      }
    }
  }

  setCalendarMonth(month: string): void {
    this.viewModel.update(vm => ({ ...vm, calendarMonth: month }));
    this.loadCalendarSessions();
  }

  updateCalendarFilters(selectedPlanId: string, month: string): void {
    const planChanged = selectedPlanId !== this.viewModel().filters.selectedPlanId;

    this.viewModel.update(vm => ({
      ...vm,
      filters: { ...vm.filters, selectedPlanId },
      calendarMonth: month,
    }));

    if (planChanged) {
      this.listNeedsReload = true;
      this.clearCalendarCache();
    }

    this.loadCalendarSessions();
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
    const planChanged = newFilters.selectedPlanId !== undefined
      && newFilters.selectedPlanId !== this.viewModel().filters.selectedPlanId;

    this.viewModel.update(vm => ({
      ...vm,
      filters: { ...vm.filters, ...newFilters },
      currentPage: 0
    }));

    if (planChanged) {
      this.clearCalendarCache();
    }

    this.loadSessions();
  }

  updatePagination(currentPage: number, pageSize: number): void {
    // `pageSize` lives on `filters`, which is what `loadSessions` reads. Writing it to the
    // view-model root instead left the request limit pinned at its initial value, so the
    // paginator's page-size selector had no effect.
    this.viewModel.update(vm => ({
      ...vm,
      currentPage,
      filters: { ...vm.filters, pageSize }
    }));
    this.loadSessions();
  }

  private loadActiveViewSessions(): void {
    const { viewMode } = this.viewModel();

    if (viewMode === 'calendar') {
      this.listNeedsReload = true;
      this.loadCalendarSessions();
    }

    if (viewMode === 'list') {
      this.loadSessions();
    }
  }

  private mapSessionsResponse(data: SessionDto[] | null, totalCount: number | undefined): { sessions: SessionCardViewModel[], totalCount: number } {
    if (!data) {
      return { sessions: [], totalCount: 0 };
    }

    const plansMap = new Map(this.internalPlans().map(p => [p.id, p]));
    const exercises = this.internalExercises();
    const sessions = data.map((dto: SessionDto) => {
      const plan = plansMap.get(dto.plan_id);
      return mapToSessionCardViewModel(dto, plan!, exercises);
    });

    return { sessions, totalCount: totalCount || 0 };
  }

  private toContiguousRuns(months: string[]): string[][] {
    const runs: string[][] = [];
    for (const month of months) {
      const run = runs[runs.length - 1];
      if (run && this.addToMonth(run[run.length - 1], 1) === month) {
        run.push(month);
        continue;
      }
      runs.push([month]);
    }
    return runs;
  }

  private loadCalendarBatch(months: string[], planId: string | undefined, isInitialLoad: boolean): void {
    const queryParams: GetSessionsParams = {
      limit: CALENDAR_PAGE_SIZE,
      offset: 0,
      sort: 'session_date.asc',
      status: ['COMPLETED'],
      date_from: startOfMonth(parse(months[0], 'yyyy-MM', new Date())).toISOString(),
      date_to: endOfMonth(parse(months[months.length - 1], 'yyyy-MM', new Date())).toISOString(),
      plan_id: planId,
    };

    // Page through the whole run so a dense window never silently drops sessions (and, with the
    // ascending sort, never drops the most recent - and most likely on-screen - months).
    this.loadAllCalendarPages(queryParams, 0, []).pipe(
      map(response => this.mapSessionsResponse(response.data, response.totalCount)),
      catchError((error: Error) => {
        console.error('Error loading calendar sessions:', error);
        months.forEach(month => this.pendingCalendarMonths.delete(month));
        // A background prefetch failure only logs - it retries on the next scroll; failing the
        // whole view is reserved for the initial load, where there is nothing to show instead.
        if (isInitialLoad) {
          this.viewModel.update(vm => ({
            ...vm,
            isLoading: false,
            error: 'Failed to load sessions. Please try again later.',
            calendarSessions: []
          }));
        }
        return EMPTY;
      })
    ).subscribe((result: { sessions: SessionCardViewModel[], totalCount: number }) => {
      months.forEach(month => {
        this.pendingCalendarMonths.delete(month);
        this.calendarMonthSessions.set(month, []);
      });
      for (const session of result.sessions) {
        if (!session.sessionDate) continue;
        const month = format(session.sessionDate, 'yyyy-MM');
        // Bucket strictly into the requested months - anything else would duplicate sessions
        // already cached by an earlier batch.
        if (!months.includes(month)) continue;
        this.calendarMonthSessions.set(month, [...(this.calendarMonthSessions.get(month) ?? []), session]);
      }

      this.viewModel.update(vm => ({
        ...vm,
        calendarSessions: this.flattenCalendarCache(),
        isLoading: isInitialLoad ? false : vm.isLoading,
        error: null
      }));
    });
  }

  private clearCalendarCache(): void {
    this.calendarMonthSessions.clear();
    this.pendingCalendarMonths.clear();
    this.viewModel.update(vm => ({ ...vm, calendarSessions: [] }));
  }

  private clearUserScopedState(): void {
    this.clearCalendarCache();
    this.internalPlans.set([]);
    this.internalExercises.set([]);
    this.listNeedsReload = true;
    this.viewModel.set(initialHistoryPageViewModel);
  }

  private loadAllCalendarPages(base: GetSessionsParams, offset: number, acc: SessionDto[]): Observable<{ data: SessionDto[], totalCount: number }> {
    return this.sessionService.getSessions({ ...base, offset }).pipe(
      switchMap(response => {
        const page = response.data ?? [];
        const combined = offset === 0 ? page : [...acc, ...page];
        if (page.length < CALENDAR_PAGE_SIZE) {
          return of({ data: combined, totalCount: response.totalCount ?? combined.length });
        }
        return this.loadAllCalendarPages(base, offset + CALENDAR_PAGE_SIZE, combined);
      })
    );
  }

  private addToMonth(month: string, months: number): string {
    return format(addMonths(parse(month, 'yyyy-MM', new Date()), months), 'yyyy-MM');
  }

  private flattenCalendarCache(): SessionCardViewModel[] {
    return [...this.calendarMonthSessions.keys()]
      .sort()
      .flatMap(month => this.calendarMonthSessions.get(month)!);
  }
}
