import { dataCy } from '../../support/selectors';

describe('Authentication', { tags: ['@auth'] }, () => {
  beforeEach(() => {
    cy.wrap(null).as('ephemeralUserId');
    cy.visit('/auth/login');
  });

  afterEach(() => {
    cy.teardown();
  });

  describe('when a user is unauthenticated', () => {
    it('allows a user to register and sign in when email verification is disabled', { tags: ['AUTH-01'] }, () => {
      // This test assumes that email verification is DISABLED on the staging Supabase instance.
      // If it fails, please check your Supabase sign in provider settings.
      cy.intercept('POST', '/auth/v1/signup*').as('signup');

      cy.getBySel(dataCy.auth.login.signUpButton).click();
      cy.getBySel(dataCy.auth.register.emailInput).type(`auth01-${Date.now()}@example.com`);
      cy.getBySel(dataCy.auth.register.passwordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.confirmPasswordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.signUpButton).click();

      cy.url().should('include', '/home');
      cy.getBySel(dataCy.home.noActivePlanNotice).should('be.visible');

      cy.wait('@signup').then((interception) => {
        cy.task('users:deleteEphemeral', { userId: interception.response!.body.user.id });
      });
    });

    it('allows a user to register and shows a pending verification notice when email verification is enabled', { tags: ['AUTH-02'] }, () => {
      cy.intercept('POST', '/auth/v1/signup*', { fixture: 'auth/supabase-signup-user-unverified-email.json' }).as('signup');

      cy.getBySel(dataCy.auth.login.signUpButton).click();
      cy.getBySel(dataCy.auth.register.emailInput).type(`auth02-${Date.now()}@example.com`);
      cy.getBySel(dataCy.auth.register.passwordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.confirmPasswordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.signUpButton).click();

      cy.getBySel(dataCy.auth.register.successNotice).should('be.visible');
    });

    it('allows a user to confirm their account with an activation link', { tags: ['AUTH-03'] }, () => {
      // User confirmation is handled directly by the Supabase auth service, so we can't test it here.
      // Instead, we can test that the user is redirected to the login page and that the snack bar message is displayed.
      cy.login();
      cy.visit('auth/callback?type=register');

      cy.url().should('include', '/home');
      cy.getMatSnackBar().should('contain.text', 'Verification successful! Welcome to 10xGains.');
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

    it('allows a user to request a password reset', { tags: ['AUTH-06'] }, () => {
      const email = Cypress.env('CANARY_USER_EMAIL');
      cy.intercept('POST', '/auth/v1/recover*').as('recover');

      cy.getBySel(dataCy.auth.login.resetPasswordButton).click();
      cy.getBySel(dataCy.auth.resetPassword.emailInput).type(email);
      cy.getBySel(dataCy.auth.resetPassword.requestSignInLinkButton).click();

      cy.wait('@recover').then(() => {
        cy.getBySel(dataCy.auth.resetPassword.successNotice).should('be.visible');
      });
    });

    it('allows a user to change their password after clicking the password reset link', { tags: ['AUTH-07'] }, () => {
      // User automatic sign-in is handled directly by the Supabase auth service, so we can't test it here.
      // Instead, we can test that the user is redirected to the settings page and that the password change flow works.
      cy.login();
      cy.visit('auth/callback?type=reset-password');

      cy.url().should('include', '/settings');
      cy.getBySel(dataCy.settings.profile.emailInput).invoke('val').as('email');
      cy.getBySel(dataCy.settings.account.changePasswordDialog.content).should('be.visible');
      cy.getBySel(dataCy.settings.account.changePasswordDialog.newPasswordInput).type('Password123!');
      cy.getBySel(dataCy.settings.account.changePasswordDialog.confirmPasswordInput).type('Password123!');
      cy.getBySel(dataCy.settings.account.changePasswordDialog.submitButton).click();
      cy.getBySel(dataCy.settings.account.changePasswordDialog.content).should('not.exist');
      cy.getBySel(dataCy.settings.account.signOutButton).click();

      cy.get('@email').then((userEmail) => {
        cy.getBySel(dataCy.auth.login.emailInput).type(userEmail as unknown as string);
        cy.getBySel(dataCy.auth.login.passwordInput).type('Password123!');
        cy.getBySel(dataCy.auth.login.signInButton).click();

        cy.url().should('include', '/home');
      });
    });

    it('redirects an unauthenticated user to the login page when visiting a protected page', { tags: ['AUTH-08'] }, () => {
      cy.visit('/home');

      cy.url().should('include', '/auth/login');
    });
  });

  describe('when a user is authenticated', () => {
    it('redirects an authenticated user to the home page when visiting the login page', { tags: ['AUTH-09'] }, () => {
      cy.login();
      cy.visit('/auth/login');

      cy.url().should('include', '/home');
    });

    it('allows a user to sign out and redirects to the login page', { tags: ['AUTH-10'] }, () => {
      cy.login();
      cy.navigateTo('settings');
      cy.getBySel(dataCy.settings.account.signOutButton).click();

      cy.url().should('include', '/auth/login');
    });

    it('prevents unauthorized data access via API or direct URL manipulation (RLS check)', { tags: ['AUTH-11'] }, () => {
      let userId1: string;
      let userId2: string;

      // Sign in as the first ephemeral user and get the plan URL.
      cy.login();
      cy.get('@ephemeralUserId').then((userId) => {
        userId1 = userId as unknown as string;

        cy.navigateTo('plans');
        cy.getBySel(dataCy.plans.planList.viewPlanButton).click();
        cy.getBySel(dataCy.plans.planEdit.metadata).should('be.visible');

        cy.url().then((ephemeralUserPlanUrl) => {
          cy.navigateBack();
          cy.navigateTo('settings');
          cy.getBySel(dataCy.settings.account.signOutButton).click();
          cy.url().should('include', '/auth/login');

          // Sign in as the second ephemeral user and try to access the first user's plan.
          cy.login();
          cy.get('@ephemeralUserId').then((userId) => {
            userId2 = userId as unknown as string;
            cy.visit(ephemeralUserPlanUrl);

            cy.getBySel(dataCy.plans.planEdit.errorNotice).should('be.visible');

            // Clean up the ephemeral users.
            cy.task('users:deleteEphemeral', { userId: userId1 });
            cy.task('users:deleteEphemeral', { userId: userId2 });
            cy.wrap(null).as('ephemeralUserId');
          });
        });
      });
    });

    it('redirects the user to login page when session is expired', { tags: ['AUTH-12'] }, () => {
      cy.login();

      // Clear localStorage to simulate session expiration
      cy.window().then((win) => win.localStorage.clear());
      cy.navigateTo('plans');

      cy.url().should('include', '/auth/login');
    });
  });
});
