import { createPlan, createPlanDay, createPlanExercise, createPlanExerciseSet } from '../../support/helpers/plans.helpers';
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
      cy.getBySel(dataCy.sessions.sessionCard.navigateButton).click();

      cy.url().should('match', /\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
      cy.getBySel(dataCy.sessions.header.title).should('be.visible').and('contain.text', 'Workout A');
      cy.getBySel(dataCy.sessions.header.plan).should('be.visible').and('contain.text', 'Test Training Plan');
    });
  });

  describe('when viewing the session page with an on-going session', () => {
    beforeEach(() => {
      cy.getBySel(dataCy.sessions.sessionCard.navigateButton).click();
    });

    it('cycles through set states on tap', { tags: ['SESS-02'] }, () => {
      const bubbleStateSequence = [
        { ariaLabel: 'COMPLETED', bubbleText: '5' },
        { ariaLabel: 'FAILED', bubbleText: '4' },
        { ariaLabel: 'FAILED', bubbleText: '3' },
        { ariaLabel: 'FAILED', bubbleText: '2' },
        { ariaLabel: 'FAILED', bubbleText: '1' },
        { ariaLabel: 'FAILED', bubbleText: '0' },
        { ariaLabel: 'PENDING', bubbleText: '5' },
        { ariaLabel: 'COMPLETED', bubbleText: '5' },
      ];

      bubbleStateSequence.forEach(({ ariaLabel, bubbleText }) => {
        cy.getBySel(dataCy.sessions.set.bubble).first().click();

        cy.getBySel(dataCy.sessions.set.bubble).first().should('have.attr', 'data-cy-set-status', ariaLabel);
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

    it('expands warmup sets from the toggle and dismisses them one by one, without network traffic', { tags: ['SESS-05'] }, () => {
      cy.intercept(/\/sessions\/[^/]+\/sets/).as('setRequests');

      // Every exercise renders its own toggle before its first working set.
      cy.getBySel(dataCy.sessions.warmup.toggle).should('have.length', 2);
      cy.getBySel(dataCy.sessions.warmup.bubble).should('not.exist');

      // Starting Strength even jumps for the first exercise's seeded 100 kg working weight.
      const expectedWarmups = [
        { reps: '5', weight: '20' },
        { reps: '5', weight: '20' },
        { reps: '5', weight: '40' },
        { reps: '3', weight: '60' },
        { reps: '2', weight: '80' },
      ];

      cy.getBySel(dataCy.sessions.exerciseItem).first().within(() => {
        cy.getBySel(dataCy.sessions.warmup.toggle).click();

        cy.getBySel(dataCy.sessions.warmup.toggle).should('not.exist');
        cy.getBySel(dataCy.sessions.warmup.bubble).should('have.length', expectedWarmups.length);
        expectedWarmups.forEach(({ reps, weight }, i) => {
          cy.getBySel(dataCy.sessions.warmup.bubbleText).eq(i).should('contain.text', reps);
          cy.getBySel(dataCy.sessions.warmup.bubbleWeightText).eq(i).should('contain.text', weight);
        });

        // A single click removes exactly the clicked bubble.
        cy.getBySel(dataCy.sessions.warmup.bubble).eq(2).click();
        cy.getBySel(dataCy.sessions.warmup.bubble).should('have.length', expectedWarmups.length - 1);
        cy.getBySel(dataCy.sessions.warmup.bubbleWeightText).should('not.contain.text', '40');

        // Dismissing the remaining bubbles removes the warmup UI entirely.
        cy.getBySel(dataCy.sessions.warmup.bubble).each(() => {
          cy.getBySel(dataCy.sessions.warmup.bubble).first().click();
        });
        cy.getBySel(dataCy.sessions.warmup.bubble).should('not.exist');
        cy.getBySel(dataCy.sessions.warmup.toggle).should('not.exist');
      });

      // The neighboring exercise's warmup UI is unaffected.
      cy.getBySel(dataCy.sessions.exerciseItem).eq(1).within(() => {
        cy.getBySel(dataCy.sessions.warmup.toggle).should('be.visible');
      });

      // Warmup interactions are ephemeral: no session set requests were issued. Set writes
      // are debounced by 1s, so outwait the window before asserting silence.
      cy.getBySel(dataCy.sessions.header.status).should('not.contain.text', 'IN PROGRESS');
      cy.wait(1100);
      cy.get('@setRequests.all').should('have.length', 0);
    });

    it('dismisses the warmup UI when a working set is clicked', { tags: ['SESS-06'] }, () => {
      cy.intercept(/\/sessions\/[^/]+\/sets\/[^/]+\/complete/).as('completeSet');

      // Expanded case: warmup bubbles disappear on a working set interaction.
      cy.getBySel(dataCy.sessions.exerciseItem).first().within(() => {
        cy.getBySel(dataCy.sessions.warmup.toggle).click();
        cy.getBySel(dataCy.sessions.warmup.bubble).should('have.length.greaterThan', 0);
        cy.getBySel(dataCy.sessions.set.bubble).first().click();
        cy.getBySel(dataCy.sessions.warmup.bubble).should('not.exist');
        cy.getBySel(dataCy.sessions.warmup.toggle).should('not.exist');
      });

      // The set completion is debounced; let it reach the API before reloading.
      cy.wait('@completeSet', { requestTimeout: 15000 });

      // The dismissal is per-exercise and survives a reload, because the first exercise is
      // now mid-workout while the second remains untouched.
      cy.reload();
      cy.getBySel(dataCy.sessions.exerciseItem).first().within(() => {
        cy.getBySel(dataCy.sessions.set.bubble).first().should('have.attr', 'data-cy-set-status', 'COMPLETED');
        cy.getBySel(dataCy.sessions.warmup.toggle).should('not.exist');
        cy.getBySel(dataCy.sessions.warmup.bubble).should('not.exist');
      });
      cy.getBySel(dataCy.sessions.exerciseItem).eq(1).within(() => {
        cy.getBySel(dataCy.sessions.warmup.toggle).should('be.visible');
      });
    });

    it('allows a user to complete a session', { tags: ['SESS-07'] }, () => {
      cy.getBySel(dataCy.sessions.set.bubble).each((sb: JQuery<HTMLElement>) => cy.wrap(sb).click()); // Complete all sets
      cy.getBySel(dataCy.sessions.set.bubble).filter('[data-cy-set-status="PENDING"]').should('not.exist');
      cy.getBySel(dataCy.sessions.completeButton).click();

      cy.url().should('include', '/home');
      cy.getBySel(dataCy.home.sessionCard).should('be.visible');
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Workout B'); // Next workout from the plan
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Squat: 3x5 @ 102.5 kg'); // Progression rules applied
    });

    it('prompts for confirmation when completing a session with unfinished sets', { tags: ['SESS-08'] }, () => {
      cy.getBySel(dataCy.sessions.set.bubble).first().click(); // Complete only one set
      cy.getBySel(dataCy.sessions.set.bubble).filter('[data-cy-set-status="PENDING"]').should('exist');
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

    it('allows a user to add a session note via the notes dialog and see it after reopening', { tags: ['SESS-09'] }, () => {
      cy.getBySel(dataCy.sessions.notesButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('be.focused'); // Let the dialog autofocus settle, or the focus trap steals the keystrokes
      cy.getBySel(dataCy.sessions.dialogs.notes.title).should('be.visible').and('contain.text', 'Notes');
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).type('Felt strong on squats today.');
      cy.getBySel(dataCy.sessions.dialogs.notes.saveButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.content).should('not.exist');
      cy.getMatSnackBar().should('contain.text', 'Notes saved'); // Wait for the save to complete before reloading

      cy.reload();
      cy.getBySel(dataCy.sessions.notesButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('have.value', 'Felt strong on squats today.');
    });

    it('keeps the notes dialog open on a click outside, and discards the edit on Cancel', { tags: ['SESS-10'] }, () => {
      cy.getBySel(dataCy.sessions.notesButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('be.focused'); // Let the dialog autofocus settle, or the focus trap steals the keystrokes
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).type('Typed then clicked away.');

      // The dialog is modal: a backdrop click neither closes it nor saves.
      cy.get('.cdk-overlay-backdrop').click({ force: true });
      cy.getBySel(dataCy.sessions.dialogs.notes.content).should('be.visible');
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('have.value', 'Typed then clicked away.');

      cy.getBySel(dataCy.sessions.dialogs.notes.cancelButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.content).should('not.exist');

      cy.reload();
      cy.getBySel(dataCy.sessions.notesButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('have.value', ''); // Cancel discarded it
    });

    it('shows the same plan note in other sessions of the same plan', { tags: ['SESS-11'] }, () => {
      cy.getBySel(dataCy.sessions.notesButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('be.focused'); // Let the dialog autofocus settle, or the focus trap steals the keystrokes
      cy.getBySel(dataCy.sessions.dialogs.notes.planInput).type('Switch to low-bar next cycle.');
      cy.getBySel(dataCy.sessions.dialogs.notes.saveButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.content).should('not.exist');
      cy.getMatSnackBar().should('contain.text', 'Notes saved'); // Wait for the save to complete before navigating away

      // Open a completed session of the same plan from the history list (the calendar opens by default).
      cy.navigateBack();
      cy.navigateTo('history');
      cy.getBySel(dataCy.history.viewToggle).click();
      cy.getBySel(dataCy.history.sessionCard).first().within(() => {
        cy.getBySel(dataCy.history.sessionNavigateButton).click();
      });

      cy.closeMatSnackBar(); // A lingering snackbar can overlay the notes FAB
      cy.getBySel(dataCy.sessions.notesButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.planInput).should('have.value', 'Switch to low-bar next cycle.');
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('have.value', ''); // Session notes are per-session
    });

    it('never shows a plan note in a session belonging to a different plan', { tags: ['SESS-12'] }, () => {
      cy.getBySel(dataCy.sessions.notesButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('be.focused'); // Let the dialog autofocus settle, or the focus trap steals the keystrokes
      cy.getBySel(dataCy.sessions.dialogs.notes.planInput).type('Note for the first plan only.');
      cy.getBySel(dataCy.sessions.dialogs.notes.saveButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.content).should('not.exist');
      cy.getMatSnackBar().should('contain.text', 'Notes saved'); // Wait for the save to complete before navigating away

      // Create and activate a second plan (the global Squat exercise exists via scaffolding)
      cy.navigateBack(); // The session page has no bottom navigation
      cy.navigateTo('plans');
      createPlan('Second Training Plan');
      createPlanDay('Workout C');
      createPlanExercise({ name: 'Squat' });
      createPlanExerciseSet({ reps: '5', weight: '60' });
      cy.getBySel(dataCy.plans.planEdit.activateButton).click();

      // A session for the second plan is scheduled on the home page
      cy.url().should('include', '/home');
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Workout C'); // Session from the second plan
      cy.getBySel(dataCy.sessions.sessionCard.navigateButton).click();

      cy.closeMatSnackBar(); // A lingering snackbar can overlay the notes FAB
      cy.getBySel(dataCy.sessions.notesButton).click();
      cy.getBySel(dataCy.sessions.dialogs.notes.planInput).should('have.value', '');
      cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('have.value', '');
    });

    it('prevents access to another user\'s session notes (RLS check)', { tags: ['SESS-13'] }, () => {
      let userId1: string;
      let userId2: string;

      // Save a note as the first user and get the session URL.
      cy.get('@ephemeralUserId').then((userId) => {
        userId1 = userId as unknown as string;

        cy.getBySel(dataCy.sessions.notesButton).click();
        cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).should('be.focused'); // Let the dialog autofocus settle, or the focus trap steals the keystrokes
        cy.getBySel(dataCy.sessions.dialogs.notes.sessionInput).type('Private note of user one.');
        cy.getBySel(dataCy.sessions.dialogs.notes.saveButton).click();
        cy.getBySel(dataCy.sessions.dialogs.notes.content).should('not.exist');
        cy.getMatSnackBar().should('contain.text', 'Notes saved'); // Wait for the save to complete before navigating away

        cy.url().then((ephemeralUserSessionUrl) => {
          cy.navigateBack();
          cy.navigateTo('settings');
          cy.getBySel(dataCy.settings.account.signOutButton).click();
          cy.url().should('include', '/auth/login');

          // Sign in as the second ephemeral user and try to access the first user's session.
          cy.login();
          cy.get('@ephemeralUserId').then((userId) => {
            userId2 = userId as unknown as string;
            cy.visit(ephemeralUserSessionUrl);

            cy.getBySel(dataCy.sessions.errorNotice).should('be.visible');
            cy.getBySel(dataCy.sessions.notesButton).should('not.exist');

            // Clean up the ephemeral users.
            cy.task('users:delete', { userId: userId1 });
            cy.task('users:delete', { userId: userId2 });
            cy.wrap(null).as('ephemeralUserId');
          });
        });
      });
    });
  });
});
