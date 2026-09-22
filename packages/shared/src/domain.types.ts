import type { MeasurementDto, PlanExerciseProgressionDto, ProfileDto, SessionDto, SessionSetDto } from './api.types';

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
 *
 * Nothing else belongs here. Presentation - labels, units, precision - lives in the web app;
 * formula mechanics - which sites an equation reads, how stale a reading may be - live in the
 * API, beside the code that would break if they were wrong.
 */

/** Every status a training session may hold. */
export type SessionStatus = SessionDto['status'];

/** Every status a session set may hold. */
export type SessionSetStatus = SessionSetDto['status'];

/** Every deload strategy an exercise progression rule may use. */
export type DeloadStrategy = PlanExerciseProgressionDto['deload_strategy'];

/** Every body measurement the catalog admits. */
export type MeasurementType = MeasurementDto['type'];

/** Every body-fat estimation method a profile may select. */
export type BodyFatMethod = NonNullable<ProfileDto['body_fat_method']>;

/** Which coefficient set the body-fat formulas use. */
export type Sex = NonNullable<ProfileDto['sex']>;

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

/**
 * Mirrors the `measurements` type check constraint.
 *
 * Also the app's one ordering of the catalog: every surface that lists measurement types reads
 * them in this order, so the settings card, the log dialog and the chip row cannot disagree.
 *
 * Height is absent on purpose - it is `profiles.height_cm`, a setting rather than something the
 * user re-observes and charts.
 */
export const MEASUREMENT_TYPES = exhaustive<MeasurementType>()([
  'BODY_WEIGHT',
  'BODY_FAT',
  'NECK',
  'CHEST',
  'WAIST',
  'HIPS',
  'THIGH',
  'CALF',
  'BICEPS',
  'FOREARM',
  'SKINFOLD_CHEST',
  'SKINFOLD_ABDOMEN',
  'SKINFOLD_THIGH',
  'SKINFOLD_TRICEPS',
  'SKINFOLD_SUBSCAPULAR',
  'SKINFOLD_SUPRAILIAC',
  'SKINFOLD_MIDAXILLARY',
]);

/** Mirrors the `profiles` body fat method check constraint. */
export const BODY_FAT_METHODS = exhaustive<BodyFatMethod>()(['NAVY', 'JP3', 'JP7', 'MANUAL']);

/** Mirrors the `profiles` sex check constraint. */
export const SEXES = exhaustive<Sex>()(['MALE', 'FEMALE']);

/** The caliper sites, in the order a Jackson-Pollock round is usually taken. */
export const SKINFOLD_MEASUREMENT_TYPES = [
  'SKINFOLD_CHEST',
  'SKINFOLD_MIDAXILLARY',
  'SKINFOLD_TRICEPS',
  'SKINFOLD_SUBSCAPULAR',
  'SKINFOLD_ABDOMEN',
  'SKINFOLD_SUPRAILIAC',
  'SKINFOLD_THIGH',
] as const satisfies readonly MeasurementType[];
