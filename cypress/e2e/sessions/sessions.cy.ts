describe('Session Page', () => {
  beforeEach(() => {
    cy.loginAsAppropriateUser();
    cy.navigateTo('home');
  });

  it('should allow a user to start a new session from an active plan', { tags: ['@smoke', 'SESS-01'] }, () => {
    cy.getByDataCy('session-card').should('be.visible').and('contain.text', 'Workout A');
    cy.getByDataCy('session-navigate-button').click();

    cy.url().should('match', /\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

    cy.getByDataCy('session-header').should('be.visible').and('contain.text', 'Workout A');
  });
});
