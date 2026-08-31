export function registerMaterialCommands(): void {
  Cypress.Commands.add('getMatSnackBar', getMatSnackBar);
}

function getMatSnackBar(): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get('simple-snack-bar');
}
