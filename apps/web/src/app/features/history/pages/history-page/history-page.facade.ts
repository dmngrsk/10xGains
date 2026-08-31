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
import { LocalStorageService } from '@shared/services/local-storage.service';
import { resetOnUserChange } from '@shared/utils/auth/reset-on-user-change';
import { DateRangeValue } from '@shared/utils/dates/date-range-presets';

const SESSION_SWEEP_PAGE_SIZE = 100;
const LIST_PAGE_SIZE = 10;
const CALENDAR_PREFETCH_RADIUS = 3;

const FILTERS_STORAGE_KEY = 'txg.history.filters';

interface PersistedHistoryFilters {
  selectedPlanId: string;
  dateRange: DateRangeValue;
}

const initialHistoryPageViewModel: HistoryPageViewModel = {
  sessions: [],
  filters: {
    selectedPlanId: '',
    dateRange: { preset: null, dateFrom: null, dateTo: null },
    availablePlans: [],
  },
  totalSessions: 0,
  viewMode: 'list',
  notesOnly: false,
  calendarMonth: format(new Date(), 'yyyy-MM'),
  calendarSessions: [],
  noteSessions: [],
  isLoading: false,
  isLoadingMore: false,
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
  private readonly localStorage = inject(LocalStorageService);

  readonly viewModel = signal<HistoryPageViewModel>(initialHistoryPageViewModel);
  private readonly internalPlans = signal<PlanDto[]>([]);
  private readonly internalExercises = signal<ExerciseDto[]>([]);
  private readonly currentUser = computed(() => this.authService.currentUser());

  private readonly calendarMonthSessions = new Map<string, SessionCardViewModel[]>();
  private readonly pendingCalendarMonths = new Set<string>();

  private listNeedsReload = true;
  private loaded = false;
  private notesNeedReload = true;

  constructor() {
    resetOnUserChange(() => this.clearUserScopedState());

    const persisted = this.readPersistedFilters();
    if (persisted) {
      this.viewModel.update(vm => ({
        ...vm,
        filters: { ...vm.filters, selectedPlanId: persisted.selectedPlanId, dateRange: persisted.dateRange }
      }));
    }
  }

  isLoaded(): boolean {
    return this.loaded;
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
      plans: this.planService.getPlans(undefined, undefined, { includeArchived: true }).pipe(map(res => res.data || []), catchError(() => of([] as PlanDto[]))),
      exercises: this.exerciseService.getExercises().pipe(map(res => res.data ?? []), catchError(() => of([] as ExerciseDto[]))),
      profile: this.profileService.getProfile(user.id).pipe(map(res => res.data), catchError(() => of(null as ProfileDto | null)))
    }).pipe(
      tap(({ plans, exercises, profile }) => {
        this.internalPlans.set(plans);
        this.internalExercises.set(exercises);

        const availablePlansForFilter = plans.map(p => ({ id: p.id, name: p.name }));
        const activePlanId = profile?.active_plan_id;

        const restoredPlanId = this.viewModel().filters.selectedPlanId;
        const selectedPlanId = restoredPlanId && plans.some(p => p.id === restoredPlanId)
          ? restoredPlanId
          : activePlanId && plans.some(p => p.id === activePlanId)
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

        this.loaded = true;
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

  loadSessions(isLoadMore = false): void {
    const { filters, sessions } = this.viewModel();

    this.listNeedsReload = false;
    this.viewModel.update(vm => ({
      ...vm,
      isLoading: !isLoadMore,
      isLoadingMore: isLoadMore,
      error: null
    }));

    const queryParams: GetSessionsParams = {
      limit: LIST_PAGE_SIZE,
      offset: isLoadMore ? sessions.length : 0,
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
        this.listNeedsReload = true;
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          isLoadingMore: false,
          error: 'Failed to load sessions. Please try again later.',
          sessions: isLoadMore ? vm.sessions : [],
          totalSessions: isLoadMore ? vm.totalSessions : 0
        }));
        return EMPTY;
      })
    ).subscribe((result: { sessions: SessionCardViewModel[], totalCount: number }) => {
      this.viewModel.update(vm => ({
        ...vm,
        sessions: isLoadMore ? [...vm.sessions, ...result.sessions] : result.sessions,
        totalSessions: result.totalCount,
        isLoading: false,
        isLoadingMore: false,
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

  loadNoteSessions(): void {
    const { filters } = this.viewModel();

    this.notesNeedReload = false;
    this.viewModel.update(vm => ({ ...vm, isLoading: true, error: null }));

    const queryParams: GetSessionsParams = {
      limit: SESSION_SWEEP_PAGE_SIZE,
      offset: 0,
      sort: 'session_date.desc',
      status: ['COMPLETED'],
      date_from: filters.dateRange.dateFrom ?? undefined,
      date_to: filters.dateRange.dateTo ?? undefined,
      plan_id: filters.selectedPlanId ?? undefined,
    };

    this.loadAllSessionPages(queryParams, 0, []).pipe(
      map(response => this.mapSessionsResponse(response.data, response.totalCount)),
      catchError((error: Error) => {
        console.error('Error loading session notes:', error);
        this.notesNeedReload = true;
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          error: 'Failed to load session notes. Please try again later.',
          noteSessions: []
        }));
        return EMPTY;
      })
    ).subscribe((result: { sessions: SessionCardViewModel[], totalCount: number }) => {
      this.viewModel.update(vm => ({
        ...vm,
        noteSessions: result.sessions.filter(session => !!session.notes?.trim()),
        isLoading: false,
        error: null
      }));
    });
  }

  seedViewState(viewMode: HistoryViewMode, calendarMonth: string, notesOnly: boolean): void {
    this.viewModel.update(vm => ({ ...vm, viewMode, calendarMonth, notesOnly }));
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
        this.notesNeedReload = true;
      }
      this.loadCalendarSessions();
      return;
    }

    this.viewModel.update(vm => ({ ...vm, viewMode: mode }));
    this.loadListSessions();
  }

  /**
   * The notes are every session carrying one, not a page of them: a note is rare enough that
   * paging through the sessions to find them would hand the user an empty page at a time. So the
   * narrowed list is swept in full and shown whole, and the load-more sentinel stays away.
   */
  setNotesOnly(notesOnly: boolean): void {
    if (this.viewModel().notesOnly === notesOnly) {
      return;
    }

    this.viewModel.update(vm => ({ ...vm, notesOnly }));
    this.loadListSessions();
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
      this.notesNeedReload = true;
      this.clearCalendarCache();
    }

    this.persistFilters();
    this.loadCalendarSessions();
  }

  saveSessionNotes(sessionId: string, notes: string | null): Observable<boolean> {
    return this.sessionService.updateSession(sessionId, { notes }).pipe(
      map(res => !res?.error),
      tap(success => {
        if (!success) return;
        this.notesNeedReload = true;
        this.viewModel.update(vm => ({
          ...vm,
          sessions: vm.sessions.map(s => s.id === sessionId ? { ...s, notes } : s),
          noteSessions: vm.noteSessions
            .map(s => s.id === sessionId ? { ...s, notes } : s)
            .filter(s => !!s.notes?.trim())
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
      filters: { ...vm.filters, ...newFilters }
    }));

    if (planChanged) {
      this.clearCalendarCache();
    }

    this.listNeedsReload = true;
    this.notesNeedReload = true;
    this.persistFilters();
    this.loadListSessions();
  }

  private loadActiveViewSessions(): void {
    if (this.viewModel().viewMode === 'calendar') {
      this.listNeedsReload = true;
      this.notesNeedReload = true;
      this.loadCalendarSessions();
      return;
    }

    this.loadListSessions();
  }

  /** Loads whichever of the two the list is showing, and only if it has gone stale. */
  private loadListSessions(): void {
    if (this.viewModel().notesOnly) {
      if (this.notesNeedReload) {
        this.loadNoteSessions();
      }
      return;
    }

    if (this.listNeedsReload) {
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
      limit: SESSION_SWEEP_PAGE_SIZE,
      offset: 0,
      sort: 'session_date.asc',
      status: ['COMPLETED'],
      date_from: startOfMonth(parse(months[0], 'yyyy-MM', new Date())).toISOString(),
      date_to: endOfMonth(parse(months[months.length - 1], 'yyyy-MM', new Date())).toISOString(),
      plan_id: planId,
    };

    this.loadAllSessionPages(queryParams, 0, []).pipe(
      map(response => this.mapSessionsResponse(response.data, response.totalCount)),
      catchError((error: Error) => {
        console.error('Error loading calendar sessions:', error);
        months.forEach(month => this.pendingCalendarMonths.delete(month));

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

  private persistFilters(): void {
    const { selectedPlanId, dateRange } = this.viewModel().filters;
    const toPersist: PersistedHistoryFilters = { selectedPlanId, dateRange };
    this.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(toPersist));
  }

  private readPersistedFilters(): PersistedHistoryFilters | null {
    const raw = this.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as PersistedHistoryFilters;
    } catch {
      return null;
    }
  }

  private clearUserScopedState(): void {
    this.clearCalendarCache();
    this.internalPlans.set([]);
    this.internalExercises.set([]);
    this.listNeedsReload = true;
    this.notesNeedReload = true;
    this.loaded = false;
    this.viewModel.set(initialHistoryPageViewModel);
  }

  private loadAllSessionPages(base: GetSessionsParams, offset: number, acc: SessionDto[]): Observable<{ data: SessionDto[], totalCount: number }> {
    return this.sessionService.getSessions({ ...base, offset }).pipe(
      switchMap(response => {
        const page = response.data ?? [];
        const combined = offset === 0 ? page : [...acc, ...page];
        if (page.length < SESSION_SWEEP_PAGE_SIZE) {
          return of({ data: combined, totalCount: response.totalCount ?? combined.length });
        }
        return this.loadAllSessionPages(base, offset + SESSION_SWEEP_PAGE_SIZE, combined);
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
