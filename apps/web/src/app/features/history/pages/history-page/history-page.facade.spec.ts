import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const sessionDto = (id: string, sessionDate: string) => ({
  id,
  user_id: 'user-1',
  plan_id: 'plan-1',
  plan_day_id: 'day-1',
  session_date: sessionDate,
  status: 'COMPLETED',
  notes: null,
  sets: [],
});

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
        { provide: AuthService, useValue: { currentUser: () => user, currentUser$: of(user) } },
      ],
    });
    facade = TestBed.inject(HistoryPageFacade);
  };

  const lastQuery = () => getSessionsMock.mock.calls[getSessionsMock.mock.calls.length - 1][0];

  // The facade persists filter choices to localStorage; start each test from a clean slate so one
  // test's persisted filters do not leak into the next facade's construction.
  beforeEach(() => window.localStorage.clear());

  describe('loadHistoryPageData', () => {
    it('should default the plan filter to the active plan from the profile', () => {
      configure('plan-2');

      facade.loadHistoryPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-2');
      expect(getSessionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: 'plan-2' })
      );
    });

    it('should surface an error when loading sessions fails', () => {
      configure('plan-2');
      getSessionsMock.mockReturnValue(throwError(() => new Error('boom')));

      facade.loadHistoryPageData();

      expect(facade.viewModel().error).toContain('Failed to load sessions');
      expect(facade.viewModel().isLoading).toBe(false);
      expect(facade.viewModel().sessions).toEqual([]);
    });
  });

  describe('loadHistoryPageData without a usable active plan', () => {
    it('should fall back to the first plan when the profile has no active plan', () => {
      configure(null);

      facade.loadHistoryPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-1');
    });

    it('should fall back to the first plan when the active plan no longer exists', () => {
      configure('plan-deleted');

      facade.loadHistoryPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-1');
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

  describe('loadSessions', () => {
    const sessionsPage = (ids: string[], totalCount: number) => of({
      data: ids.map((id, i) => sessionDto(id, `2026-05-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`)),
      totalCount,
      error: null,
    });

    beforeEach(() => {
      configure('plan-1');
      getSessionsMock.mockReturnValue(sessionsPage(['s-1', 's-2'], 5));
      facade.loadHistoryPageData();
    });

    it('should offset the next page by what is already loaded', () => {
      getSessionsMock.mockReturnValue(sessionsPage(['s-3', 's-4'], 5));

      facade.loadSessions(true);

      expect(lastQuery()).toEqual(expect.objectContaining({ limit: 10, offset: 2 }));
    });

    it('should append the next page rather than replace the list', () => {
      getSessionsMock.mockReturnValue(sessionsPage(['s-3', 's-4'], 5));

      facade.loadSessions(true);

      expect(facade.viewModel().sessions.map(s => s.id)).toEqual(['s-1', 's-2', 's-3', 's-4']);
      expect(facade.viewModel().isLoadingMore).toBe(false);
    });

    it('should keep what is loaded when a further page fails', () => {
      getSessionsMock.mockReturnValue(throwError(() => new Error('boom')));

      facade.loadSessions(true);

      expect(facade.viewModel().sessions.map(s => s.id)).toEqual(['s-1', 's-2']);
      expect(facade.viewModel().error).toContain('Failed to load sessions');
      expect(facade.viewModel().isLoadingMore).toBe(false);
    });

    it('should start from the top again when not loading more', () => {
      getSessionsMock.mockReturnValue(sessionsPage(['s-9'], 1));

      facade.loadSessions();

      expect(lastQuery()).toEqual(expect.objectContaining({ offset: 0 }));
      expect(facade.viewModel().sessions.map(s => s.id)).toEqual(['s-9']);
    });
  });

  describe('when using the list view', () => {
    beforeEach(() => {
      configure('plan-1');
      facade.loadHistoryPageData();
    });

    it('should send the selected plan and start the list again from the top', () => {
      facade.updateFilters({ selectedPlanId: 'plan-2' });

      expect(lastQuery().plan_id).toBe('plan-2');
      expect(lastQuery().offset).toBe(0);
    });

    it('should send the date range bounds from the filter', () => {
      facade.updateFilters({ dateRange: { preset: null, dateFrom: '2026-03-01T00:00:00.000Z', dateTo: '2026-04-01T23:59:59.999Z' } });

      expect(lastQuery().date_from).toBe('2026-03-01T00:00:00.000Z');
      expect(lastQuery().date_to).toBe('2026-04-01T23:59:59.999Z');
    });
  });

  describe('when using the calendar view', () => {
    const WINDOW_START = new Date(2026, 0, 1).toISOString();
    const WINDOW_END = new Date(2026, 8, 30, 23, 59, 59, 999).toISOString();

    // The default setup enters through the list view; the 'when seeded before the initial load'
    // group below bootstraps differently and sets itself up instead.
    const configureListSeeded = () => {
      configure('plan-1');
      facade.seedViewState('list', '2026-05');
      facade.loadHistoryPageData();
    };

    describe('when entering the calendar', () => {
      beforeEach(configureListSeeded);

      it('should query the quarter batches covering the anchor window', () => {
        facade.setViewMode('calendar');

        expect(lastQuery()).toEqual(expect.objectContaining({
          status: ['COMPLETED'],
          plan_id: 'plan-1',
          sort: 'session_date.asc',
          limit: 100,
          offset: 0,
          date_from: WINDOW_START,
          date_to: WINDOW_END,
        }));
      });

      it('should clear the date range filter', () => {
        facade.updateFilters({ dateRange: { preset: '1M', dateFrom: new Date(2026, 3, 15).toISOString(), dateTo: null } });

        facade.setViewMode('calendar');

        expect(facade.viewModel().filters.dateRange).toEqual({ preset: null, dateFrom: null, dateTo: null });
        expect(lastQuery().date_from).toBe(WINDOW_START);
        expect(lastQuery().date_to).toBe(WINDOW_END);
      });

      it('should reload the list without date bounds after the calendar cleared the range', () => {
        facade.updateFilters({ dateRange: { preset: '1M', dateFrom: new Date(2026, 3, 15).toISOString(), dateTo: null } });
        facade.setViewMode('calendar');

        facade.setViewMode('list');

        expect(lastQuery().limit).toBe(10); // the list reloads on activation...
        expect(lastQuery().date_from).toBeUndefined(); // ...with the cleared range
        expect(lastQuery().date_to).toBeUndefined();
      });
    });

    describe('when navigating between months', () => {
      beforeEach(configureListSeeded);

      it('should not query at all while the anchor stays within the cached quarters', () => {
        facade.setViewMode('calendar'); // loads Jan-Sep
        const callsBefore = getSessionsMock.mock.calls.length;

        facade.setCalendarMonth('2026-06');

        expect(facade.viewModel().calendarMonth).toBe('2026-06');
        expect(getSessionsMock.mock.calls.length).toBe(callsBefore);
      });

      it('should load the next quarter batch when the anchor nears it', () => {
        facade.setViewMode('calendar'); // loads Jan-Sep

        facade.setCalendarMonth('2026-07'); // the prefetch span now touches Q4

        expect(lastQuery().date_from).toBe(new Date(2026, 9, 1).toISOString());
        expect(lastQuery().date_to).toBe(new Date(2026, 11, 31, 23, 59, 59, 999).toISOString());
      });

      it('should load the full window on a far month jump', () => {
        facade.setViewMode('calendar'); // loads Jan-Sep

        facade.setCalendarMonth('2027-05');

        expect(lastQuery().date_from).toBe(new Date(2027, 0, 1).toISOString());
        expect(lastQuery().date_to).toBe(new Date(2027, 8, 30, 23, 59, 59, 999).toISOString());
      });
    });

    describe('when the plan changes', () => {
      beforeEach(configureListSeeded);

      it('should drop the cache and reload when the plan changes from the calendar', () => {
        facade.setViewMode('calendar');

        facade.updateCalendarFilters('plan-2', '2026-05');
        expect(lastQuery().plan_id).toBe('plan-2'); // the calendar reloads its window eagerly...
        expect(lastQuery().date_from).toBe(WINDOW_START);
        expect(lastQuery().date_to).toBe(WINDOW_END);

        facade.setViewMode('list');
        expect(lastQuery().limit).toBe(10); // ...and the list reloads on its next activation
        expect(lastQuery().plan_id).toBe('plan-2');
      });

      it('should jump months without refetching when the plan is unchanged', () => {
        facade.setViewMode('calendar'); // loads Jan-Sep
        const callsBefore = getSessionsMock.mock.calls.length;

        facade.updateCalendarFilters('plan-1', '2026-06');

        expect(facade.viewModel().calendarMonth).toBe('2026-06');
        expect(getSessionsMock.mock.calls.length).toBe(callsBefore);
      });

      it('should invalidate the calendar cache when the plan changes from the list', () => {
        facade.setViewMode('calendar');
        facade.setViewMode('list');

        facade.updateFilters({ selectedPlanId: 'plan-2' });
        facade.setViewMode('calendar');

        expect(lastQuery().limit).toBe(100); // the calendar refetched instead of reusing the cache
        expect(lastQuery().plan_id).toBe('plan-2');
      });
    });

    describe('with loading errors', () => {
      beforeEach(configureListSeeded);

      it('should page through a window that overflows a single page without dropping sessions', () => {
        const callsBefore = getSessionsMock.mock.calls.length; // the list load already ran in beforeEach
        const page1 = Array.from({ length: 100 }, (_, i) => sessionDto(`p1-${i}`, new Date(2026, 2, 10).toISOString()));
        const page2 = Array.from({ length: 50 }, (_, i) => sessionDto(`p2-${i}`, new Date(2026, 2, 11).toISOString()));
        getSessionsMock
          .mockReturnValueOnce(of({ data: page1, totalCount: 150, error: null }))
          .mockReturnValueOnce(of({ data: page2, totalCount: 150, error: null }));

        facade.setViewMode('calendar');

        const calendarCalls = getSessionsMock.mock.calls.slice(callsBefore);
        expect(calendarCalls.map(call => call[0].offset)).toEqual([0, 100]);
        expect(facade.viewModel().calendarSessions).toHaveLength(150);
        expect(facade.viewModel().isLoading).toBe(false);
      });

      it('should surface an error when the initial calendar load fails', () => {
        getSessionsMock.mockReturnValue(throwError(() => new Error('boom')));

        facade.setViewMode('calendar');

        expect(facade.viewModel().error).toContain('Failed to load sessions');
        expect(facade.viewModel().isLoading).toBe(false);
        expect(facade.viewModel().calendarSessions).toEqual([]);
      });

      it('should keep the calendar usable when a background batch load fails', () => {
        facade.setViewMode('calendar'); // initial window loads fine

        getSessionsMock.mockReturnValue(throwError(() => new Error('boom')));
        facade.setCalendarMonth('2026-07'); // the background load of Q4 fails

        expect(facade.viewModel().error).toBeNull();
        expect(facade.viewModel().isLoading).toBe(false);
      });
    });

    describe('when switching back to the list', () => {
      beforeEach(configureListSeeded);

      it('should not reload the cached list without a date range set', () => {
        facade.setViewMode('calendar');
        const callsBefore = getSessionsMock.mock.calls.length;

        facade.setViewMode('list');

        expect(getSessionsMock.mock.calls.length).toBe(callsBefore);
      });

      it('should not requery cached months when re-entering the calendar', () => {
        facade.setViewMode('calendar');
        facade.setViewMode('list');
        const callsBefore = getSessionsMock.mock.calls.length;

        facade.setViewMode('calendar');

        expect(getSessionsMock.mock.calls.length).toBe(callsBefore);
      });
    });

    describe('when seeded before the initial load', () => {
      it('should load the calendar months instead of the list', () => {
        configure('plan-1');
        facade.seedViewState('calendar', '2026-05');

        facade.loadHistoryPageData();

        expect(getSessionsMock).toHaveBeenCalledOnce();
        expect(lastQuery().limit).toBe(100);
        expect(lastQuery().date_from).toBe(new Date(2026, 0, 1).toISOString()); // the window's first quarter batch

        facade.setViewMode('list');
        expect(lastQuery().limit).toBe(10); // the never-loaded list loads on activation
      });
    });
  });

  describe('filter persistence across navigation', () => {
    it('restores the last chosen filters when the facade is rebuilt', () => {
      // First visit: move the plan and page size away from their defaults.
      configure('plan-1');
      facade.loadHistoryPageData();
      facade.updateFilters({ selectedPlanId: 'plan-2' });
      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-2');

      // Returning from a session opened out of the history view rebuilds the component-scoped
      // facade from scratch. The chosen filters must come back rather than resetting to the
      // active-plan default.
      TestBed.resetTestingModule();
      configure('plan-1');
      facade.loadHistoryPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-2');
      expect(lastQuery()).toEqual(expect.objectContaining({ plan_id: 'plan-2' }));
    });

    it('falls back to the active plan when the persisted plan no longer exists', () => {
      window.localStorage.setItem(
        'txg.history.filters',
        JSON.stringify({ selectedPlanId: 'deleted-plan', dateRange: { preset: null, dateFrom: null, dateTo: null }, pageSize: 10 })
      );

      configure('plan-2');
      facade.loadHistoryPageData();

      expect(facade.viewModel().filters.selectedPlanId).toBe('plan-2');
    });
  });

  describe('notes view', () => {
    const noteSessionDto = (id: string, sessionDate: string, notes: string | null) => ({
      ...sessionDto(id, sessionDate),
      notes,
    });

    const configureListSeeded = () => {
      configure('plan-1');
      facade.seedViewState('list', '2026-05');
      facade.loadHistoryPageData();
    };

    it('should sweep the filtered range and keep only the sessions carrying a note', () => {
      configureListSeeded();
      getSessionsMock.mockReturnValue(of({
        data: [
          noteSessionDto('s-1', '2026-05-02T10:00:00.000Z', 'Felt strong.'),
          noteSessionDto('s-2', '2026-05-03T10:00:00.000Z', null),
          noteSessionDto('s-3', '2026-05-04T10:00:00.000Z', '   '),
          noteSessionDto('s-4', '2026-05-05T10:00:00.000Z', 'Shoulder twinge.'),
        ],
        totalCount: 4,
        error: null,
      }));

      facade.setViewMode('notes');

      expect(facade.viewModel().noteSessions.map(s => s.id)).toEqual(['s-1', 's-4']);
      expect(facade.viewModel().isLoading).toBe(false);
    });

    it('should query the whole range newest first rather than a single page', () => {
      configureListSeeded();

      facade.setViewMode('notes');

      expect(lastQuery()).toEqual(expect.objectContaining({
        status: ['COMPLETED'],
        plan_id: 'plan-1',
        sort: 'session_date.desc',
        limit: 100,
        offset: 0,
      }));
    });

    it('should not re-sweep when the view is re-entered unchanged', () => {
      configureListSeeded();
      facade.setViewMode('notes');
      const callsAfterFirstSweep = getSessionsMock.mock.calls.length;

      facade.setViewMode('list');
      facade.setViewMode('notes');

      // Neither view is stale, so leaving and coming back costs nothing.
      expect(getSessionsMock.mock.calls.length).toBe(callsAfterFirstSweep);
    });

    it('should re-sweep after the filters changed underneath it', () => {
      configureListSeeded();
      facade.setViewMode('notes');
      facade.setViewMode('list');
      facade.updateFilters({ selectedPlanId: 'plan-2' });
      const callsAfterFilterChange = getSessionsMock.mock.calls.length;

      facade.setViewMode('notes');

      expect(getSessionsMock.mock.calls.length).toBe(callsAfterFilterChange + 1);
      expect(lastQuery()).toEqual(expect.objectContaining({ plan_id: 'plan-2', sort: 'session_date.desc' }));
    });

    it('should surface an error when the sweep fails', () => {
      configureListSeeded();
      getSessionsMock.mockReturnValue(throwError(() => new Error('boom')));

      facade.setViewMode('notes');

      expect(facade.viewModel().error).toContain('Failed to load session notes');
      expect(facade.viewModel().isLoading).toBe(false);
      expect(facade.viewModel().noteSessions).toEqual([]);
    });
  });
});
