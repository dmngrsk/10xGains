describe('Auth Page', { tags: ['@auth'] }, () => {
  it('should log in a user with valid credentials', { tags: ['@smoke', 'AUTH-02'] }, () => {
    cy.loginAsAppropriateUser();

    cy.url().should('include', '/home');
  });
});
