describe('Authentication', { tags: ['@auth'] }, () => {
  beforeEach(() => {
    cy.visit('/auth/login');
  });

  describe('when a user is unauthenticated', () => {
    it('allows a user to register a new account', { tags: ['AUTH-01'] }, () => {
      cy.intercept('POST', '/auth/v1/signup').as('signup');

      cy.getBySel('register-button').click();
      cy.getBySel('email-input', { timeout: 10000 }).type(`test-auth01-${Date.now()}@example.com`);
      cy.getBySel('password-input').type('password');
      cy.getBySel('confirm-password-input').type('password', { force: true });
      cy.getBySel('register-button').click();

      cy.url().should('include', '/home');
      cy.getBySel('no-active-training-plan-notice').should('be.visible');

      cy.wait('@signup').then((interception) => {
        cy.wrap(interception.response!.body.user.id).as('ephemeralUserId').then(() => {
          cy.teardown();
        });
      });
    });

    it('allows a user to sign in with valid credentials', { tags: ['@smoke', 'AUTH-02'] }, () => {
      cy.login({ forceCanary: true });

      cy.url().should('include', '/home');
    });

    it('disallows a user to sign in with invalid credentials', { tags: ['AUTH-03'] }, () => {
      cy.getBySel('email-input', { timeout: 10000 }).type('invalid@example.com');
      cy.getBySel('password-input').type('invalidpassword');
      cy.getBySel('login-button').click();

      cy.get('mat-snack-bar-container').should('be.visible').and('contain.text', 'Invalid email or password');
    });

    it('redirects an unauthenticated user to the login page when visiting a protected page', { tags: ['AUTH-04'] }, () => {
      cy.visit('/home');

      cy.url().should('include', '/auth/login');
    });
  });

  describe('when a user is authenticated', () => {
    it('redirects an authenticated user to the home page when visiting the login page', { tags: ['AUTH-05'] }, () => {
      cy.login({ forceCanary: true });
      cy.visit('/auth/login');

      cy.url().should('include', '/home');
    });

    it('allows a user to sign out and redirects to the login page', { tags: ['AUTH-06'] }, () => {
      cy.login({ forceCanary: true });
      cy.navigateTo('settings');
      cy.getBySel('sign-out-button').click();

      cy.url().should('include', '/auth/login');
    });

    it('prevents unauthorized data access via API or direct URL manipulation (RLS check)', { tags: ['AUTH-07'] }, () => {
      cy.login();

      cy.navigateTo('plans');
      cy.getBySel('view-plan-button').click();

      cy.url().then((ephemeralUserPlanUrl) => {
        cy.navigateBack();
        cy.navigateTo('settings');
        cy.getBySel('sign-out-button').click();

        cy.login({ forceCanary: true });
        cy.visit(ephemeralUserPlanUrl);

        cy.getBySel('plan-edit-error-notice').should('be.visible');
      });

      cy.teardown();
    });
  });
});
