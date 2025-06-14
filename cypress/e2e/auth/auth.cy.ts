import { dataCy } from '../../support/selectors';

describe('Authentication', { tags: ['@auth'] }, () => {
  beforeEach(() => {
    cy.visit('/auth/login');
  });

  describe('when a user is unauthenticated', () => {
    it('allows a user to register and sign in when email verification is disabled', { tags: ['AUTH-01'] }, () => {
      // This test assumes that email verification is DISABLED on the staging Supabase instance.
      // If it fails, check your Supabase sign in provider settings.
      cy.intercept('POST', '/auth/v1/signup').as('signup');

      cy.getBySel(dataCy.auth.login.signUpButton).click();
      cy.getBySel(dataCy.auth.register.emailInput).type(`auth01-${Date.now()}@example.com`);
      cy.getBySel(dataCy.auth.register.passwordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.confirmPasswordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.signUpButton).click();

      cy.url().should('include', '/home');
      cy.getBySel(dataCy.home.noActiveTrainingPlanNotice).should('be.visible');

      cy.wait('@signup').then((interception) => {
        cy.wrap(interception.response!.body.user.id).as('ephemeralUserId').then(() => {
          cy.teardown();
        });
      });
    });

    it('allows a user to register and shows a pending verification notice when email verification is enabled', { tags: ['AUTH-02'] }, () => {
      cy.intercept('POST', '/auth/v1/signup', { fixture: 'auth/supabase-signup-user-unverified-email.json' }).as('signup');

      cy.getBySel(dataCy.auth.login.signUpButton).click();
      cy.getBySel(dataCy.auth.register.emailInput).type(`auth02-${Date.now()}@example.com`);
      cy.getBySel(dataCy.auth.register.passwordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.confirmPasswordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.signUpButton).click();

      cy.getBySel(dataCy.auth.register.successNotice).should('be.visible');
    });

    it.skip('TODO: allows a user to confirm their account with an activation link', { tags: ['@todo', 'AUTH-03'] }, () => {
      // Either mock the activation token or set up a real Supabase instance
    });

    it('allows a user to sign in with valid credentials', { tags: ['@smoke', 'AUTH-04'] }, () => {
      cy.login({ forceCanary: true });

      cy.url().should('include', '/home');
    });

    it('disallows a user to sign in with invalid credentials', { tags: ['AUTH-05'] }, () => {
      cy.getBySel(dataCy.auth.login.emailInput).type('auth05-invalid@10xgains.com');
      cy.getBySel(dataCy.auth.login.passwordInput).type('invalidpassword');
      cy.getBySel(dataCy.auth.login.signInButton).click();

      cy.getBySel(dataCy.auth.login.errorMessage).should('contain.text', 'Invalid login credentials');
    });

    it.skip('WIP: allows a user to request a password reset', { tags: ['@todo', 'AUTH-06'] }, () => {
      // intercept Supabase API's password reset request and check whether it was called
    });

    it.skip('TODO: allows a user to change their password after clicking the password reset link', { tags: ['@todo', 'AUTH-07'] }, () => {
      // Either mock the password reset token or set up a real Supabase instance
    });

    it('redirects an unauthenticated user to the login page when visiting a protected page', { tags: ['AUTH-08'] }, () => {
      cy.visit('/home');

      cy.url().should('include', '/auth/login');
    });
  });

  describe('when a user is authenticated', () => {
    it('redirects an authenticated user to the home page when visiting the login page', { tags: ['AUTH-09'] }, () => {
      cy.login({ forceCanary: true });
      cy.visit('/auth/login');

      cy.url().should('include', '/home');
    });

    it('allows a user to sign out and redirects to the login page', { tags: ['AUTH-10'] }, () => {
      cy.login({ forceCanary: true });
      cy.navigateTo('settings');
      cy.getBySel(dataCy.settings.signOutButton).click();

      cy.url().should('include', '/auth/login');
    });

    it('prevents unauthorized data access via API or direct URL manipulation (RLS check)', { tags: ['AUTH-11'] }, () => {
      cy.login();

      cy.navigateTo('plans');
      cy.getBySel(dataCy.plans.planList.viewPlanButton).click();

      cy.url().then((ephemeralUserPlanUrl) => {
        cy.navigateBack();
        cy.navigateTo('settings');
        cy.getBySel(dataCy.settings.signOutButton).click();
        cy.url().should('include', '/auth/login');

        cy.login({ forceCanary: true });
        cy.visit(ephemeralUserPlanUrl);

        cy.getBySel(dataCy.plans.planEdit.errorNotice).should('be.visible');
      });

      cy.teardown();
    });

    it('redirects the user to login page when session is expired', { tags: ['AUTH-12'] }, () => {
      cy.login({ forceCanary: true });

      // Clear localStorage to simulate session expiration
      cy.window().then((win) => win.localStorage.clear());
      cy.navigateTo('plans');

      cy.url().should('include', '/auth/login');
    });
  });
});
