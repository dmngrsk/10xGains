import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
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

  describe('updatePagination', () => {
    beforeEach(() => {
      configure('plan-1');
      facade.loadHistoryPageData();
    });

    it('should request the selected page size', () => {
      // The paginator's page-size selector is only wired up if the new size reaches the request:
      // writing it to the view-model root instead of `filters` left the limit pinned at 10.
      facade.updatePagination(0, 25);

      expect(lastQuery()).toEqual(expect.objectContaining({ limit: 25, offset: 0 }));
      expect(facade.viewModel().filters.pageSize).toBe(25);
    });

    it('should offset by the selected page size when paging forward', () => {
      facade.updatePagination(2, 25);

      expect(lastQuery()).toEqual(expect.objectContaining({ limit: 25, offset: 50 }));
      expect(facade.viewModel().currentPage).toBe(2);
    });
  });

  describe('when using the list view', () => {
    beforeEach(() => {
      configure('plan-1');
      facade.loadHistoryPageData();
    });

    it('should send the selected plan and reset to the first page', () => {
      facade.viewModel.update(vm => ({ ...vm, currentPage: 3 }));

      facade.updateFilters({ selectedPlanId: 'plan-2' });

      expect(lastQuery().plan_id).toBe('plan-2');
      expect(lastQuery().offset).toBe(0);
      expect(facade.viewModel().currentPage).toBe(0);
    });

    it('should send the date range bounds from the filter', () => {
      facade.updateFilters({ dateRange: { preset: null, dateFrom: '2026-03-01T00:00:00.000Z', dateTo: '2026-04-01T23:59:59.999Z' } });

      expect(lastQuery().date_from).toBe('2026-03-01T00:00:00.000Z');
      expect(lastQuery().date_to).toBe('2026-04-01T23:59:59.999Z');
    });

    it('should reload with the new page size', () => {
      facade.updateFilters({ pageSize: 5 });

      expect(lastQuery().limit).toBe(5);
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
});
