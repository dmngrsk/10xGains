import { dataCy } from '../../support/selectors';

describe('Authentication', { tags: ['@auth'] }, () => {
  beforeEach(() => {
    cy.wrap(null).as('ephemeralUserId');
    cy.visit('/auth');
  });

  afterEach(() => {
    cy.teardown();
  });

  describe('Welcome screen', () => {
    it('opens the email sign-in form when the user chooses email', { tags: ['AUTH-01'] }, () => {
      cy.getBySel(dataCy.auth.welcome.emailButton).click();

      cy.url().should('include', '/auth/login');
      cy.getBySel(dataCy.auth.login.emailInput).should('be.visible');
      cy.getBySel(dataCy.auth.login.passwordInput).should('be.visible');
    });
  });

  describe('Registration', () => {
    it('registers a new user and signs them in when email verification is disabled', { tags: ['AUTH-02'] }, () => {
      // This test assumes that email verification is DISABLED on the staging Supabase instance.
      // If it fails, please check your Supabase sign in provider settings.
      cy.intercept('POST', '/auth/v1/signup*').as('signup');

      cy.getBySel(dataCy.auth.welcome.emailButton).click();
      cy.getBySel(dataCy.auth.login.signUpButton).click();
      cy.getBySel(dataCy.auth.register.emailInput).type(`auth02-${Date.now()}@example.com`);
      cy.getBySel(dataCy.auth.register.passwordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.confirmPasswordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.signUpButton).click();

      cy.url().should('include', '/home');
      cy.getBySel(dataCy.home.noActivePlanNotice).should('be.visible');

      cy.wait('@signup').then((interception) => {
        cy.task('users:delete', { userId: interception.response!.body.user.id });
      });
    });

    it('shows a pending verification notice when email verification is enabled', { tags: ['AUTH-03'] }, () => {
      cy.intercept('POST', '/auth/v1/signup*', { fixture: 'auth/supabase-signup-user-unverified-email.json' }).as('signup');

      cy.getBySel(dataCy.auth.welcome.emailButton).click();
      cy.getBySel(dataCy.auth.login.signUpButton).click();
      cy.getBySel(dataCy.auth.register.emailInput).type(`auth03-${Date.now()}@example.com`);
      cy.getBySel(dataCy.auth.register.passwordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.confirmPasswordInput).type('Password123!');
      cy.getBySel(dataCy.auth.register.signUpButton).click();

      cy.getBySel(dataCy.auth.register.successNotice).should('be.visible');
    });

    it('confirms a new account via the activation link', { tags: ['AUTH-04'] }, () => {
      // Supabase handles the confirmation link itself, so we assert the app's callback behaviour:
      // the user is signed in, and the success snackbar is shown.
      cy.login();
      cy.visit('auth/callback?type=register');

      cy.url().should('include', '/home');
      cy.getMatSnackBar().should('contain.text', 'Verification successful! Welcome to 10xGains.');
    });
  });

  describe('Email sign-in', () => {
    it('signs in with valid credentials', { tags: ['@smoke', 'AUTH-05'] }, () => {
      cy.login({ forceCanary: true });

      cy.url().should('include', '/home');
    });

    it('rejects invalid credentials with an error message', { tags: ['AUTH-06'] }, () => {
      cy.getBySel(dataCy.auth.welcome.emailButton).click();
      cy.getBySel(dataCy.auth.login.emailInput).type('auth06-invalid@10xgains.com');
      cy.getBySel(dataCy.auth.login.passwordInput).type('invalidpassword');
      cy.getBySel(dataCy.auth.login.signInButton).click();

      // Supabase's own wording ("Invalid login credentials") is mapped to user-facing copy.
      cy.getBySel(dataCy.auth.login.errorMessage).should('contain.text', 'do not match an account');
    });
  });

  describe('Password recovery', () => {
    it('requests a password reset link', { tags: ['AUTH-07'] }, () => {
      cy.intercept('POST', '/auth/v1/recover*').as('recover');

      cy.getBySel(dataCy.auth.welcome.emailButton).click();
      cy.getBySel(dataCy.auth.login.resetPasswordButton).click();
      cy.env<{ CANARY_USER_EMAIL?: string }>(['CANARY_USER_EMAIL']).then(({ CANARY_USER_EMAIL }) => {
        if (!CANARY_USER_EMAIL) {
          throw new Error('Canary user email not found in environment variables');
        }

        cy.getBySel(dataCy.auth.resetPassword.emailInput).type(CANARY_USER_EMAIL);
      });
      cy.getBySel(dataCy.auth.resetPassword.requestSignInLinkButton).click();

      cy.wait('@recover').then(() => {
        cy.getBySel(dataCy.auth.resetPassword.successNotice).should('be.visible');
      });
    });

    it('changes the password after following the reset link', { tags: ['AUTH-08'] }, () => {
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
        cy.getBySel(dataCy.auth.welcome.emailButton).click();
        cy.getBySel(dataCy.auth.login.emailInput).type(userEmail as unknown as string);
        cy.getBySel(dataCy.auth.login.passwordInput).type('Password123!');
        cy.getBySel(dataCy.auth.login.signInButton).click();

        cy.url().should('include', '/home');
      });
    });
  });

  describe('Route protection and session lifecycle', () => {
    it('redirects to the welcome screen when there is no valid session', { tags: ['AUTH-09'] }, () => {
      cy.visit('/home');
      cy.url().should('include', '/auth');
      cy.getBySel(dataCy.auth.welcome.googleButton).should('be.visible');

      cy.login();
      cy.window().then((win) => win.localStorage.clear());
      cy.navigateTo('plans');
      cy.url().should('include', '/auth');
    });

    it('redirects an authenticated user away from the welcome and login screens', { tags: ['AUTH-10'] }, () => {
      cy.login();

      cy.visit('/auth');
      cy.url().should('include', '/home');

      cy.visit('/auth/login');
      cy.url().should('include', '/home');
    });

    it('signs a user out and returns them to the welcome screen', { tags: ['AUTH-11'] }, () => {
      cy.login();
      cy.navigateTo('settings');
      cy.getBySel(dataCy.settings.account.signOutButton).click();

      cy.url().should('include', '/auth');
      cy.getBySel(dataCy.auth.welcome.googleButton).should('be.visible');
    });

    it('prevents unauthorized data access via API or direct URL manipulation (RLS check)', { tags: ['AUTH-12'] }, () => {
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
          cy.url().should('include', '/auth');

          // Sign in as the second ephemeral user and try to access the first user's plan.
          cy.login();
          cy.get('@ephemeralUserId').then((userId) => {
            userId2 = userId as unknown as string;
            cy.visit(ephemeralUserPlanUrl);

            cy.getBySel(dataCy.plans.planEdit.errorNotice).should('be.visible');

            // Clean up the ephemeral users.
            cy.task('users:delete', { userId: userId1 });
            cy.task('users:delete', { userId: userId2 });
            cy.wrap(null).as('ephemeralUserId');
          });
        });
      });
    });
  });

  describe('Google authentication', () => {
    // The real Google leg of the OAuth dance cannot be automated (Google blocks automated
    // sign-ins), so these tests stub the authorize redirect or fabricate the post-OAuth state
    // that the app's callback handles. The Settings connect/disconnect states are covered by the
    // account-settings-card component unit tests.
    it('starts the Google OAuth flow from the welcome screen', { tags: ['AUTH-13'] }, () => {
      cy.intercept('GET', '**/auth/v1/authorize?provider=google*', { statusCode: 200, body: '<html>Google sign-in stub</html>' }).as('authorize');

      cy.getBySel(dataCy.auth.welcome.googleButton).click();

      cy.wait('@authorize');
    });

    it('creates a profile seeded with the Google name on the oauth callback', { tags: ['AUTH-14'] }, () => {
      cy.task<{ userId: string; email: string; password: string }>('users:create', { prefix: 'auth14', scaffold: false, userMetadata: { given_name: 'Ada' } })
        .then(({ userId, email, password }) => {
          cy.getBySel(dataCy.auth.welcome.emailButton).click();
          cy.getBySel(dataCy.auth.login.emailInput).type(email);
          cy.getBySel(dataCy.auth.login.passwordInput).type(password);
          cy.getBySel(dataCy.auth.login.signInButton).click();
          cy.url().should('include', '/home');

          cy.visit('/auth/callback?type=oauth');
          cy.url().should('include', '/home');

          cy.task<{ first_name: string } | null>('profiles:get', { userId }).then((profile) => {
            expect(profile, 'profile created by the oauth callback').to.not.equal(null);
            expect(profile?.first_name, 'first name seeded from Google given_name').to.equal('Ada');
          });

          cy.task('users:delete', { userId });
        });
    });

    it('preserves the existing profile of an auto-linked user on the oauth callback', { tags: ['AUTH-15'] }, () => {
      cy.login();
      cy.navigateTo('settings');
      cy.getBySel(dataCy.settings.profile.nameInput).invoke('val').should('not.be.empty').then((firstName) => {
        cy.visit('/auth/callback?type=oauth');
        cy.url().should('include', '/home');

        cy.navigateTo('settings');
        cy.getBySel(dataCy.settings.profile.nameInput).should('have.value', firstName as unknown as string);
      });
    });
  });
});
