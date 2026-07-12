import { dataCy } from "./selectors";

Cypress.Commands.add('login', login);
Cypress.Commands.add('teardown', teardown);
Cypress.Commands.add('navigateTo', navigateTo);
Cypress.Commands.add('navigateBack', navigateBack);
Cypress.Commands.add('getBySel', getBySel);
Cypress.Commands.add('dragBySel', dragBySel);
Cypress.Commands.add('getMatSnackBar', getMatSnackBar);
Cypress.Commands.add('closeMatSnackBar', closeMatSnackBar);
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

function dragBySel(handleSelector: string, itemSelector: string, fromIndex: number, toIndex: number): void {
  getBySel(itemSelector).eq(toIndex).then(($target) => {
    const { x: targetX, y: targetY } = elementCenter($target[0]);

    getBySel(handleSelector).eq(fromIndex).then(($handle) => {
      const { x: startX, y: startY } = elementCenter($handle[0]);
      const steps = 5;

      cy.wrap($handle).trigger('mousedown', { eventConstructor: 'MouseEvent', button: 0, buttons: 1, detail: 1, clientX: startX, clientY: startY, force: true });

      // CDK moves the dragged element (and its handle) to a hidden overlay under <body> once
      // dragging starts, so subsequent events are dispatched on the document instead of the
      // handle - that's also where CDK's own move/up listeners are bound.
      for (let step = 1; step <= steps; step++) {
        cy.document().trigger('mousemove', {
          eventConstructor: 'MouseEvent',
          button: 0,
          buttons: 1,
          clientX: startX + ((targetX - startX) * step) / steps,
          clientY: startY + ((targetY - startY) * step) / steps,
          force: true,
        });
      }

      cy.document().trigger('mouseup', { eventConstructor: 'MouseEvent', clientX: targetX, clientY: targetY, force: true });
    });
  });
}

function getMatSnackBar(): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get('simple-snack-bar');
}

function closeMatSnackBar(): void {
  cy.get('body').then(($body) => {
    const action = $body.find('simple-snack-bar button');
    if (action.length > 0) {
      cy.wrap(action.first()).click();
      cy.get('simple-snack-bar').should('not.exist');
    }
  });
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

function elementCenter(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
