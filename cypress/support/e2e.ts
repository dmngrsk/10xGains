// You can read more here: https://on.cypress.io/configuration

// Import commands.js using ES2015 syntax:
import './commands';

// @ts-expect-error - @cypress/grep is not typed
import registerCypressGrep from '@cypress/grep';
registerCypressGrep();

// Quick-and-dirty way to retrieve the tags from the test options object.
// Prone to break if the test config changes.
Cypress.on('test:before:run', (_, runnable) => {
  type TestWithTags = Mocha.Test & { _testConfig: { unverifiedTestConfig: { tags: string[] } } };
  const testWithTags = runnable as TestWithTags;
  const testTags = testWithTags?._testConfig?.unverifiedTestConfig?.tags;

  Cypress.currentTestTags = testTags || [];
});

beforeEach(() => {
  cy.viewport('samsung-s10');
});
