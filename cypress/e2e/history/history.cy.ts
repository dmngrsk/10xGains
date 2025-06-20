import { dataCy } from '../../support/selectors';

describe('Session History', { tags: ['@history'] }, () => {
  beforeEach(() => {
    cy.login();
  });

  afterEach(() => {
    cy.teardown();
  });

  describe('when viewing the history page with completed sessions', () => {
    beforeEach(() => {
      cy.navigateTo('history');
    });

    it('shows a completed session in the history list', { tags: ['HIST-01'] }, () => {
      cy.getBySel(dataCy.history.sessionList).should('exist');
      cy.getBySel(dataCy.history.sessionCard).should('contain.text', 'Workout A');
    });

    it('paginates the session history list when more sessions than page size', { tags: ['HIST-02'] }, () => {
      cy.getBySel(dataCy.history.paginator).should('exist');
      cy.getBySel(dataCy.history.paginator).find('button[aria-label="Next page"]').click();

      cy.getBySel(dataCy.history.sessionList).getBySel(dataCy.history.sessionCard).should('exist');
    });

    it('allows filtering by date range', { tags: ['HIST-03'] }, () => {
      cy.getBySel(dataCy.history.filterButton).click();
      cy.getBySel(dataCy.history.filterDialog.dateFromInput).clear().type('5/14/2025');
      cy.getBySel(dataCy.history.filterDialog.dateToInput).clear().type('5/26/2025');
      cy.getBySel(dataCy.history.filterDialog.applyFiltersButton).click();

      cy.getBySel(dataCy.history.sessionCard).should('have.length', 6); // filtered by date range
    });

    it('highlights the filter button when a filter is active', { tags: ['HIST-04'] }, () => {
      cy.getBySel(dataCy.history.filterButton).click();
      cy.getBySel(dataCy.history.filterDialog.dateFromInput).clear().type('5/14/2025');
      cy.getBySel(dataCy.history.filterDialog.dateToInput).clear().type('5/26/2025');
      cy.getBySel(dataCy.history.filterDialog.applyFiltersButton).click();

      cy.getBySel(dataCy.history.filterButton).should('have.class', '!text-primary');
    });
  });

  describe('when the history page has no completed sessions or encounters errors', () => {
    it('shows the empty state notice when no sessions match the filter', { tags: ['HIST-05'] }, () => {
      cy.intercept('GET', '**/api/training-sessions*', { statusCode: 200, fixture: 'shared/common-data-empty.json' });
      cy.navigateTo('history');

      cy.getBySel(dataCy.history.emptyNotice).should('exist');
    });

    it('displays an error notice if the session history fails to load', { tags: ['HIST-06'] }, () => {
      cy.intercept('GET', '**/api/training-sessions*', { statusCode: 500, fixture: 'shared/common-error.json' });
      cy.navigateTo('history');

      cy.getBySel(dataCy.history.errorNotice).should('exist');
    });

    it('reloads the session history list when the user clicks the retry button', { tags: ['HIST-07'] }, () => {
      cy.intercept({ method: 'GET', url: '**/api/training-sessions*', times: 1 }, { statusCode: 500, fixture: 'shared/common-error.json' });
      cy.navigateTo('history');

      cy.getBySel(dataCy.history.errorNotice).should('exist');
      cy.getBySel(dataCy.history.errorNotice).find('button').contains('Try Again').click();

      cy.getBySel(dataCy.history.sessionList).should('exist');
    });
  });
});
