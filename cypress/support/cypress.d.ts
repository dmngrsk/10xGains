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
     * @param options Optional configuration to override default behavior.
     * @returns A chainable object that can be used to interact with the element.
     */
    getByDataCy(selector: string, options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>): ReturnType<typeof getByDataCy>;

    /**
     * Navigate to a page by clicking the appropriate button.
     * @param button The bottom navigation button to click.
     * @returns A chainable object that can be used to interact with the element.
     */
    navigateTo(button: 'home' | 'plans' | 'history' | 'progress' | 'settings'): ReturnType<typeof navigateTo>;

    /**
     * Simulate a long press on an element.
     * @param subject The element to long press.
     * @param duration The duration of the long press in milliseconds.
     * @returns A chainable object that can be used to interact with the element.
     */
    longPress(subject: JQuery<HTMLElement>, duration: number = 500): ReturnType<typeof longPress>;
  }

  interface Cypress {
    /**
     * Tags associated with the current test.
     */
    currentTestTags?: string[];
  }
}
