export function registerMaterialCommands(): void {
  Cypress.Commands.add('getMatSnackBar', getMatSnackBar);
  Cypress.Commands.add('closeMatSnackBar', closeMatSnackBar);
}

function getMatSnackBar(): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get('simple-snack-bar');
}

function closeMatSnackBar(): void {
  cy.get('body').then(($body) => {
    $body.find('simple-snack-bar button').get(0)?.click();
  });

  cy.get('simple-snack-bar').should('not.exist');
}
