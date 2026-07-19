import { dataCy } from '../selectors';

export function registerNavigationCommands(): void {
  Cypress.Commands.add('navigateTo', navigateTo);
  Cypress.Commands.add('navigateBack', navigateBack);
}

function navigateTo(button: 'home' | 'plans' | 'history' | 'progress' | 'settings'): void {
  cy.getBySel(`${dataCy.shared.navigation.bottom.prefix}${button}`).click({ force: true });
}

function navigateBack(): void {
  cy.getBySel(dataCy.shared.navigation.back).click({ force: true });
}
