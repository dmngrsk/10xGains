import { dataCy } from '../../support/selectors';

interface SessionFixtureDto {
  session_date: string;
}

const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const formatDate = (date: Date): string => `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
const FILTER_DATE_FROM = formatDate(daysAgo(33));
const FILTER_DATE_TO = formatDate(daysAgo(19));

// The calendar tests stub the API for determinism: the canonical fixture holds 15 completed
// sessions on fixed dates - 12 June 2025 session days (the 10th holds two sessions), plus two
// late-May sessions.
const SESSIONS_MONTH = '2025-06';
const EMPTY_MONTH = '2025-07';

// Serves the canonical dataset the way the API would: date-windowed, sorted and paginated.
const stubHistoryApi = (): void => {
  cy.intercept('GET', '**/api/plans*', { statusCode: 200, fixture: 'history/plans-single-plan.json' });
  cy.fixture('history/sessions-completed.json').then(({ data }: { data: SessionFixtureDto[] }) => {
    cy.intercept('GET', '**/api/sessions*', (req) => {
      const dateFrom = req.query['date_from'] ? new Date(String(req.query['date_from'])) : null;
      const dateTo = req.query['date_to'] ? new Date(String(req.query['date_to'])) : null;
      const offset = Number(req.query['offset'] ?? 0);
      const limit = Number(req.query['limit'] ?? data.length);

      const matching = data
        .filter((session) => {
          const sessionDate = new Date(session.session_date);
          return (!dateFrom || sessionDate >= dateFrom) && (!dateTo || sessionDate <= dateTo);
        })
        .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());

      if (String(req.query['sort'] ?? '').endsWith('.desc')) {
        matching.reverse();
      }

      req.reply({ statusCode: 200, body: { data: matching.slice(offset, offset + limit), totalCount: matching.length } });
    });
  });
};

describe('Session History', { tags: ['@history'] }, () => {
  beforeEach(() => {
    cy.login();
  });

  afterEach(() => {
    cy.teardown();
  });

  describe('when using the calendar view', () => {
    describe('with completed sessions', () => {
      beforeEach(() => {
        stubHistoryApi();
        cy.visit(`/history?view=calendar&month=${SESSIONS_MONTH}`);
      });

      it('marks session days with dots', { tags: ['HIST-01'] }, () => {
        cy.getBySel(dataCy.history.calendar).find(`[data-month="${SESSIONS_MONTH}"] .txg-session-day`).should('have.length', 12);
      });

      it('navigates to the session when tapping a single-session day', { tags: ['HIST-02'] }, () => {
        cy.getBySel(dataCy.history.calendar).find(`[data-month="${SESSIONS_MONTH}"] .txg-session-day`).first().click({ scrollBehavior: false });

        cy.location('pathname').should('eq', '/sessions/00000000-0000-4000-8000-000000000003');
      });

      it('opens the session picker when tapping a multi-session day', { tags: ['HIST-03'] }, () => {
        cy.getBySel(dataCy.history.calendar).find('.txg-session-day--multi').click({ scrollBehavior: false });

        cy.getBySel(dataCy.history.sessionPickerDialog.content).should('be.visible');
        cy.getBySel(dataCy.history.sessionPickerDialog.sessionButton).should('have.length', 2);
        cy.getBySel(dataCy.history.sessionPickerDialog.sessionButton).last().click();

        cy.location('pathname').should('eq', '/sessions/66666666-6666-4666-8666-666666666666');
      });

      it('restores the calendar view after navigating back from a session', { tags: ['HIST-04'] }, () => {
        cy.getBySel(dataCy.history.calendar).find(`[data-month="${SESSIONS_MONTH}"] .txg-session-day`).first().click({ scrollBehavior: false });
        cy.location('pathname').should('eq', '/sessions/00000000-0000-4000-8000-000000000003');

        cy.go('back');

        cy.getBySel(dataCy.history.calendar).should('exist');
        cy.location('search').should('contain', 'view=calendar');
        cy.location('search').should('contain', `month=${SESSIONS_MONTH}`);
      });
    });

    describe('when navigating between months', () => {
      beforeEach(() => {
        stubHistoryApi();
      });

      it('scrolls between months and updates the anchored month', { tags: ['HIST-05'] }, () => {
        // The anchored July renders empty while the adjacent June (preloaded with the initial
        // window) carries the dots.
        cy.visit(`/history?view=calendar&month=${EMPTY_MONTH}`);

        // An empty month keeps the calendar, with no dots and no empty-state notice.
        cy.getBySel(dataCy.history.calendar).find(`[data-month="${EMPTY_MONTH}"]`).should('exist');
        cy.getBySel(dataCy.history.calendar).find(`[data-month="${EMPTY_MONTH}"] .txg-session-day`).should('not.exist');
        cy.getBySel(dataCy.history.emptyNotice).should('not.exist');

        cy.getBySel(dataCy.history.calendar).find(`[data-month="${SESSIONS_MONTH}"]`).scrollIntoView();

        cy.getBySel(dataCy.history.calendar).find(`[data-month="${SESSIONS_MONTH}"] .txg-session-day`).should('exist');
        cy.location('search').should('contain', `month=${SESSIONS_MONTH}`);
      });

      it('offers plan and month selection in the filter dialog and jumps to the picked month', { tags: ['HIST-06'] }, () => {
        cy.visit('/history?view=calendar&month=2026-01'); // June 2025 is outside the initially prefetched window.

        cy.getBySel(dataCy.history.filterButton).click();
        cy.getBySel(dataCy.history.filterDialog.monthInput).should('exist');
        cy.getBySel(dataCy.shared.dateRange.startInput).should('not.exist'); // The visible month is the date range.

        cy.get('mat-datepicker-toggle button').click();
        cy.get('.mat-calendar-body-cell-content').contains('2025').click();
        cy.get('.mat-calendar-body-cell-content').contains('JUN').click();
        cy.getBySel(dataCy.history.filterDialog.applyFiltersButton).click();

        cy.location('search').should('contain', `month=${SESSIONS_MONTH}`);
        cy.getBySel(dataCy.history.calendar).find(`[data-month="${SESSIONS_MONTH}"] .txg-session-day`).should('exist');
      });
    });

    describe('with loading errors', () => {
      it('displays an error notice and recovers via the retry button', { tags: ['HIST-07'] }, () => {
        cy.intercept({ method: 'GET', url: '**/api/sessions*', times: 1 }, { statusCode: 500, fixture: 'shared/common-error.json' });
        cy.navigateTo('history');

        cy.getBySel(dataCy.history.errorNotice).should('exist');
        cy.getBySel(dataCy.history.errorNotice).find('button').contains('Try Again').click();

        cy.getBySel(dataCy.history.calendar).should('exist');
      });
    });
  });

  describe('when using the list view', () => {
    describe('with completed sessions', () => {
      beforeEach(() => {
        cy.visit('/history?view=list');
      });

      it('shows a completed session in the history list', { tags: ['HIST-08'] }, () => {
        cy.getBySel(dataCy.history.sessionList).should('exist');
        cy.getBySel(dataCy.history.sessionCard).should('contain.text', 'Workout A');
      });

      it('paginates the session history list when more sessions than page size', { tags: ['HIST-09'] }, () => {
        cy.getBySel(dataCy.history.paginator).should('exist');
        cy.getBySel(dataCy.history.paginator).find('button[aria-label="Next page"]').click();

        cy.getBySel(dataCy.history.sessionList).getBySel(dataCy.history.sessionCard).should('exist');
      });

      it('allows filtering by date range', { tags: ['HIST-10'] }, () => {
        cy.getBySel(dataCy.history.filterButton).click();
        cy.getBySel(dataCy.shared.dateRange.startInput).clear().type(FILTER_DATE_FROM);
        cy.getBySel(dataCy.shared.dateRange.endInput).clear().type(FILTER_DATE_TO);
        cy.getBySel(dataCy.history.filterDialog.applyFiltersButton).click();

        cy.getBySel(dataCy.history.sessionCard).should('have.length', 6); // Filtered by date range.
      });
    });

    describe('with no completed sessions or errors', () => {
      it('shows the empty state notice when no sessions match the filter', { tags: ['HIST-11'] }, () => {
        cy.intercept('GET', '**/api/sessions*', { statusCode: 200, fixture: 'shared/common-data-empty.json' });
        cy.visit('/history?view=list');

        cy.getBySel(dataCy.history.emptyNotice).should('exist');
      });

      it('displays an error notice if the session history fails to load', { tags: ['HIST-12'] }, () => {
        cy.intercept('GET', '**/api/sessions*', { statusCode: 500, fixture: 'shared/common-error.json' });
        cy.visit('/history?view=list');

        cy.getBySel(dataCy.history.errorNotice).should('exist');
      });

      it('reloads the session history list when the user clicks the retry button', { tags: ['HIST-13'] }, () => {
        cy.intercept({ method: 'GET', url: '**/api/sessions*', times: 1 }, { statusCode: 500, fixture: 'shared/common-error.json' });
        cy.visit('/history?view=list');

        cy.getBySel(dataCy.history.errorNotice).should('exist');
        cy.getBySel(dataCy.history.errorNotice).find('button').contains('Try Again').click();

        cy.getBySel(dataCy.history.sessionList).should('exist');
      });
    });

    describe('with a session note', () => {
      it('shows a note indicator on the history entry and opens the note from it', { tags: ['HIST-14'] }, () => {
        stubHistoryApi();
        cy.visit('/history?view=list');

        cy.getBySel(dataCy.history.sessionCard).first().within(() => {
          cy.getBySel(dataCy.history.notesButton).should('be.visible').click();
        });
        cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('have.value', 'Tough workout, felt tired.');
        cy.getBySel(dataCy.sessions.dialogs.notes.planInput).should('not.exist'); // Plan notes are reachable from the session view only.
      });
    });

    it('remembers the last used view without a query parameter', { tags: ['HIST-15'] }, () => {
      // Without a stored value, the calendar is the default.
      cy.navigateTo('history');
      cy.getBySel(dataCy.history.calendar).should('exist');
      cy.getBySel(dataCy.history.paginator).should('not.exist');
      cy.location('search').should('contain', 'view=calendar');

      // Switching to the list is remembered across visits...
      cy.getBySel(dataCy.history.viewToggle).click();
      cy.getBySel(dataCy.history.sessionList).should('exist');
      cy.getBySel(dataCy.history.paginator).should('exist');
      cy.visit('/history');
      cy.getBySel(dataCy.history.sessionList).should('exist');
      cy.location('search').should('contain', 'view=list');

      // ...and so is switching back to the calendar.
      cy.getBySel(dataCy.history.viewToggle).click();
      cy.getBySel(dataCy.history.calendar).should('exist');
      cy.visit('/history');
      cy.getBySel(dataCy.history.calendar).should('exist');
      cy.location('search').should('contain', 'view=calendar');
    });
  });
});
