describe('Session Tracking', { tags: ['@sessions'] }, () => {
  beforeEach(() => {
    cy.login();
  });

  afterEach(() => {
    cy.teardown();
  });

  describe('when viewing the home page with an active plan', () => {
    it('allows a user to start a new session from an active plan', { tags: ['@smoke', 'SESS-01'] }, () => {
      cy.getBySel('session-card').should('be.visible').and('contain.text', 'Workout A');
      cy.getBySel('session-navigate-button').click();

      cy.url().should('match', /\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
      cy.getBySel('session-header').should('be.visible').and('contain.text', 'Workout A');
    });
  });

  describe('when viewing the session page with an on-going session', () => {
    beforeEach(() => {
      cy.getBySel('session-navigate-button').click();
    });

    it('cycles through set states on tap', { tags: ['SESS-02'] }, () => {
      const bubbleStateSequence = [
        { ariaLabel: 'Set completed', bubbleText: '5' },
        { ariaLabel: 'Set failed', bubbleText: '4' },
        { ariaLabel: 'Set failed', bubbleText: '3' },
        { ariaLabel: 'Set failed', bubbleText: '2' },
        { ariaLabel: 'Set failed', bubbleText: '1' },
        { ariaLabel: 'Set failed', bubbleText: '0' },
        { ariaLabel: 'Set pending', bubbleText: '5' },
        { ariaLabel: 'Set completed', bubbleText: '5' },
      ];

      bubbleStateSequence.forEach(({ ariaLabel, bubbleText }) => {
        cy.getBySel('set-bubble').first().click();

        cy.getBySel('set-bubble').first().should('have.attr', 'aria-label', ariaLabel);
        cy.getBySel('set-bubble-text').first().should('contain.text', bubbleText);
      });
    });

    it('opens edit dialog on long-press and save changes', { tags: ['SESS-03'] }, () => {
      cy.getBySel('set-bubble').first().longPress();
      cy.getBySel('add-edit-set-dialog-title').should('be.visible').and('contain.text', 'Edit Set');
      cy.getBySel('add-edit-set-dialog-content').should('be.visible');
      cy.getBySel('add-edit-set-dialog-reps-input').clear().type('7');
      cy.getBySel('add-edit-set-dialog-weight-input').clear().type('110');
      cy.getBySel('add-edit-set-dialog-save-button').click();

      cy.getBySel('add-edit-set-dialog-content').should('not.exist');
      cy.getBySel('set-bubble-text').first().should('contain.text', '7');
      cy.getBySel('set-bubble-weight-text').first().should('contain.text', '110');
    });

    it('starts the session timer after the first set interaction', { tags: ['SESS-04'] }, () => {
      cy.getBySel('session-timer').should('contain.text', '--:--');
      cy.getBySel('set-bubble').first().click();

      cy.getBySel('session-timer').should('contain.text', '00:00');
      cy.getBySel('session-timer').should('contain.text', '00:01');
      cy.getBySel('session-timer').should('contain.text', '00:02');
    });

    it('allows a user to complete a session', { tags: ['SESS-05'] }, () => {
      cy.getBySel('set-bubble').each((sb: JQuery<HTMLElement>) => cy.wrap(sb).click()); // Complete all sets
      cy.getBySel('set-bubble').filter('[aria-label="Set pending"]').should('not.exist');
      cy.getBySel('complete-session-button').click();

      cy.url().should('include', '/home');
      cy.getBySel('session-card').should('be.visible');
      cy.getBySel('session-card').should('contain.text', 'Workout B'); // Next workout from the plan
      cy.getBySel('session-card').should('contain.text', 'Squat: 3x5 @ 102.5 kg'); // Progression rules applied
    });

    it('prompts for confirmation when completing a session with unfinished sets', { tags: ['SESS-06'] }, () => {
      cy.getBySel('set-bubble').first().click(); // Complete only one set
      cy.getBySel('set-bubble').filter('[aria-label="Set pending"]').should('exist');
      cy.getBySel('complete-session-button').click();
      cy.getBySel('confirmation-dialog-title').should('be.visible').and('contain.text', 'Complete Session');
      cy.getBySel('confirmation-dialog-content').should('be.visible').and('contain.text', 'Not all sets have been marked as completed or failed.');
      cy.getBySel('confirmation-dialog-cancel-button').click();

      cy.getBySel('confirmation-dialog').should('not.exist');
      cy.url().should('not.include', '/home');
      cy.getBySel('complete-session-button').click();
      cy.getBySel('confirmation-dialog-content').should('be.visible');
      cy.getBySel('confirmation-dialog-confirm-button').click();

      cy.url().should('include', '/home');
      cy.getBySel('session-card').should('be.visible');
      cy.getBySel('session-card').should('contain.text', 'Workout B'); // Next workout from the plan
      cy.getBySel('session-card').should('contain.text', 'Squat: 3x5 @ 100 kg'); // Progression rules not applied due to incomplete sets
    });
  });
});
