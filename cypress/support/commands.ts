/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Smart login command that automatically determines the appropriate login strategy
       * based on test environment and \@smoke tag presence.
       * @param options Optional configuration to override default behavior.
       */
      loginAsAppropriateUser(options?: { forceCanary?: boolean; customEmail?: string }): ReturnType<typeof loginAsAppropriateUser>;

      /**
       * Get one or more DOM elements by their data-cy attribute value.
       * @param selector The data-cy attribute value of the element to get.
       * @returns A chainable object that can be used to interact with the element.
       */
      getByDataCy(selector: string): ReturnType<typeof getByDataCy>;

      /**
       * Navigate to a page by clicking the appropriate button.
       * @param button The button to click.
       * @returns A chainable object that can be used to interact with the element.
       */
      navigateTo(button: 'home' | 'plans' | 'history' | 'progress' | 'settings'): ReturnType<typeof navigateTo>;
    }

    interface Cypress {
      /**
       * Tags associated with the current test.
       */
      currentTestTags?: string[];
    }
  }
}

Cypress.Commands.add('loginAsAppropriateUser', loginAsAppropriateUser);
Cypress.Commands.add('getByDataCy', getByDataCy);
Cypress.Commands.add('navigateTo', navigateTo);

function loginAsAppropriateUser(): void {
  const useCanaryUser = isSmoke() || !isStaging();
  return useCanaryUser ? loginAsCanaryUser() : loginAsEphemeralUser();
}

function getByDataCy(selector: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get(`[data-cy=${selector}]`);
}

function navigateTo(button: 'home' | 'plans' | 'history' | 'progress' | 'settings'): void {
  cy.getByDataCy(`bottom-navigation-${button}`).click();
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
}
