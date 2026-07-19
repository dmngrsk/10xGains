import { dataCy } from '../selectors';

export function registerAuthCommands(): void {
  Cypress.Commands.add('login', login);
  Cypress.Commands.add('teardown', teardown);
}

function login({ forceCanary }: { forceCanary?: boolean } = {}): void {
  const useCanaryUser = forceCanary || isSmoke() || !isStaging();
  return useCanaryUser ? loginAsCanaryUser() : loginAsEphemeralUser();
}

function teardown(): void {
  const usedEphemeralUser = !isSmoke() && isStaging();
  if (!usedEphemeralUser) {
    return;
  }

  cy.get('@ephemeralUserId').then((userId) => {
    if (userId) {
      cy.task('users:delete', { userId });
    }
  });

  // Clean up the global exercise created in the test PLAN-05.
  // Cannot be done directly in the test due to RLS policies.
  if (Cypress.currentTestTags?.includes('PLAN-05')) {
    cy.get('@newExerciseName').then((name) => {
      cy.task('exercises:delete', { name });
    });
  }
}

const isSmoke = () => Cypress.currentTestTags?.includes('@smoke') ?? false;
const isStaging = () => Cypress.expose('ENVIRONMENT') === 'development' || Cypress.expose('ENVIRONMENT') === 'staging';

const getProcessedTestTags = () => {
  const tags = Cypress.currentTestTags ?? [];
  return tags
    .filter(tag => !tag.startsWith('@'))
    .map(tag => tag.toLowerCase().replace(/-/g, ''))
    .join('');
};

function loginAsCanaryUser(): void {
  cy.env<{ CANARY_USER_EMAIL?: string; CANARY_USER_PASSWORD?: string }>(['CANARY_USER_EMAIL', 'CANARY_USER_PASSWORD'])
    .then(({ CANARY_USER_EMAIL, CANARY_USER_PASSWORD }) => {
      const email = CANARY_USER_EMAIL?.trim();
      const password = CANARY_USER_PASSWORD?.trim();

      if (!email || !password) {
        throw new Error('Canary user credentials not found in environment variables');
      }

      cy.task('users:ensureCanaryScaffolded', { email, password });
      fillLoginForm(email, password);
    });
}

function loginAsEphemeralUser(): void {
  if (!isStaging()) {
    throw new Error('Ephemeral users can only be created in staging environment');
  }

  cy.task<{ userId: string; email: string; password: string }>('users:create', { prefix: getProcessedTestTags() || 'test', scaffold: true })
    .then(({ userId, email, password }) => {
      cy.wrap(userId).as('ephemeralUserId');

      fillLoginForm(email, password);
    });
}

function fillLoginForm(email: string, password: string): void {
  cy.visit('/auth/login');

  cy.getBySel(dataCy.auth.login.emailInput).type(email);
  cy.getBySel(dataCy.auth.login.passwordInput).type(password);
  cy.getBySel(dataCy.auth.login.signInButton).click();

  cy.url().should('include', '/home');
  cy.getBySel(dataCy.home.sessionCard).should('exist');
}
