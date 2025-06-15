import { dataCy } from '../../support/selectors';

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

    it('allows a user to create a new training plan', { tags: ['PLAN-01'] }, () => {
      createTrainingPlan();

      cy.navigateBack();
      cy.getBySel(dataCy.plans.planList.planCard).should('contain.text', 'Test Training Plan');
    });

    it('allows a user to view and navigate to a plan', { tags: ['@smoke', 'PLAN-02'] }, () => {
      cy.getBySel(dataCy.plans.planList.activePlanCard).should('be.visible').and('contain.text', 'Test Training Plan');
      cy.getBySel(dataCy.plans.planList.viewPlanButton).click();

      cy.url().should('match', /\/plans\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

      cy.getBySel(dataCy.plans.planEdit.metadata).should('be.visible').and('contain.text', 'Test Training Plan');
    });
  });

  describe('when viewing the plan editor page with a freshly created plan', () => {
    beforeEach(() => {
      cy.navigateTo('plans');
      createTrainingPlan();
    });

    it('allows a user to add, edit and delete a new training day', { tags: ['PLAN-03'] }, () => {
      // Add a day
      createTrainingPlanDay();

      // Edit a day
      cy.getBySel(dataCy.plans.planEdit.days.editButton).click();
      cy.getBySel(dataCy.plans.dialogs.days.title).should('contain.text', 'Edit Day');
      cy.getBySel(dataCy.plans.dialogs.days.nameInput).clear().type('Edited Training Day');
      cy.getBySel(dataCy.plans.dialogs.days.saveButton).click();
      cy.getBySel(dataCy.plans.planEdit.days.name).should('contain.text', 'Edited Training Day');

      // Delete a day
      cy.getBySel(dataCy.plans.planEdit.days.editButton).click();
      cy.getBySel(dataCy.plans.dialogs.days.deleteButton).click();
      cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();
      cy.getBySel(dataCy.plans.planEdit.days.item).should('not.exist');
    });

    it('allows a user to add an exercise to a day, edit its progression, and delete it', { tags: ['PLAN-04'] }, () => {
      // Add an exercise
      createTrainingPlanDay();
      createTrainingPlanExercise({ name: 'Test Training Exercise' });

      // Edit exercise progression
      cy.getBySel(dataCy.plans.planEdit.exercises.editProgressionButton).click();
      cy.getBySel(dataCy.plans.dialogs.exerciseProgression.title).should('contain.text', 'Edit Exercise Progression');
      cy.getBySel(dataCy.plans.dialogs.exerciseProgression.weightIncrementInput).clear().type('5');
      cy.getBySel(dataCy.plans.dialogs.exerciseProgression.saveButton).click();
      cy.getBySel(dataCy.plans.dialogs.exerciseProgression.content).should('not.exist');

      // Delete an exercise
      cy.getBySel(dataCy.plans.planEdit.exercises.deleteButton).click();
      cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();
      cy.getBySel(dataCy.plans.planEdit.exercises.item).should('not.exist');
    });

    it('allows a user to create a global exercise and add this exercise to a training day in a plan', { tags: ['PLAN-05'] }, () => {
      cy.wrap(`New Exercise ${Date.now()}`).as('newExerciseName').then((name) => {
        // Create a global exercise and add it to a training day
        createTrainingPlanDay();
        createTrainingPlanExercise({ name, createGlobal: true });
      });
    });

    it('allows a user to add, edit, and delete a set for an exercise', { tags: ['PLAN-06'] }, () => {
      // Add a set
      createTrainingPlanDay();
      createTrainingPlanExercise({ name: 'Test Training Exercise' });
      createTrainingPlanExerciseSet();

      // Edit a set
      cy.getBySel(dataCy.plans.planEdit.sets.editButton).click();
      cy.getBySel(dataCy.plans.dialogs.sets.content).should('be.visible');
      cy.getBySel(dataCy.plans.dialogs.sets.title).should('contain.text', 'Edit Set');
      cy.getBySel(dataCy.plans.dialogs.sets.repsInput).clear().type('11');
      cy.getBySel(dataCy.plans.dialogs.sets.weightInput).clear().type('110');
      cy.getBySel(dataCy.plans.dialogs.sets.saveButton).click();
      cy.getBySel(dataCy.plans.dialogs.sets.content).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.sets.item).should('exist');
      cy.getBySel(dataCy.plans.planEdit.sets.details).should('contain.text', '11 x 110kg');

      // Delete a set
      cy.getBySel(dataCy.plans.planEdit.sets.deleteButton).click();
      cy.getBySel(dataCy.plans.planEdit.sets.item).should('not.exist');
    });
  });

  describe('when viewing the plan editor page with an existing, inactive plan', () => {
    beforeEach(() => {
      cy.get('@ephemeralUserId').then((userId) => {
        cy.task('plans:resetActiveTrainingPlan', { userId });
        cy.navigateTo('plans');
        cy.getBySel(dataCy.plans.planList.viewPlanButton).click();
      });
    });

    it.skip('TODO: allows a user to reorder training days, exercises and sets', { tags: ['@todo', 'PLAN-07'] }, () => {
      // Reorder days
      // ...

      // Reorder exercises
      // ...

      // Reorder sets
      // ...
    });

    it('allows a user to activate a plan', { tags: ['PLAN-08'] }, () => {
      cy.getBySel(dataCy.plans.planEdit.activateButton).click();

      cy.url().should('include', '/home');
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Workout A'); // First workout from the plan
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Squat: 3x5 @ 100 kg'); // Initial squat weight from the plan
      cy.getBySel(dataCy.home.sessionCard).should('contain.text', 'Bench Press: 3x5 @ 70 kg'); // Initial bench press weight from the plan
    });

    it('makes a plan read-only after it has been used in a session', { tags: ['PLAN-09'] }, () => {
      cy.getBySel(dataCy.plans.planEdit.activateButton).click();

      // Complete a training session and navigate back to the plan editor
      cy.getBySel(dataCy.home.sessionNavigateButton).click({ force: true });
      cy.getBySel(dataCy.sessions.set.bubble).first().click();
      cy.getBySel(dataCy.sessions.completeButton).click({ force: true });
      cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();
      cy.navigateTo('plans');
      cy.getBySel(dataCy.plans.planList.viewPlanButton).click();

      cy.getBySel(dataCy.plans.planEdit.readOnlyNotice).should('be.visible');
      cy.getBySel(dataCy.plans.planEdit.addDayButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.togglePreviewButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.editButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.days.addExerciseButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.days.editButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.exercises.addProgressionButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.exercises.editProgressionButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.exercises.deleteButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.exercises.addSetButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.sets.editButton).should('not.exist');
      cy.getBySel(dataCy.plans.planEdit.sets.deleteButton).should('not.exist');
    });

    it('allows a user to delete a training plan that has not been used', { tags: ['PLAN-10'] }, () => {
      cy.getBySel(dataCy.plans.planEdit.editButton).click();
      cy.getBySel(dataCy.plans.dialogs.plans.deleteButton).click();
      cy.getBySel(dataCy.shared.dialogs.confirmation.confirmButton).click();

      cy.url().should('include', '/plans');
      cy.getBySel(dataCy.plans.planList.noPlansNotice).should('be.visible');
    });
  });
});

function createTrainingPlan() {
  cy.getBySel(dataCy.plans.planList.createButton).click();
  cy.getBySel(dataCy.plans.dialogs.plans.title).should('contain.text', 'Create New Plan');
  cy.getBySel(dataCy.plans.dialogs.plans.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.plans.nameInput).type('Test Training Plan');
  cy.getBySel(dataCy.plans.dialogs.plans.saveButton).click();

  cy.getBySel(dataCy.plans.dialogs.plans.content).should('not.exist');
  cy.getBySel(dataCy.plans.planEdit.metadata).should('contain.text', 'Test Training Plan');
}

function createTrainingPlanDay() {
  cy.getBySel(dataCy.plans.planEdit.addDayButton).click();
  cy.getBySel(dataCy.plans.dialogs.days.title).should('contain.text', 'Add New Day');
  cy.getBySel(dataCy.plans.dialogs.days.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.days.nameInput).type('Test Training Day');
  cy.getBySel(dataCy.plans.dialogs.days.saveButton).click();

  cy.getBySel(dataCy.plans.planEdit.days.item).should('exist');
  cy.getBySel(dataCy.plans.planEdit.days.name).should('contain.text', 'Test Training Day');
  cy.getBySel(dataCy.plans.planEdit.days.item).click();
}

function createTrainingPlanExercise({ name, createGlobal }: { name?: string; createGlobal?: boolean } = {}) {
  cy.getBySel(dataCy.plans.planEdit.days.addExerciseButton).click();
  cy.getBySel(dataCy.plans.dialogs.exercises.title).should('contain.text', 'Add New Exercise');
  cy.getBySel(dataCy.plans.dialogs.exercises.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.exercises.exerciseInput).type(name!);
  cy.getBySel(dataCy.plans.dialogs.exercises.exerciseAutocompleteOption).contains(name!).click();
  if (createGlobal) {
    cy.getBySel(dataCy.plans.dialogs.exercises.newGlobalExerciseNotice).should('be.visible');
  }
  cy.getBySel(dataCy.plans.dialogs.exercises.saveButton).click();
  cy.getBySel(dataCy.plans.dialogs.exercises.content).should('not.exist');

  cy.getBySel(dataCy.plans.dialogs.exerciseProgression.title).should('contain.text', 'Edit Exercise Progression');
  cy.getBySel(dataCy.plans.dialogs.exerciseProgression.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.exerciseProgression.weightIncrementInput).type('2.5');
  cy.getBySel(dataCy.plans.dialogs.exerciseProgression.saveButton).click();
  cy.getBySel(dataCy.plans.dialogs.exerciseProgression.content).should('not.exist');
  cy.getBySel(dataCy.plans.planEdit.exercises.editProgressionButton).should('exist');

  cy.getBySel(dataCy.plans.planEdit.exercises.item).should('exist');
  cy.getBySel(dataCy.plans.planEdit.exercises.name).should('contain.text', name);
  cy.getBySel(dataCy.plans.planEdit.exercises.item).click();
}

function createTrainingPlanExerciseSet() {
  cy.getBySel(dataCy.plans.planEdit.exercises.addSetButton).click();
  cy.getBySel(dataCy.plans.dialogs.sets.title).should('contain.text', 'Add Set');
  cy.getBySel(dataCy.plans.dialogs.sets.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.sets.repsInput).type('10');
  cy.getBySel(dataCy.plans.dialogs.sets.weightInput).type('100');
  cy.getBySel(dataCy.plans.dialogs.sets.saveButton).click({ force: true });
  cy.getBySel(dataCy.plans.dialogs.sets.content).should('not.exist');

  cy.getBySel(dataCy.plans.planEdit.sets.item).should('exist');
  cy.getBySel(dataCy.plans.planEdit.sets.details).should('contain.text', '10 x 100kg');
}
