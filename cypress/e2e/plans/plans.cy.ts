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
      cy.getBySel('plan-card').should('contain.text', 'Test Training Plan');
    });

    it('allows a user to view and navigate to a plan', { tags: ['@smoke', 'PLAN-02'] }, () => {
      cy.getBySel('active-plan-card').should('be.visible').and('contain.text', 'Test Training Plan');
      cy.getBySel('view-plan-button').click();

      cy.url().should('match', /\/plans\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

      cy.getBySel('plan-metadata').should('be.visible').and('contain.text', 'Test Training Plan');
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
      cy.getBySel('plan-day-edit-button').click();
      cy.getBySel('add-edit-day-dialog-title').should('contain.text', 'Edit Day');
      cy.getBySel('add-edit-day-dialog-name-input').clear().type('Edited Training Day');
      cy.getBySel('add-edit-day-dialog-save-button').click();
      cy.getBySel('plan-day-name').should('contain.text', 'Edited Training Day');

      // Delete a day
      cy.getBySel('plan-day-edit-button').click();
      cy.getBySel('add-edit-day-dialog-delete-button').click();
      cy.getBySel('confirmation-dialog-confirm-button').click();
      cy.getBySel('plan-day-item').should('not.exist');
    });

    it('allows a user to add an exercise to a day, edit its progression, and delete it', { tags: ['PLAN-04'] }, () => {
      // Add an exercise
      createTrainingPlanDay();
      createTrainingPlanExercise({ name: 'Test Training Exercise' });

      // Edit exercise progression
      cy.getBySel('plan-exercise-edit-progression-button').click();
      cy.getBySel('edit-exercise-progression-dialog-title').should('contain.text', 'Edit Exercise Progression');
      cy.getBySel('edit-exercise-progression-dialog-weight-increment-input').clear().type('5');
      cy.getBySel('edit-exercise-progression-dialog-save-button').click();
      cy.getBySel('edit-exercise-progression-dialog-content').should('not.exist');

      // Delete an exercise
      cy.getBySel('plan-exercise-delete-button').click();
      cy.getBySel('confirmation-dialog-confirm-button').click();
      cy.getBySel('plan-exercise-item').should('not.exist');
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
      cy.getBySel('plan-exercise-set-edit-button').click();
      cy.getBySel('add-edit-set-dialog-content').should('be.visible');
      cy.getBySel('add-edit-set-dialog-reps-input').clear().type('11');
      cy.getBySel('add-edit-set-dialog-weight-input').clear().type('110');
      cy.getBySel('add-edit-set-dialog-save-button').click();
      cy.getBySel('add-edit-set-dialog-content').should('not.exist');
      cy.getBySel('plan-exercise-set-item').should('exist');
      cy.getBySel('plan-exercise-set-details').should('contain.text', '11 x 110kg');

      // Delete a set
      cy.getBySel('plan-exercise-set-delete-button').click();
      cy.getBySel('plan-exercise-set-item').should('not.exist');
    });
  });

  describe('when viewing the plan editor page with an existing, inactive plan', () => {
    beforeEach(() => {
      cy.get('@ephemeralUserId').then((userId) => {
        cy.task('plans:resetActiveTrainingPlan', { userId });
        cy.navigateTo('plans');
        cy.getBySel('view-plan-button').click();
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
      cy.getBySel('plan-activate-button').click();

      cy.url().should('include', '/home');
      cy.getBySel('session-card').should('contain.text', 'Workout A'); // First workout from the plan
      cy.getBySel('session-card').should('contain.text', 'Squat: 3x5 @ 100 kg'); // Initial squat weight from the plan
      cy.getBySel('session-card').should('contain.text', 'Bench Press: 3x5 @ 70 kg'); // Initial bench press weight from the plan
    });

    it('makes a plan read-only after it has been used in a session', { tags: ['PLAN-09'] }, () => {
      cy.getBySel('plan-activate-button').click();

      // Complete a training session and navigate back to the plan editor
      cy.getBySel('session-navigate-button').click({ force: true });
      cy.getBySel('set-bubble').first().click();
      cy.getBySel('complete-session-button').click({ force: true });
      cy.getBySel('confirmation-dialog-confirm-button').click();
      cy.navigateTo('plans');
      cy.getBySel('view-plan-button').click();

      cy.getBySel('plan-metadata-read-only-notice').should('be.visible');
      cy.getBySel('plan-add-day-button').should('not.exist');
      cy.getBySel('plan-toggle-preview-button').should('not.exist');
      cy.getBySel('plan-edit-button').should('not.exist');
      cy.getBySel('plan-day-add-exercise-button').should('not.exist');
      cy.getBySel('plan-day-edit-button').should('not.exist');
      cy.getBySel('plan-exercise-add-progression-button').should('not.exist');
      cy.getBySel('plan-exercise-edit-progression-button').should('not.exist');
      cy.getBySel('plan-exercise-delete-button').should('not.exist');
      cy.getBySel('plan-exercise-add-set-button').should('not.exist');
      cy.getBySel('plan-exercise-set-edit-button').should('not.exist');
      cy.getBySel('plan-exercise-set-delete-button').should('not.exist');
    });

    it('allows a user to delete a training plan that has not been used', { tags: ['PLAN-10'] }, () => {
      cy.getBySel('plan-edit-button').click();
      cy.getBySel('add-edit-plan-dialog-delete-button').click();
      cy.getBySel('confirmation-dialog-confirm-button').click();

      cy.url().should('include', '/plans');
      cy.getBySel('no-plans-notice').should('be.visible');
    });
  });
});

function createTrainingPlan() {
  cy.getBySel('plan-fab-create-button').click();
  cy.getBySel('add-edit-plan-dialog-title').should('contain.text', 'Create New Plan');
  cy.getBySel('add-edit-plan-dialog-content').should('be.visible');
  cy.getBySel('add-edit-plan-dialog-name-input').type('Test Training Plan');
  cy.getBySel('add-edit-plan-dialog-save-button').click();

  cy.getBySel('add-edit-plan-dialog-content').should('not.exist');
  cy.getBySel('plan-metadata').should('contain.text', 'Test Training Plan');
}

function createTrainingPlanDay() {
  cy.getBySel('plan-add-day-button').click();
  cy.getBySel('add-edit-day-dialog-title').should('contain.text', 'Add New Day');
  cy.getBySel('add-edit-day-dialog-content').should('be.visible');
  cy.getBySel('add-edit-day-dialog-name-input').type('Test Training Day');
  cy.getBySel('add-edit-day-dialog-save-button').click();

  cy.getBySel('plan-day-item').should('exist');
  cy.getBySel('plan-day-name').should('contain.text', 'Test Training Day');
  cy.getBySel('plan-day-item').click();
}

function createTrainingPlanExercise({ name, createGlobal }: { name?: string; createGlobal?: boolean } = {}) {
  cy.getBySel('plan-day-add-exercise-button').click();
  cy.getBySel('add-exercise-dialog-title').should('contain.text', 'Add New Exercise');
  cy.getBySel('add-exercise-dialog-content').should('be.visible');
  cy.getBySel('add-exercise-dialog-exercise-input').type(name!);
  cy.getBySel('add-exercise-dialog-exercise-autocomplete-option').contains(name!).click();
  if (createGlobal) {
    cy.getBySel('add-exercise-dialog-new-exercise-global-notice').should('be.visible');
  }
  cy.getBySel('add-exercise-dialog-save-button').click();
  cy.getBySel('add-exercise-dialog-content').should('not.exist');

  cy.getBySel('edit-exercise-progression-dialog-title').should('contain.text', 'Edit Exercise Progression');
  cy.getBySel('edit-exercise-progression-dialog-content').should('be.visible');
  cy.getBySel('edit-exercise-progression-dialog-weight-increment-input').type('2.5');
  cy.getBySel('edit-exercise-progression-dialog-save-button').click();
  cy.getBySel('edit-exercise-progression-dialog-content').should('not.exist');
  cy.getBySel('plan-exercise-edit-progression-button').should('exist');

  cy.getBySel('plan-exercise-item').should('exist');
  cy.getBySel('plan-exercise-name').should('contain.text', name);
  cy.getBySel('plan-exercise-item').click();
}

function createTrainingPlanExerciseSet() {
  cy.getBySel('plan-exercise-add-set-button').click();
  cy.getBySel('add-edit-set-dialog-content').should('be.visible');
  cy.getBySel('add-edit-set-dialog-reps-input').type('10');
  cy.getBySel('add-edit-set-dialog-weight-input').type('100');
  cy.getBySel('add-edit-set-dialog-save-button').click();
  cy.getBySel('add-edit-set-dialog-content').should('not.exist');

  cy.getBySel('plan-exercise-set-item').should('exist');
  cy.getBySel('plan-exercise-set-details').should('contain.text', '10 x 100kg');
}
