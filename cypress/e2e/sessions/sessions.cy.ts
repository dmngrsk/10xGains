describe('Session Page', { tags: ['@sessions'] }, () => {
  beforeEach(() => {
    cy.loginAsAppropriateUser();
    cy.navigateTo('home');
  });

  it('should allow a user to start a new session from an active plan', { tags: ['@smoke', 'SESS-01'] }, () => {
    cy.getByDataCy('session-card').should('be.visible').and('contain.text', 'Workout A');
    cy.getByDataCy('session-navigate-button').click();

    cy.url().should('match', /\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

    cy.getByDataCy('session-header').should('be.visible').and('contain.text', 'Workout A');
  });

  describe('within a context of an existing session', () => {
    beforeEach(() => {
      cy.getByDataCy('session-navigate-button').click();
      cy.url().should('match', /\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    });

    it('should cycle through set states on tap', { tags: ['SESS-02'] }, () => {
      const bubbleStateSequence = [
        { ariaLabel: 'Set pending', bubbleText: '5' },
        { ariaLabel: 'Set completed', bubbleText: '5' },
        { ariaLabel: 'Set failed', bubbleText: '4' },
        { ariaLabel: 'Set failed', bubbleText: '3' },
        { ariaLabel: 'Set failed', bubbleText: '2' },
        { ariaLabel: 'Set failed', bubbleText: '1' },
        { ariaLabel: 'Set failed', bubbleText: '0' },
        { ariaLabel: 'Set pending', bubbleText: '5' },
      ];

      bubbleStateSequence.forEach(({ ariaLabel, bubbleText }) => {
        cy.getByDataCy('set-bubble').first().should('have.attr', 'aria-label', ariaLabel);
        cy.getByDataCy('set-bubble-text').first().should('contain.text', bubbleText);
        cy.getByDataCy('set-bubble').first().click();
      });
    });

    it('should open edit dialog on long-press and save changes', { tags: ['SESS-03'] }, () => {
      cy.getByDataCy('set-bubble').first().longPress();
      cy.getByDataCy('add-edit-set-dialog-title').should('be.visible').and('contain.text', 'Edit Set');
      cy.getByDataCy('add-edit-set-dialog-content').should('be.visible');

      cy.getByDataCy('add-edit-set-dialog-reps-input').clear().type('7');
      cy.getByDataCy('add-edit-set-dialog-weight-input').clear().type('110');
      cy.getByDataCy('add-edit-set-dialog-save-button').click();

      cy.getByDataCy('add-edit-set-dialog-content').should('not.exist');
      cy.getByDataCy('set-bubble-text').first().should('contain.text', '7');
      cy.getByDataCy('set-bubble-weight-text').first().should('contain.text', '110');
    });

    it('should start the session timer after the first set interaction', { tags: ['SESS-04'] }, () => {
      cy.getByDataCy('session-timer').should('contain.text', '--:--');
      cy.getByDataCy('set-bubble').first().click();
      cy.getByDataCy('session-timer').should('contain.text', '00:00');
      cy.getByDataCy('session-timer').should('contain.text', '00:01');
      cy.getByDataCy('session-timer').should('contain.text', '00:02');
    });

    it('should allow a user to complete a session', { tags: ['SESS-05'] }, () => {
      cy.getByDataCy('set-bubble').each((sb: JQuery<HTMLElement>) => cy.wrap(sb).click()); // Complete all sets
      cy.getByDataCy('set-bubble').filter('[aria-label="Set pending"]').should('not.exist');
      cy.getByDataCy('complete-session-button').click();

      cy.url().should('include', '/home');
      cy.getByDataCy('session-card', { timeout: 10000 }).should('be.visible');
      cy.getByDataCy('session-card').should('contain.text', 'Workout B'); // Next workout from the plan
      cy.getByDataCy('session-card').should('contain.text', 'Squat: 3x5 @ 102.5 kg'); // Progression rules applied
    });

    it('should prompt for confirmation when completing a session with unfinished sets', { tags: ['SESS-06'] }, () => {
      cy.getByDataCy('set-bubble').first().click(); // Complete only one set
      cy.getByDataCy('set-bubble').filter('[aria-label="Set pending"]').should('exist');

      cy.getByDataCy('complete-session-button').click();
      cy.getByDataCy('confirmation-dialog-title').should('be.visible').and('contain.text', 'Complete Session');
      cy.getByDataCy('confirmation-dialog-content').should('be.visible').and('contain.text', 'Not all sets have been marked as completed or failed.');
      cy.getByDataCy('confirmation-dialog-cancel-button').click();
      cy.getByDataCy('confirmation-dialog').should('not.exist');
      cy.url().should('not.include', '/home');

      cy.getByDataCy('complete-session-button').click();
      cy.getByDataCy('confirmation-dialog-content').should('be.visible');
      cy.getByDataCy('confirmation-dialog-confirm-button').click();

      cy.url().should('include', '/home');
      cy.getByDataCy('session-card', { timeout: 10000 }).should('be.visible');
      cy.getByDataCy('session-card').should('contain.text', 'Workout B'); // Next workout from the plan
      cy.getByDataCy('session-card').should('contain.text', 'Squat: 3x5 @ 100 kg'); // Progression rules not applied due to incomplete sets
    });
  });
});
