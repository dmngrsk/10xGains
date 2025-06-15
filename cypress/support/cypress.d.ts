namespace Cypress {
  interface Chainable {
    /**
     * Smart login command that automatically determines the appropriate login strategy
     * based on test environment and \@smoke tag presence.
     * @param forceCanary If true, the command will use the canary user regardless of the test environment.
     */
    login({ forceCanary }: { forceCanary?: boolean } = {}): void;

    /**
     * Teardown the test environment by deleting the ephemeral user and cleaning up the test data.
     * The scope of the cleanup is defined by the test tags.
     */
    teardown(): void;

    /**
     * Navigate to a page by clicking the appropriate button.
     * @param button The bottom navigation button to click.
     * @returns A chainable object that can be used to interact with the element.
     */
    navigateTo(button: 'home' | 'plans' | 'history' | 'progress' | 'settings'): void;

    /**
     * Navigate to the previous page by clicking the back button.
     * @returns A chainable object that can be used to interact with the element.
     */
    navigateBack(): void;

    /**
     * Get one or more DOM elements by their data-cy attribute value.
     * @param selector The data-cy attribute value of the element to get.
     * @param options Optional configuration to override default behavior.
     * @returns A chainable object that can be used to interact with the element.
     */
    getBySel(selector: string, options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>): Cypress.Chainable<JQuery<HTMLElement>>;

    /**
     * Get the Material Snackbar element.
     * @returns A chainable object that can be used to interact with the element.
     */
    getMatSnackBar(): Cypress.Chainable<JQuery<HTMLElement>>;

    /**
     * Simulate a long press on an element.
     * @param subject The element to long press.
     * @param duration The duration of the long press in milliseconds.
     * @returns A chainable object that can be used to interact with the element.
     */
    longPress(duration: number = 500): Cypress.Chainable<JQuery<HTMLElement>>;
  }

  interface Cypress {
    /**
     * Tags associated with the current test.
     */
    currentTestTags?: string[];
  }
}
