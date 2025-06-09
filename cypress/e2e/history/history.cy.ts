describe('History Page', { tags: ['@history'] }, () => {
  beforeEach(() => {
    cy.loginAsAppropriateUser();
  });

  describe('within a context with existing sessions', () => {
    beforeEach(() => {
      cy.navigateTo('history');
    });

    it('should show a completed session in the history list', { tags: ['HIST-01'] }, () => {
      cy.getByDataCy('history-session-list').should('exist');
      cy.contains('Workout A').should('exist');
    });

    it('should paginate the session history list when more sessions than page size', { tags: ['HIST-02'] }, () => {
      cy.getByDataCy('history-session-list').getByDataCy('session-card').should('have.length.at.most', 10);
      cy.getByDataCy('history-paginator').should('exist');
      cy.getByDataCy('history-paginator').find('button[aria-label="Next page"]').click();
      cy.getByDataCy('history-session-list').getByDataCy('session-card').should('exist');
    });

    it('should allow filtering by date range', { tags: ['HIST-03'] }, () => {
      cy.getByDataCy('history-filter-button').click();
      cy.get('input[formcontrolname=dateFrom]').clear().type('5/14/2025');
      cy.get('input[formcontrolname=dateTo]').clear().type('5/26/2025');
      cy.get('button').contains('Apply Filters').click();
      cy.getByDataCy('history-session-list').getByDataCy('session-card').should('have.length', 6); // filtered by date range
    });

    it('should highlight the filter button when a filter is active', { tags: ['HIST-04'] }, () => {
      cy.getByDataCy('history-filter-button').click();
      cy.get('input[formcontrolname=dateFrom]').clear().type('5/14/2025');
      cy.get('input[formcontrolname=dateTo]').clear().type('5/26/2025');
      cy.get('button').contains('Apply Filters').click();
      cy.getByDataCy('history-filter-button').should('have.class', 'filter-specified');
    });
  });

  describe('within a context where error handling is necessary', () => {
    it('should show the empty state notice when no sessions match the filter', { tags: ['HIST-05'] }, () => {
      cy.intercept({ method: 'GET', url: '/functions/v1/training-sessions*' }, { statusCode: 200, body: [] });
      cy.navigateTo('history');
      cy.getByDataCy('history-empty-notice').should('exist');
    });

    it('should display an error notice if the session history fails to load', { tags: ['HIST-06'] }, () => {
      cy.intercept({ method: 'GET', url: '/functions/v1/training-sessions*' }, { statusCode: 500, body: { error: 'Cypress mock error response' } });
      cy.navigateTo('history');
      cy.getByDataCy('history-error-notice').should('exist');
    });

    it('should reload the session history list when the user clicks the retry button', { tags: ['HIST-07'] }, () => {
      cy.intercept({ method: 'GET', url: '/functions/v1/training-sessions*', times: 1 }, { statusCode: 500, body: { error: 'Cypress mock error response' } });
      cy.navigateTo('history');
      cy.getByDataCy('history-error-notice').should('exist');
      cy.getByDataCy('history-error-notice').find('button').contains('Try Again').click();
      cy.getByDataCy('history-session-list').should('exist');
    });
  });
});
