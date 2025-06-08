describe('Plan Page', () => {
  beforeEach(() => {
    cy.loginAsAppropriateUser();
    cy.navigateTo('plans');
  })

  it('should allow a user to view and navigate to a plan', { tags: ['@smoke', 'PLAN-02'] }, () => {
    cy.getByDataCy('active-plan-card').should('be.visible').and('contain.text', 'Test Training Plan');
    cy.getByDataCy('view-plan-button').click();

    cy.url().should('match', /\/plans\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

    cy.getByDataCy('plan-metadata').should('be.visible').and('contain.text', 'Test Training Plan');
  });
});
