import { dataCy } from "./selectors";

Cypress.Commands.add('login', login);
Cypress.Commands.add('teardown', teardown);
Cypress.Commands.add('navigateTo', navigateTo);
Cypress.Commands.add('navigateBack', navigateBack);
Cypress.Commands.add('getBySel', getBySel);
Cypress.Commands.add('longPress', { prevSubject: 'element' }, (s, d) => longPress(s, d as unknown as number));

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
      cy.task('users:deleteEphemeral', { userId });
    }
  });

  // Clean up the global exercise created in the test PLAN-05.
  // Cannot be done directly in the test due to RLS policies.
  if (Cypress.currentTestTags?.includes('PLAN-05')) {
    cy.get('@newExerciseName').then((name) => {
      cy.task('exercises:deleteExercise', { name });
    });
  }
}

function navigateTo(button: 'home' | 'plans' | 'history' | 'progress' | 'settings'): void {
  cy.getBySel(`${dataCy.shared.navigation.bottom.prefix}${button}`).click({ force: true });
}

function navigateBack(): void {
  cy.getBySel(dataCy.shared.navigation.back).click({ force: true });
}

function getBySel(selector: string, options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get(`[data-cy=${selector}]`, options);
}

function longPress(element: JQuery<HTMLElement>, duration: number = 500): Cypress.Chainable<JQuery<HTMLElement>> {
  cy.wrap(element).trigger('pointerdown', { button: 0 });
  cy.wait(duration);
  return cy.wrap(element).trigger('pointerup', { force: true });
}

export {};

/**
 * Helper functions for commands
 */
const isSmoke = () => Cypress.currentTestTags?.includes('@smoke') ?? false;
const isStaging = () => Cypress.env('ENVIRONMENT') === 'development' || Cypress.env('ENVIRONMENT') === 'staging';

const getProcessedTestTags = () => {
  const tags = Cypress.currentTestTags ?? [];
  return tags
    .filter(tag => !tag.startsWith('@'))
    .map(tag => tag.toLowerCase().replace(/-/g, ''))
    .join('');
};

function loginAsCanaryUser(): void {
  const email = Cypress.env('CANARY_USER_EMAIL');
  const password = Cypress.env('CANARY_USER_PASSWORD');

  if (!email || !password) {
    throw new Error('Canary user credentials not found in environment variables');
  }

  fillLoginForm(email, password);
}

function loginAsEphemeralUser(): void {
  if (!isStaging()) {
    throw new Error('Ephemeral users can only be created in staging environment');
  }

  cy.task<{ userId: string; email: string; password: string }>('users:createEphemeral', { prefix: getProcessedTestTags() || 'test' })
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
