Cypress.Commands.add('loginAsAppropriateUser', loginAsAppropriateUser);
Cypress.Commands.add('getByDataCy', getByDataCy);
Cypress.Commands.add('navigateTo', navigateTo);
Cypress.Commands.add('longPress', { prevSubject: 'element' }, (s, d) => longPress(s, d as unknown as number));

function loginAsAppropriateUser(): void {
  const useCanaryUser = isSmoke() || !isStaging();
  return useCanaryUser ? loginAsCanaryUser() : loginAsEphemeralUser();
}

function getByDataCy(selector: string, options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get(`[data-cy=${selector}]`, options);
}

function navigateTo(button: 'home' | 'plans' | 'history' | 'progress' | 'settings'): void {
  cy.getByDataCy(`bottom-navigation-${button}`).click();
}

function longPress(subject: JQuery<HTMLElement>, duration: number = 500): Cypress.Chainable<JQuery<HTMLElement>> {
  cy.wrap(subject).trigger('pointerdown', { button: 0 });
  cy.wait(duration);
  return cy.wrap(subject).trigger('pointerup', { force: true });
}

export {};

/**
 * Helper functions for commands
 */
const isSmoke = () => Cypress.currentTestTags?.includes('@smoke') ?? false;
const isStaging = () => Cypress.env('ENVIRONMENT') === 'development' || Cypress.env('ENVIRONMENT') === 'staging';

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

  cy.task<{ userId: string; email: string; password: string }>('createEphemeralUser').then(({ userId, email, password }) => {
    cy.wrap(userId).as('ephemeralUserId');

    fillLoginForm(email, password);
  });
}

function fillLoginForm(email: string, password: string): void {
  cy.visit('/auth/login');

  cy.getByDataCy('email-input').type(email);
  cy.getByDataCy('password-input').type(password);
  cy.getByDataCy('login-button').click();

  cy.url().should('include', '/home');
  cy.getByDataCy('session-card').should('exist');
}
