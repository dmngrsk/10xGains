// You can read more here: https://on.cypress.io/configuration

import { register as registerCypressGrep } from '@cypress/grep';
import './commands';

beforeEach(() => {
  cy.viewport('samsung-s10');
});

// A Material snackbar sits in an overlay pane with `pointer-events: auto`, spanning the bottom
// of a handset viewport - straight over the bottom navigation, the actions bars and the session
// FAB. Cypress reads that as the control being covered and retries until the snackbar times
// itself out, so a 3s toast is charged to whichever click follows it. Letting pointer events
// through costs the suite nothing: snackbars still render and are still asserted on, they just
// stop intercepting the clicks meant for the page underneath.
Cypress.on('window:load', (win) => {
  try {
    const style = win.document.createElement('style');
    style.textContent = `
      mat-snack-bar-container,
      .cdk-overlay-pane:has(mat-snack-bar-container) { pointer-events: none !important; }
    `;
    win.document.head.appendChild(style);
  } catch {
    // This fires for every window the test loads, and the Google OAuth redirect is another
    // origin: reading its document throws. Nothing there renders a snackbar to begin with.
  }
});

registerCypressGrep();

// Quick-and-dirty way to retrieve the tags from the test options object.
// Prone to break if the test config changes.
Cypress.on('test:before:run', (_, runnable) => {
  type TestWithTags = Mocha.Test & { _testConfig: { unverifiedTestConfig: { tags: string[] } } };
  const testWithTags = runnable as TestWithTags;
  const testTags = testWithTags?._testConfig?.unverifiedTestConfig?.tags;

  Cypress.currentTestTags = testTags || [];
});
