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
        cy.task('users:delete', { userId: interception.response!.body.user.id });
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
      cy.intercept('POST', '/auth/v1/recover*').as('recover');

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
            cy.task('users:delete', { userId: userId1 });
            cy.task('users:delete', { userId: userId2 });
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

  describe('Google authentication', () => {
    // The real Google leg of the OAuth dance cannot be automated (Google blocks automated
    // sign-ins), so these tests stub the authorize redirect, fabricate the post-OAuth state
    // that the app's callback handles, or mock the identities Supabase reports.
    const mockGoogleIdentity = (userId: string) => ({
      identity_id: '00000000-0000-4000-8000-000000000000',
      id: userId,
      user_id: userId,
      identity_data: { email: 'mock-google-user@gmail.com', email_verified: true, sub: 'mock-google-sub' },
      provider: 'google',
      last_sign_in_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    it('starts the Google OAuth flow from the login page', { tags: ['AUTH-13'] }, () => {
      cy.intercept('GET', '**/auth/v1/authorize?provider=google*', { statusCode: 200, body: '<html>Google sign-in stub</html>' }).as('authorize');

      cy.getBySel(dataCy.auth.login.googleButton).click();

      cy.wait('@authorize');
    });

    it('starts the Google OAuth flow from the register page', { tags: ['AUTH-14'] }, () => {
      cy.intercept('GET', '**/auth/v1/authorize?provider=google*', { statusCode: 200, body: '<html>Google sign-in stub</html>' }).as('authorize');

      cy.getBySel(dataCy.auth.login.signUpButton).click();
      cy.getBySel(dataCy.auth.register.googleButton).click();

      cy.wait('@authorize');
    });

    it('creates a profile seeded with the Google name on the oauth callback', { tags: ['AUTH-15'] }, () => {
      cy.task<{ userId: string; email: string; password: string }>('users:create', { prefix: 'auth15', scaffold: false, userMetadata: { given_name: 'Ada' } })
        .then(({ userId, email, password }) => {
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

    it('preserves the existing profile of an auto-linked user on the oauth callback', { tags: ['AUTH-16'] }, () => {
      cy.login();
      cy.navigateTo('settings');
      cy.getBySel(dataCy.settings.profile.nameInput).invoke('val').should('not.be.empty').then((firstName) => {
        cy.visit('/auth/callback?type=oauth');
        cy.url().should('include', '/home');

        cy.navigateTo('settings');
        cy.getBySel(dataCy.settings.profile.nameInput).should('have.value', firstName as unknown as string);
      });
    });

    it('shows Google as not connected for a password-only account', { tags: ['AUTH-17'] }, () => {
      cy.login();
      cy.navigateTo('settings');

      cy.getBySel(dataCy.settings.account.connectGoogleButton).should('be.visible');
      cy.getBySel(dataCy.settings.account.disconnectGoogleButton).should('not.exist');
    });

    it('shows Google as connected with an enabled disconnect for a linked account', { tags: ['AUTH-18'] }, () => {
      cy.login();
      cy.intercept('GET', '**/auth/v1/user*', (req) => {
        req.continue((res) => {
          res.body.identities = [...(res.body.identities ?? []), mockGoogleIdentity(res.body.id)];
        });
      });
      cy.navigateTo('settings');

      cy.getBySel(dataCy.settings.account.disconnectGoogleButton).should('be.enabled');
      cy.getBySel(dataCy.settings.account.connectGoogleButton).should('not.exist');
    });

    it('disables disconnecting Google when it is the only sign-in method', { tags: ['AUTH-19'] }, () => {
      cy.login();
      cy.intercept('GET', '**/auth/v1/user*', (req) => {
        req.continue((res) => {
          res.body.identities = [mockGoogleIdentity(res.body.id)];
        });
      });
      cy.navigateTo('settings');

      cy.getBySel(dataCy.settings.account.disconnectGoogleButton).should('be.disabled');
    });
  });
});
