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
      cy.getBySel('history-session-list').should('exist');
      cy.contains('Workout A').should('exist');
    });

    it('paginates the session history list when more sessions than page size', { tags: ['HIST-02'] }, () => {
      cy.getBySel('history-session-list').getBySel('session-card').should('have.length.at.most', 10);
      cy.getBySel('history-paginator').should('exist');
      cy.getBySel('history-paginator').find('button[aria-label="Next page"]').click();

      cy.getBySel('history-session-list').getBySel('session-card').should('exist');
    });

    it('allows filtering by date range', { tags: ['HIST-03'] }, () => {
      cy.getBySel('history-filter-button').click();
      cy.get('input[formcontrolname=dateFrom]').clear().type('5/14/2025');
      cy.get('input[formcontrolname=dateTo]').clear().type('5/26/2025');
      cy.get('button').contains('Apply Filters').click();

      cy.getBySel('history-session-list').getBySel('session-card').should('have.length', 6); // filtered by date range
    });

    it('highlights the filter button when a filter is active', { tags: ['HIST-04'] }, () => {
      cy.getBySel('history-filter-button').click();
      cy.get('input[formcontrolname=dateFrom]').clear().type('5/14/2025');
      cy.get('input[formcontrolname=dateTo]').clear().type('5/26/2025');
      cy.get('button').contains('Apply Filters').click();

      cy.getBySel('history-filter-button').should('have.class', 'filter-specified');
    });
  });

  describe('when the history page has no completed sessions or encounters errors', () => {
    it('shows the empty state notice when no sessions match the filter', { tags: ['HIST-05'] }, () => {
      cy.intercept({ method: 'GET', url: '/functions/v1/training-sessions*' }, { statusCode: 200, body: [] });
      cy.navigateTo('history');

      cy.getBySel('history-empty-notice').should('exist');
    });

    it('displays an error notice if the session history fails to load', { tags: ['HIST-06'] }, () => {
      cy.intercept({ method: 'GET', url: '/functions/v1/training-sessions*' }, { statusCode: 500, body: { error: 'Cypress mock error response' } });
      cy.navigateTo('history');

      cy.getBySel('history-error-notice').should('exist');
    });

    it('reloads the session history list when the user clicks the retry button', { tags: ['HIST-07'] }, () => {
      cy.intercept({ method: 'GET', url: '/functions/v1/training-sessions*', times: 1 }, { statusCode: 500, body: { error: 'Cypress mock error response' } });
      cy.navigateTo('history');

      cy.getBySel('history-error-notice').should('exist');
      cy.getBySel('history-error-notice').find('button').contains('Try Again').click();

      cy.getBySel('history-session-list').should('exist');
    });
  });
});
