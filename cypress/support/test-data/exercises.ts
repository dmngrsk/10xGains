/**
 * The global exercises the scaffold guarantees exist before any spec runs. Exercises are global
 * rows shared by every user, so they are seeded once rather than per user.
 */

/** The exercises the scaffolded training plan is built from. */
export const SCAFFOLD_PLAN_EXERCISES = ['Squat', 'Bench Press', 'Deadlift'] as const;

/**
 * The exercise the plan specs add to a day (PLAN-04, PLAN-06). No scaffolded session trains it -
 * it exists purely so those specs have an existing exercise to pick from the autocomplete.
 *
 * It is seeded rather than left to the specs on purpose: the add-exercise autocomplete creates a
 * global exercise when the typed name does not exist yet, so on a fresh database PLAN-04/06 would
 * silently take PLAN-05's create-global path - covering the wrong flow and leaving the row behind
 * for every later run to reuse. Seeding it keeps those specs on the select-existing path whatever
 * state the database starts in.
 */
export const PLAN_FIXTURE_EXERCISE = 'Test Training Exercise';

/** Every global exercise the scaffold ensures exists. */
export const REQUIRED_EXERCISES: string[] = [...SCAFFOLD_PLAN_EXERCISES, PLAN_FIXTURE_EXERCISE];
