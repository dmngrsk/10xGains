import type { PlanExerciseProgressionDto, SessionDto, SessionSetDto } from './api.types';

/**
 * The closed value sets the database constrains columns to.
 *
 * Postgres enums would generate these automatically, but the schema expresses them as
 * `check (col in (...))` constraints instead - which is why `Database['public']['Enums']` is empty.
 * This file is the hand-maintained stand-in: each union is read back off the generated row type
 * rather than retyped, and each runtime list is proved exhaustive against its union, so a migration
 * that adds or removes a value fails the build here instead of leaving a validator silently
 * rejecting a value the database accepts.
 *
 * The runtime lists exist because validators (Zod schemas in `@txg/api`) need the values, not just
 * the type. Add a new union here whenever a `check (... in (...))` constraint is introduced.
 */

/** Every status a training session may hold. */
export type SessionStatus = SessionDto['status'];

/** Every status a session set may hold. */
export type SessionSetStatus = SessionSetDto['status'];

/** Every deload strategy an exercise progression rule may use. */
export type DeloadStrategy = PlanExerciseProgressionDto['deload_strategy'];

/**
 * Returns `values` unchanged, but only compiles when it lists every member of `Union`: omitting one
 * collapses the parameter to `never`, and an unknown member fails the `readonly Union[]` constraint.
 */
function exhaustive<Union extends string>() {
  return <const Values extends readonly Union[]>(
    values: [Exclude<Union, Values[number]>] extends [never] ? Values : never
  ): Values => values;
}

/** Mirrors the `training_sessions` status check constraint. */
export const SESSION_STATUSES = exhaustive<SessionStatus>()(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

/** Mirrors the `session_sets` status check constraint. */
export const SESSION_SET_STATUSES = exhaustive<SessionSetStatus>()(['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']);

/** Mirrors the `plan_exercise_progressions` deload strategy check constraint. */
export const DELOAD_STRATEGIES = exhaustive<DeloadStrategy>()(['PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM']);
