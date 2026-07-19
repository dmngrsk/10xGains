export function registerElementCommands(): void {
  Cypress.Commands.add('getBySel', getBySel);
  Cypress.Commands.add('dragBySel', dragBySel);
  Cypress.Commands.add('longPress', { prevSubject: 'element' }, (s, d) => longPress(s, d as unknown as number));
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

function longPress(element: JQuery<HTMLElement>, duration: number = 500): Cypress.Chainable<JQuery<HTMLElement>> {
  cy.wrap(element).trigger('pointerdown', { button: 0 });
  cy.wait(duration);
  return cy.wrap(element).trigger('pointerup', { force: true });
}

function elementCenter(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
