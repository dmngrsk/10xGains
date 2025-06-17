import { dataCy } from '../../support/selectors';

describe('Session Tracking', { tags: ['@sessions'] }, () => {
  beforeEach(() => {
    cy.login();
  });

  afterEach(() => {
    cy.teardown();
  });

  describe('when viewing the home page with an active plan', () => {
    it('allows a user to start a new session from an active plan', { tags: ['@smoke', 'SESS-01'] }, () => {
      cy.getBySel(dataCy.home.sessionCard).should('be.visible').and('contain.text', 'Workout A');
      cy.getBySel(dataCy.home.sessionNavigateButton).click();

      cy.url().should('match', /\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
      cy.getBySel(dataCy.sessions.header.title).should('be.visible').and('contain.text', 'Workout A');
      cy.getBySel(dataCy.sessions.header.plan).should('be.visible').and('contain.text', 'Test Training Plan');
    });
  });

  describe('when viewing the session page with an on-going session', () => {
    beforeEach(() => {
      cy.getBySel(dataCy.home.sessionNavigateButton).click();
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
        cy.getBySel(dataCy.sessions.set.bubble).first().click();

        cy.getBySel(dataCy.sessions.set.bubble).first().should('have.attr', 'aria-label', ariaLabel);
        cy.getBySel(dataCy.sessions.set.bubbleText).first().should('contain.text', bubbleText);
      });

      cy.getBySel(dataCy.sessions.header.status).should('contain.text', 'IN PROGRESS');
      cy.getBySel(dataCy.sessions.header.date).should('be.visible');
    });

    it('opens edit dialog on long-press and save changes', { tags: ['SESS-03'] }, () => {
      cy.getBySel(dataCy.sessions.set.bubble).first().longPress();
      cy.getBySel(dataCy.sessions.dialogs.sets.title).should('be.visible').and('contain.text', 'Edit Set');
      cy.getBySel(dataCy.sessions.dialogs.sets.content).should('be.visible');
      cy.getBySel(dataCy.sessions.dialogs.sets.repsInput).clear().type('7');
      cy.getBySel(dataCy.sessions.dialogs.sets.weightInput).clear().type('110');
      cy.getBySel(dataCy.sessions.dialogs.sets.saveButton).click();

      cy.getBySel(dataCy.sessions.dialogs.sets.content).should('not.exist');
      cy.getBySel(dataCy.sessions.set.bubbleText).first().should('contain.text', '7');
      cy.getBySel(dataCy.sessions.set.bubbleWeightText).first().should('contain.text', '110');
    });

    it('starts the session timer after the first set interaction', { tags: ['SESS-04'] }, () => {
      cy.getBySel(dataCy.sessions.timer).should('contain.text', '--:--');
      cy.getBySel(dataCy.sessions.set.bubble).first().click();

      cy.getBySel(dataCy.sessions.timer).should('contain.text', '00:00');
      cy.getBySel(dataCy.sessions.timer).should('contain.text', '00:01');
      cy.getBySel(dataCy.sessions.timer).should('contain.text', '00:02');
    });

    it('allows a user to complete a session', { tags: ['SESS-05'] }, () => {
      cy.getBySel(dataCy.sessions.set.bubble).each((sb: JQuery<HTMLElement>) => cy.wrap(sb).click()); // Complete all sets
      cy.getBySel(dataCy.sessions.set.bubble).filter('[aria-label="Set pending"]').should('not.exist');
      cy.getBySel(dataCy.sessions.completeButton).click();

      cy.url().should('include', '/home');
      cy.getBySel(dataCy.home.sessionCard).should('be.visible');
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Workout B'); // Next workout from the plan
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Squat: 3x5 @ 102.5 kg'); // Progression rules applied
    });

    it('prompts for confirmation when completing a session with unfinished sets', { tags: ['SESS-06'] }, () => {
      cy.getBySel(dataCy.sessions.set.bubble).first().click(); // Complete only one set
      cy.getBySel(dataCy.sessions.set.bubble).filter('[aria-label="Set pending"]').should('exist');
      cy.getBySel(dataCy.sessions.completeButton).click();
      cy.getBySel(dataCy.shared.dialogs.confirmation.title).should('be.visible').and('contain.text', 'Complete Session');
      cy.getBySel(dataCy.shared.dialogs.confirmation.content).should('be.visible').and('contain.text', 'Not all sets have been marked as completed or failed.');
      cy.getBySel(dataCy.shared.dialogs.confirmation.cancelButton).click();

      cy.getBySel(dataCy.shared.dialogs.confirmation.content).should('not.exist');
      cy.url().should('not.include', '/home');
      cy.getBySel(dataCy.sessions.completeButton).click();
      cy.getBySel(dataCy.shared.dialogs.confirmation.content).should('be.visible');
      cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();

      cy.url().should('include', '/home');
      cy.getBySel(dataCy.home.sessionCard).should('be.visible');
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Workout B'); // Next workout from the plan
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Squat: 3x5 @ 100 kg'); // Progression rules not applied due to incomplete sets
    });
  });
});
