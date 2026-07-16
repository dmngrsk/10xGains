import { dataCy } from '../selectors';

/**
 * UI flows for building a training plan in the plan editor, shared between specs.
 * Each step starts from the plan editor page and leaves the created item expanded.
 */

export function createPlan(name = 'Test Training Plan') {
  cy.getBySel(dataCy.plans.planList.createButton).click();
  cy.getBySel(dataCy.plans.dialogs.plans.title).should('contain.text', 'Create New Plan');
  cy.getBySel(dataCy.plans.dialogs.plans.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.plans.nameInput).type(name);
  cy.getBySel(dataCy.plans.dialogs.plans.saveButton).click();

  cy.getBySel(dataCy.plans.dialogs.plans.content).should('not.exist');
  cy.getBySel(dataCy.plans.planEdit.metadata).should('contain.text', name);
}

export function createPlanDay(name = 'Test Training Day') {
  cy.getBySel(dataCy.plans.planEdit.addDayButton).click();
  cy.getBySel(dataCy.plans.dialogs.days.title).should('contain.text', 'Add New Day');
  cy.getBySel(dataCy.plans.dialogs.days.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.days.nameInput).type(name);
  cy.getBySel(dataCy.plans.dialogs.days.saveButton).click();

  cy.getBySel(dataCy.plans.planEdit.days.item).should('exist');
  cy.getBySel(dataCy.plans.planEdit.days.name).should('contain.text', name);
  cy.getBySel(dataCy.plans.planEdit.days.item).click();
}

export function createPlanExercise({ name, createGlobal }: { name?: string; createGlobal?: boolean } = {}) {
  cy.getBySel(dataCy.plans.planEdit.days.addExerciseButton).click();
  cy.getBySel(dataCy.plans.dialogs.exercises.title).should('contain.text', 'Add New Exercise');
  cy.getBySel(dataCy.plans.dialogs.exercises.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.exercises.exerciseInput).type(name!);
  cy.getBySel(dataCy.plans.dialogs.exercises.exerciseAutocompleteOption).contains(name!).click();
  if (createGlobal) {
    cy.getBySel(dataCy.plans.dialogs.exercises.newGlobalExerciseNotice).should('be.visible');
  } else {
    cy.getBySel(dataCy.plans.dialogs.exercises.newGlobalExerciseNotice).should('not.exist');
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

export function createPlanExerciseSet({ reps, weight }: { reps?: string; weight?: string } = {}) {
  reps = reps ?? '10';
  weight = weight ?? '100';

  cy.getBySel(dataCy.plans.planEdit.exercises.addSetButton).click();
  cy.getBySel(dataCy.plans.dialogs.sets.title).should('contain.text', 'Add Set');
  cy.getBySel(dataCy.plans.dialogs.sets.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.sets.repsInput).type(reps);
  cy.getBySel(dataCy.plans.dialogs.sets.weightInput).type(weight);
  cy.getBySel(dataCy.plans.dialogs.sets.saveButton).click({ force: true });
  cy.getBySel(dataCy.plans.dialogs.sets.content).should('not.exist');

  cy.getBySel(dataCy.plans.planEdit.sets.item).should('exist');
  cy.getBySel(dataCy.plans.planEdit.sets.details).should('contain.text', `${reps} x ${weight}kg`);
}
