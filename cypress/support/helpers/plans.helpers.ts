import { dataCy } from '../selectors';

/**
 * UI flows for building a training plan in the plan editor, shared between specs.
 * Each step starts from the plan editor page.
 */

export function createPlan(name = 'Test Training Plan') {
  cy.getBySel(dataCy.plans.planList.createButton).click();
  cy.getBySel(dataCy.plans.dialogs.plans.title).should('contain.text', 'Create New Plan');
  cy.getBySel(dataCy.plans.dialogs.plans.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.plans.nameInput).type(name);
  cy.getBySel(dataCy.plans.dialogs.plans.saveButton).click();

  cy.getBySel(dataCy.plans.dialogs.plans.content).should('not.exist');
  cy.getBySel(dataCy.plans.planEdit.name).should('contain.text', name);
}

export function createPlanDay(name = 'Test Training Day') {
  clickPageOrDayMenuAction(dataCy.plans.planEdit.addDayButton);

  cy.getBySel(dataCy.plans.dialogs.days.title).should('contain.text', 'Add New Day');
  cy.getBySel(dataCy.plans.dialogs.days.content).should('be.visible');
  cy.getBySel(dataCy.plans.dialogs.days.nameInput).type(name);
  cy.getBySel(dataCy.plans.dialogs.days.saveButton).click();

  cy.getBySel(dataCy.plans.planEdit.days.item).should('exist');
  cy.getBySel(dataCy.plans.planEdit.days.tab).should('contain.text', name);
}

/**
 * Clicks a menu item and waits for the panel to go.
 *
 * Several actions appear both on the page and in a menu - "Add training day" is in the plan menu
 * and in the day list's empty state - so the click is scoped to what is actually on screen. Waiting
 * for the panel to close matters just as much: a menu that is still animating out leaves a second
 * copy of its items in the DOM, and the next helper call then matches two elements.
 */
function clickVisible(selector: string) {
  cy.getBySel(selector).filter(':visible').first().click();
  cy.get('.mat-mdc-menu-panel').should('not.exist');
}

/**
 * Clicks an action that is on the page when there is somewhere to put it and in the day menu
 * otherwise.
 *
 * "Add training day" is the only one: the day list offers it directly while a plan has no days, and
 * folds it into the day menu once the tab strip exists.
 */
function clickPageOrDayMenuAction(selector: string) {
  // Any menu still on screen is dismissed first, so the visibility check below cannot be answered by
  // a panel that is on its way out - and cannot then find that panel gone by the time it clicks.
  cy.get('body').then($body => {
    if ($body.find('.mat-mdc-menu-panel').length > 0) {
      cy.get('body').type('{esc}');
      cy.get('.mat-mdc-menu-panel').should('not.exist');
    }
  });

  cy.get('body').then($body => {
    const onPage = $body.find(`[data-cy="${selector}"]:visible`);
    if (onPage.length > 0) {
      // Clicking the element found here, rather than re-querying, so nothing can change underneath.
      cy.wrap(onPage.first()).click();
      return;
    }
    openDayMenuAction(selector);
  });
}

/** Opens the selected day's overflow menu and clicks one of its items. */
export function openDayMenuAction(selector: string) {
  cy.getBySel(dataCy.plans.planEdit.days.menuButton).click();
  clickVisible(selector);
}

/** Opens an exercise's overflow menu and clicks one of its items. */
export function openExerciseMenuAction(selector: string, index = 0) {
  cy.getBySel(dataCy.plans.planEdit.exercises.menuButton).eq(index).click();
  clickVisible(selector);
}

/**
 * Adds an exercise to the selected day.
 *
 * `expectProgressionDialog` is false when the plan already has a progression for this exercise -
 * they are keyed by (plan, exercise), so adding the same lift to a second day reuses the rule that
 * already exists and the editor does not prompt again.
 *
 * `skipProgression` dismisses that dialog instead of filling it in, leaving the exercise without a
 * progression rule - which is a state the editor allows and activation does not.
 */
export function createPlanExercise({ name, createGlobal, expectProgressionDialog = true, skipProgression = false }: { name?: string; createGlobal?: boolean; expectProgressionDialog?: boolean; skipProgression?: boolean } = {}) {
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

  if (expectProgressionDialog) {
    cy.getBySel(dataCy.plans.dialogs.exerciseProgression.title).should('contain.text', 'Edit Exercise Progression');
    cy.getBySel(dataCy.plans.dialogs.exerciseProgression.content).should('be.visible');

    if (skipProgression) {
      cy.getBySel(dataCy.plans.dialogs.exerciseProgression.cancelButton).click();
    } else {
      cy.getBySel(dataCy.plans.dialogs.exerciseProgression.weightIncrementInput).type('2.5');
      cy.getBySel(dataCy.plans.dialogs.exerciseProgression.saveButton).click();
    }

    cy.getBySel(dataCy.plans.dialogs.exerciseProgression.content).should('not.exist');
  }

  // The chip states the increment when a rule exists and invites one when it does not.
  cy.getBySel(skipProgression
    ? dataCy.plans.planEdit.exercises.addProgressionButton
    : dataCy.plans.planEdit.exercises.editProgressionButton).should('exist');

  cy.getBySel(dataCy.plans.planEdit.exercises.item).should('exist');
  cy.getBySel(dataCy.plans.planEdit.exercises.name).should('contain.text', name);
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
  // Reps and weight are separate columns of the set table now, not one "10 x 100kg" string.
  expectPlanExerciseSet({ reps, weight });
}

/** Asserts a set row's reps and weight, by position within the currently scoped exercise. */
export function expectPlanExerciseSet({ reps, weight, index = 0 }: { reps: string; weight: string; index?: number }) {
  cy.getBySel(dataCy.plans.planEdit.sets.reps).eq(index).should('contain.text', reps);
  cy.getBySel(dataCy.plans.planEdit.sets.weight).eq(index).should('contain.text', weight);
}
