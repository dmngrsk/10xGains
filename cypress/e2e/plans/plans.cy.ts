import { createPlan, createPlanDay, createPlanExercise, createPlanExerciseSet, expectPlanExerciseSet, openDayMenuAction, openExerciseMenuAction } from '../../support/helpers/plans.helpers';
import { dataCy } from '../../support/selectors';
import { PLAN_FIXTURE_EXERCISE } from '../../support/test-data/exercises';

describe('Plan Management', { tags: ['@plans'] }, () => {
  beforeEach(() => {
    cy.login();
  });

  afterEach(() => {
    cy.teardown();
  });

  describe('when viewing the plan list page', () => {
    beforeEach(() => {
      cy.navigateTo('plans');
    });

    it('allows a user to create a new plan', { tags: ['PLAN-01'] }, () => {
      createPlan();

      cy.navigateBack();
      cy.getBySel(dataCy.plans.planList.planCard).should('contain.text', 'Test Training Plan');
    });

    it('allows a user to view and navigate to a plan', { tags: ['@smoke', 'PLAN-02'] }, () => {
      cy.getBySel(dataCy.plans.planList.activePlanCard).should('be.visible').and('contain.text', 'Test Training Plan');
      cy.getBySel(dataCy.plans.planList.activePlanCard).within(() => {
        cy.getBySel(dataCy.plans.planList.viewPlanButton).click();
      });

      cy.url().should('match', /\/plans\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

      cy.getBySel(dataCy.shared.navigation.title).should('be.visible').and('contain.text', 'Test Training Plan');
    });
  });

  describe('when viewing the plan editor page with a freshly created plan', () => {
    beforeEach(() => {
      cy.navigateTo('plans');
      createPlan();
    });

    describe('building the plan structure', () => {
      it('allows a user to add, edit and delete a new training day', { tags: ['PLAN-03'] }, () => {
        // Add a day
        createPlanDay();

        // Edit a day, from the day's overflow menu
        openDayMenuAction(dataCy.plans.planEdit.days.editButton);
        cy.getBySel(dataCy.plans.dialogs.days.title).should('contain.text', 'Edit Day');
        cy.getBySel(dataCy.plans.dialogs.days.nameInput).clear().type('Edited Training Day');
        cy.getBySel(dataCy.plans.dialogs.days.saveButton).click();
        cy.getBySel(dataCy.plans.planEdit.days.tab).should('contain.text', 'Edited Training Day');

        // Delete a day, from the same dialog. The plan has no sessions, so this is a real delete
        // rather than an archive - the dialog offers whichever of the two the editor allows, and
        // never both.
        openDayMenuAction(dataCy.plans.planEdit.days.editButton);
        cy.getBySel(dataCy.plans.dialogs.days.archiveButton).should('not.exist');
        cy.getBySel(dataCy.plans.dialogs.days.deleteButton).click();
        cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();
        cy.getBySel(dataCy.plans.planEdit.days.item).should('not.exist');

        // Verify the plan is still visible
        cy.getBySel(dataCy.plans.planEdit.metadata).should('exist');
      });
      it('allows a user to add an exercise to a day, edit its progression, and delete it', { tags: ['PLAN-04'] }, () => {
        // Add an exercise
        createPlanDay();
        createPlanExercise({ name: PLAN_FIXTURE_EXERCISE });

        // Edit exercise progression
        cy.getBySel(dataCy.plans.planEdit.exercises.editProgressionButton).click();
        cy.getBySel(dataCy.plans.dialogs.exerciseProgression.title).should('contain.text', 'Edit Exercise Progression');
        cy.getBySel(dataCy.plans.dialogs.exerciseProgression.weightIncrementInput).clear().type('5');
        cy.getBySel(dataCy.plans.dialogs.exerciseProgression.saveButton).click();
        cy.getBySel(dataCy.plans.dialogs.exerciseProgression.content).should('not.exist');
        cy.getMatSnackBar().should('contain.text', 'Exercise progression updated');

        // The progression chip states the increment outright, rather than encoding whether one exists
        // in a button's verb
        cy.getBySel(dataCy.plans.planEdit.exercises.editProgressionButton).should('contain.text', '5 kg');

        // Delete an exercise, from its overflow menu
        openExerciseMenuAction(dataCy.plans.planEdit.exercises.deleteButton);
        cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();
        cy.getBySel(dataCy.plans.planEdit.exercises.item).should('not.exist');

        // Verify the plan is still visible
        cy.getBySel(dataCy.plans.planEdit.metadata).should('exist');
      });
      it('allows a user to create a global exercise and add this exercise to a training day in a plan', { tags: ['PLAN-05'] }, () => {
        cy.wrap(`New Exercise ${Date.now()}`).as('newExerciseName').then((name) => {
          // Create a global exercise and add it to a training day
          createPlanDay();
          createPlanExercise({ name, createGlobal: true });
        });
      });
      it('allows a user to add, edit, and delete a set for an exercise', { tags: ['PLAN-06'] }, () => {
        // Add a set
        createPlanDay();
        createPlanExercise({ name: PLAN_FIXTURE_EXERCISE });
        createPlanExerciseSet();

        // Edit a set
        cy.getBySel(dataCy.plans.planEdit.sets.editButton).click();
        cy.getBySel(dataCy.plans.dialogs.sets.content).should('be.visible');
        cy.getBySel(dataCy.plans.dialogs.sets.title).should('contain.text', 'Edit Set');
        cy.getBySel(dataCy.plans.dialogs.sets.repsInput).clear().type('11');
        cy.getBySel(dataCy.plans.dialogs.sets.weightInput).clear().type('110');
        cy.getBySel(dataCy.plans.dialogs.sets.saveButton).click();
        cy.getBySel(dataCy.plans.dialogs.sets.content).should('not.exist');
        cy.getBySel(dataCy.plans.planEdit.sets.item).should('exist');
        expectPlanExerciseSet({ reps: '11', weight: '110' });

        // Delete a set. The row's bin icon is gone: deletion lives in the set dialog, so there is one
        // deletion idiom per surface rather than three.
        cy.getBySel(dataCy.plans.planEdit.sets.editButton).click();
        cy.getBySel(dataCy.plans.dialogs.sets.deleteButton).click();
        cy.getBySel(dataCy.plans.planEdit.sets.item).should('not.exist');

        // Verify the plan is still visible
        cy.getBySel(dataCy.plans.planEdit.metadata).should('exist');
      });
    });

    describe('checking a plan is ready to activate', () => {
      it('says what a plan still needs rather than greying out Activate', { tags: ['PLAN-07'] }, () => {
        // The action stays live on an incomplete plan. A disabled row would say the user cannot
        // proceed without ever saying why, and each of these answers is one line long.
        cy.getBySel(dataCy.plans.planEdit.activateButton).click();
        cy.getMatSnackBar().should('contain.text', 'Add a training day');

        createPlanDay();
        cy.getBySel(dataCy.plans.planEdit.activateButton).click();
        cy.getMatSnackBar().should('contain.text', '"Test Training Day" has no exercises');

        createPlanExercise({ name: PLAN_FIXTURE_EXERCISE });
        cy.getBySel(dataCy.plans.planEdit.activateButton).click();
        cy.getMatSnackBar().should('contain.text', 'has no sets');

        createPlanExerciseSet();

        // A second day, left empty. The check is per day, not over the plan as a whole: a flattened
        // "does this plan have any sets" would pass here, and activating would produce a workout with
        // nothing in it whenever the rotation reached this day.
        createPlanDay('Second Training Day');
        cy.getBySel(dataCy.plans.planEdit.activateButton).click();
        cy.getMatSnackBar().should('contain.text', '"Second Training Day" has no exercises');

        // ...and the same for an exercise inside it with no sets. The progression dialog does not
        // reappear: this lift already has a rule from the first day, and they are per plan.
        createPlanExercise({ name: PLAN_FIXTURE_EXERCISE, expectProgressionDialog: false });
        cy.getBySel(dataCy.plans.planEdit.activateButton).click();
        cy.getMatSnackBar().should('contain.text', 'has no sets');

        createPlanExerciseSet();
        cy.getBySel(dataCy.plans.planEdit.activateButton).click();
        cy.url().should('include', '/home');
      });
      it('refuses to activate a plan whose exercise has no progression rule', { tags: ['PLAN-08'] }, () => {
        // The progression dialog opens by itself when an exercise is added, but it can be dismissed,
        // and an exercise without a rule will neither advance nor deload. The plan is structurally
        // complete here - a day, an exercise, a set - so this is the one activation blocker that is
        // not about missing structure.
        createPlanDay();
        createPlanExercise({ name: PLAN_FIXTURE_EXERCISE, skipProgression: true });
        createPlanExerciseSet();

        cy.getBySel(dataCy.plans.planEdit.activateButton).click();
        cy.getMatSnackBar().should('contain.text', 'exercise progression strategies');
        cy.url().should('not.include', '/home');

        // Setting the rule from the chip clears the blocker. The chip flipping from its unset state to
        // the increment is what says the plan has reloaded, so activating cannot outrun that.
        cy.getBySel(dataCy.plans.planEdit.exercises.addProgressionButton).click();
        cy.getBySel(dataCy.plans.dialogs.exerciseProgression.weightIncrementInput).type('2.5');
        cy.getBySel(dataCy.plans.dialogs.exerciseProgression.saveButton).click();
        cy.getBySel(dataCy.plans.dialogs.exerciseProgression.content).should('not.exist');
        cy.getBySel(dataCy.plans.planEdit.exercises.editProgressionButton).should('contain.text', '2.5 kg');

        cy.getBySel(dataCy.plans.planEdit.activateButton).click({ force: true });
        cy.url().should('include', '/home');
      });
    });
  });

  describe('when viewing the plan editor page with an existing, inactive plan', () => {
    /** Activates the plan, completes the session that creates, and returns to the plan editor. */
    function completeOneSessionAndReturnToPlan() {
      cy.getBySel(dataCy.plans.planEdit.activateButton).click();
      cy.getBySel(dataCy.sessions.sessionCard.navigateButton).click({ force: true });
      cy.getBySel(dataCy.sessions.set.bubble).first().click();
      cy.getBySel(dataCy.sessions.completeButton).click({ force: true });
      cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();
      cy.navigateTo('plans');
      cy.getBySel(dataCy.plans.planList.viewPlanButton).click();
      cy.getBySel(dataCy.plans.planEdit.metadata).should('exist');
    }

    /**
     * Takes the plan out of active use so it can be edited.
     *
     * An active plan is read-only: changing the programme you are part-way through is a decision,
     * not a side effect of tapping a stepper. This is the single step that unlocks it.
     */
    function deactivateForEditing() {
      cy.getBySel(dataCy.plans.planEdit.deactivateButton).click();
      cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();
      cy.getMatSnackBar().should('contain.text', 'Plan deactivated');
      cy.getBySel(dataCy.plans.planEdit.activeNotice).should('not.exist');
    }

    beforeEach(() => {
      cy.get('@ephemeralUserId').then((userId) => {
        cy.task('plans:resetActive', { userId });
        cy.navigateTo('plans');
        cy.getBySel(dataCy.plans.planList.viewPlanButton).click();
      });
    });

    describe('editing a plan that is not in use', () => {
      it('allows a user to reorder training days and exercises', { tags: ['PLAN-09'] }, () => {
        // Reorder days: Workout A and Workout B swap places. Days are a tab strip now, so the
        // ordering is edited in its own dialog rather than by dragging the days themselves.
        cy.getBySel(dataCy.plans.planEdit.days.tab).eq(0).should('contain.text', 'Workout A');
        cy.getBySel(dataCy.plans.planEdit.days.tab).eq(1).should('contain.text', 'Workout B');

        openDayMenuAction(dataCy.plans.planEdit.reorderDaysButton);
        cy.getBySel(dataCy.plans.planEdit.dialogs.reorderDays.list).should('be.visible');
        cy.dragBySel(
          dataCy.plans.planEdit.dialogs.reorderDays.handle,
          dataCy.plans.planEdit.dialogs.reorderDays.item,
          0,
          1
        );
        cy.getBySel(dataCy.plans.planEdit.dialogs.reorderDays.item).eq(0).should('contain.text', 'Workout B');
        cy.getBySel(dataCy.plans.planEdit.dialogs.reorderDays.saveButton).click();
        cy.getBySel(dataCy.plans.planEdit.dialogs.reorderDays.list).should('not.exist');

        cy.getBySel(dataCy.plans.planEdit.days.tab).eq(0).should('contain.text', 'Workout B');
        cy.getBySel(dataCy.plans.planEdit.days.tab).eq(1).should('contain.text', 'Workout A');
        cy.getMatSnackBar().should('contain.text', 'Day order updated');

        // Reorder exercises within Workout A, which the reorder moved to the second tab. The selection
        // follows the day rather than the position, so it is still the day on screen; clicking its tab
        // is belt and braces. Only the selected day is rendered, so exercise and set selectors no
        // longer need scoping to a day. Sets themselves are not reorderable: within one exercise they
        // differ only by reps and weight, both editable in place.
        cy.getBySel(dataCy.plans.planEdit.days.tab).eq(1).click();
        cy.getBySel(dataCy.plans.planEdit.exercises.name).eq(0).should('contain.text', 'Squat');
        cy.getBySel(dataCy.plans.planEdit.exercises.name).eq(1).should('contain.text', 'Bench Press');

        cy.dragBySel(dataCy.plans.planEdit.exercises.dragHandle, dataCy.plans.planEdit.exercises.item, 0, 1);

        cy.getBySel(dataCy.plans.planEdit.exercises.name).eq(0).should('contain.text', 'Bench Press');
        cy.getBySel(dataCy.plans.planEdit.exercises.name).eq(1).should('contain.text', 'Squat');
        cy.getMatSnackBar().should('contain.text', 'Exercise order updated');
      });
      it('allows a user to adjust a set\'s weight with the inline stepper', { tags: ['PLAN-10'] }, () => {
        cy.intercept('PUT', '**/sets/*').as('updateSet');

        // The stepper steps by the exercise's own progression increment - 2.5 kg for the scaffolded
        // squat - so the buttons move the weight by the amount this lift actually progresses in.
        cy.getBySel(dataCy.plans.planEdit.exercises.item).eq(0).within(() => {
          cy.getBySel(dataCy.plans.planEdit.sets.weight).eq(0).should('contain.text', '100');

          cy.getBySel(dataCy.plans.planEdit.sets.increaseWeightButton).eq(0).click();
          cy.getBySel(dataCy.plans.planEdit.sets.weight).eq(0).should('contain.text', '102.5');

          // Two more taps inside the debounce window: the row keeps up optimistically, and only the
          // value the user settles on is written.
          cy.getBySel(dataCy.plans.planEdit.sets.increaseWeightButton).eq(0).click();
          cy.getBySel(dataCy.plans.planEdit.sets.increaseWeightButton).eq(0).click();
          cy.getBySel(dataCy.plans.planEdit.sets.weight).eq(0).should('contain.text', '107.5');

          // ...and back down by the same increment, so the pair is symmetrical.
          cy.getBySel(dataCy.plans.planEdit.sets.decreaseWeightButton).eq(0).click();
          cy.getBySel(dataCy.plans.planEdit.sets.weight).eq(0).should('contain.text', '105');
        });

        // Reload from the server: the settled value is what was saved. Waiting on the write first, so
        // the reload cannot outrun the debounce and read the weight back before anything was sent.
        cy.wait('@updateSet').its('request.body').should('deep.equal', { expected_weight: 105 });
        cy.reload();
        cy.getBySel(dataCy.plans.planEdit.exercises.item).eq(0).within(() => {
          cy.getBySel(dataCy.plans.planEdit.sets.weight).eq(0).should('contain.text', '105');
        });
      });
    });

    describe('activating and deleting a plan', () => {
      it('allows a user to activate a plan', { tags: ['PLAN-11'] }, () => {
        cy.getBySel(dataCy.plans.planEdit.activateButton).click();

        cy.url().should('include', '/home');
        cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Workout A'); // First workout from the plan
        cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Squat: 3x5 @ 100 kg'); // Initial squat weight from the plan
        cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Bench Press: 3x5 @ 70 kg'); // Initial bench press weight from the plan
      });
      it('allows a user to delete a plan that has not been used', { tags: ['PLAN-12'] }, () => {
        cy.getBySel(dataCy.plans.planEdit.editButton).click();
        cy.getBySel(dataCy.plans.dialogs.plans.deleteButton).click();
        cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();

        cy.url().should('include', '/plans');
        cy.getBySel(dataCy.plans.planList.noPlansNotice).should('be.visible');
      });
    });

    describe('a plan that has been trained', () => {
      it('keeps a trained plan editable but no longer deletable', { tags: ['PLAN-13'] }, () => {
        completeOneSessionAndReturnToPlan();

        // While the plan is the active one it is read-only, and says so rather than sitting inert.
        cy.getBySel(dataCy.plans.planEdit.activeNotice).should('be.visible');
        cy.getBySel(dataCy.plans.planEdit.exercises.addSetButton).should('not.exist');
        cy.getBySel(dataCy.plans.planEdit.sets.increaseWeightButton).should('not.exist');
        cy.getBySel(dataCy.plans.planEdit.exercises.menuButton).should('not.exist');

        deactivateForEditing();

        // Unlocked, the plan is not locked wholesale by its history either. What history restricts is
        // deletion of the structure it points at - not tuning the numbers, which each session
        // snapshotted its own copy of.
        cy.getBySel(dataCy.plans.planEdit.historyNotice).should('be.visible');

        cy.getBySel(dataCy.plans.planEdit.exercises.item).eq(0).within(() => {
          cy.getBySel(dataCy.plans.planEdit.sets.increaseWeightButton).should('exist');
          cy.getBySel(dataCy.plans.planEdit.sets.editButton).should('exist');
          cy.getBySel(dataCy.plans.planEdit.exercises.addSetButton).should('exist');
        });

        // Deleting an exercise would take its recorded sets with it, so the entry is gone and
        // archiving takes its place - the same way archiving is absent on a plan with no history.
        cy.getBySel(dataCy.plans.planEdit.exercises.menuButton).eq(0).click();
        cy.getBySel(dataCy.plans.planEdit.exercises.deleteButton).should('not.exist');
        cy.getBySel(dataCy.plans.planEdit.exercises.archiveButton).should('exist');
        cy.get('body').type('{esc}');

        // Reordering survives too. It was withdrawn under an open session while progression read the
        // live plan to judge a set; now that the session carries its own copy, moving an exercise
        // cannot change what any recorded set is measured against.
        cy.getBySel(dataCy.plans.planEdit.exercises.dragHandle).should('exist');

        // The same one level up, for the day - inside its edit dialog, which is where removing a day
        // lives so that the two surfaces cannot disagree about whether one may be deleted.
        openDayMenuAction(dataCy.plans.planEdit.days.editButton);
        cy.getBySel(dataCy.plans.dialogs.days.deleteButton).should('not.exist');
        cy.getBySel(dataCy.plans.dialogs.days.archiveButton).should('exist');
        cy.getBySel(dataCy.plans.dialogs.days.cancelButton).click();
      });
      it('archives an exercise out of a trained plan without losing its history', { tags: ['PLAN-14'] }, () => {
        completeOneSessionAndReturnToPlan();
        deactivateForEditing();

        cy.getBySel(dataCy.plans.planEdit.exercises.name).eq(0).should('contain.text', 'Squat');
        cy.getBySel(dataCy.plans.planEdit.exercises.item).should('have.length', 2);

        openExerciseMenuAction(dataCy.plans.planEdit.exercises.archiveButton);
        cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();
        cy.getMatSnackBar().should('contain.text', 'Exercise archived');

        // Gone from the plan the user is editing...
        cy.getBySel(dataCy.plans.planEdit.exercises.item).should('have.length', 1);
        cy.getBySel(dataCy.plans.planEdit.exercises.name).eq(0).should('contain.text', 'Bench Press');

        // ...but the workout that trained it still renders it, which a hard delete could not have done.
        // The history page opens on the calendar unless the list is asked for by name.
        cy.visit('/history?view=list');
        cy.getBySel(dataCy.history.sessionCard).first().within(() => {
          cy.getBySel(dataCy.history.sessionNavigateButton).click({ force: true });
        });
        cy.getBySel(dataCy.sessions.exerciseItem).should('contain.text', 'Squat');
      });
      it('archives a whole training day without losing the workouts trained from it', { tags: ['PLAN-15'] }, () => {
        completeOneSessionAndReturnToPlan();
        deactivateForEditing();

        cy.getBySel(dataCy.plans.planEdit.days.tab).should('have.length', 2);
        cy.getBySel(dataCy.plans.planEdit.days.tab).eq(0).should('contain.text', 'Workout A');

        // Workout A is the day the session above trained, so `sessions.plan_day_id` points at it.
        // Deleting it is refused by the database; archiving is what takes it out of the plan.
        openDayMenuAction(dataCy.plans.planEdit.days.editButton);
        cy.getBySel(dataCy.plans.dialogs.days.archiveButton).click();
        cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();
        cy.getMatSnackBar().should('contain.text', 'Day archived');

        // Gone from the tab strip, and the day that remains keeps its own identity.
        cy.getBySel(dataCy.plans.planEdit.days.tab).should('have.length', 1);
        cy.getBySel(dataCy.plans.planEdit.days.tab).eq(0).should('contain.text', 'Workout B');

        // The workout it was trained from still names the day it belonged to. History resolves that
        // name through the plan, so without `include_archived` the card would read "N/A" instead.
        cy.visit('/history?view=list');
        cy.getBySel(dataCy.history.sessionCard).first().should('contain.text', 'Workout A');
      });
      it('judges a session against what it prescribed, not a weight changed mid-workout', { tags: ['PLAN-16'] }, () => {
        cy.getBySel(dataCy.plans.planEdit.activateButton).click();
        cy.url().should('include', '/home');

        // Move the plan under the open session. The editor will not do this - an active plan is
        // read-only - but the API accepts the write and so would any hand-rolled request, which is
        // precisely the case the session snapshot has to survive. Driving it through the database
        // keeps the test about the server's behaviour rather than about what the UI permits.
        cy.get('@ephemeralUserId').then((userId) => {
          cy.task('plans:setExpectedWeight', { userId, exerciseName: 'Squat', weight: 102.5 });
        });

        // Complete the session as it was prescribed: every set, at the 100 kg it was created with.
        cy.getBySel(dataCy.sessions.sessionCard.navigateButton).click({ force: true });
        cy.getBySel(dataCy.sessions.set.bubble).its('length').then((count: number) => {
          for (let i = 0; i < count; i++) {
            cy.getBySel(dataCy.sessions.set.bubble).eq(i).click();
          }
        });
        // No confirmation: the session page only asks when sets are left unfinished, and none are.
        cy.getBySel(dataCy.sessions.completeButton).click({ force: true });

        cy.navigateTo('plans');
        cy.getBySel(dataCy.plans.planList.viewPlanButton).click();
        cy.getBySel(dataCy.plans.planEdit.exercises.item).should('exist');
        cy.getBySel(dataCy.plans.planEdit.exercises.item).eq(0).within(() => {
          // 102.5 progressed by the 2.5 kg increment. The session was judged against the 100 kg it was
          // created with and succeeded; the new target is then computed from the plan's current 102.5.
          // Judged against the live plan instead - which is what happened before the snapshot existed -
          // 100 kg would have fallen short of 102.5 and the exercise would have been marked a failure,
          // leaving the weight at 102.5 and incrementing the failure count.
          cy.getBySel(dataCy.plans.planEdit.sets.weight).eq(0).should('contain.text', '105');
        });
      });
    });

  });
});
