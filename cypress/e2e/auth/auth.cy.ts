describe('Authentication', { tags: ['@auth'] }, () => {
  describe('when viewing the login page', () => {
    it('allows a user to log in with valid credentials', { tags: ['@smoke', 'AUTH-02'] }, () => {
      cy.login();

      cy.url().should('include', '/home');
    });
  });
});
