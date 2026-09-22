import { SKINFOLD_MEASUREMENT_TYPES } from '@txg/shared';
import type { BodyFatMethod, MeasurementType, Sex } from '@txg/shared';

/**
 * How the measurement catalog is presented, and what each body-fat method needs from the profile.
 *
 * Lives in the web app rather than in `@txg/shared` because nothing else reads it: labels, units
 * and precision are how this app draws a number, and what a method asks of the user is how this
 * app decides what to show, what to tick, and what to say when an estimate cannot be built. The
 * API knows none of it - it has its own staleness windows and its own formula inputs in
 * `services/body-composition`, beside the code that would break if they were wrong.
 */

/**
 * The unit a measurement is stored in, or that a derived series is expressed in.
 *
 * A property of the type, never of a row. `BF%` belongs only to the body-fat series and is spelled
 * out rather than left as a bare `%` so a chart axis says what its percentage is of.
 */
export type MeasurementUnit = 'kg' | 'cm' | 'mm' | 'BF%';

export interface MeasurementTypeMeta {
  label: string;
  /**
   * The chip-row form. A chip is one line of a three-line box, so the full `label` is what the
   * list and the dialogs use, where there is room to be unambiguous.
   */
  shortLabel: string;
  unit: MeasurementUnit;
  precision: number;
}

/**
 * Typed as `Record<MeasurementType, ...>`, so a type added to the catalog is a compile error here
 * until it is given a label and a unit.
 *
 * `unit` is why a chart cannot put every type on one axis: kg, cm, mm and BF% share no scale.
 */
export const MEASUREMENT_TYPE_META: Record<MeasurementType, MeasurementTypeMeta> = {
  BODY_WEIGHT:      { label: 'Body weight', shortLabel: 'Weight',        unit: 'kg', precision: 1 },
  BODY_FAT:         { label: 'Body fat', shortLabel: 'Body fat',         unit: 'BF%', precision: 1 },
  NECK:             { label: 'Neck', shortLabel: 'Neck',               unit: 'cm', precision: 1 },
  CHEST:            { label: 'Chest', shortLabel: 'Chest',              unit: 'cm', precision: 1 },
  WAIST:            { label: 'Waist', shortLabel: 'Waist',              unit: 'cm', precision: 1 },
  HIPS:             { label: 'Hips', shortLabel: 'Hips',               unit: 'cm', precision: 1 },
  THIGH:            { label: 'Thigh', shortLabel: 'Thigh',              unit: 'cm', precision: 1 },
  CALF:             { label: 'Calf', shortLabel: 'Calf',               unit: 'cm', precision: 1 },
  BICEPS:           { label: 'Biceps', shortLabel: 'Biceps',             unit: 'cm', precision: 1 },
  FOREARM:          { label: 'Forearm', shortLabel: 'Forearm',            unit: 'cm', precision: 1 },

  SKINFOLD_CHEST:       { label: 'Chest skinfold', shortLabel: 'Chest fold',       unit: 'mm', precision: 1 },
  SKINFOLD_ABDOMEN:     { label: 'Abdomen skinfold', shortLabel: 'Abs fold',     unit: 'mm', precision: 1 },
  SKINFOLD_THIGH:       { label: 'Thigh skinfold', shortLabel: 'Thigh fold',       unit: 'mm', precision: 1 },
  SKINFOLD_TRICEPS:     { label: 'Triceps skinfold', shortLabel: 'Tricep fold',     unit: 'mm', precision: 1 },
  SKINFOLD_SUBSCAPULAR: { label: 'Subscapular skinfold', shortLabel: 'Back fold', unit: 'mm', precision: 1 },
  SKINFOLD_SUPRAILIAC:  { label: 'Suprailiac skinfold', shortLabel: 'Hip fold',  unit: 'mm', precision: 1 },
  SKINFOLD_MIDAXILLARY: { label: 'Midaxillary skinfold', shortLabel: 'Side fold', unit: 'mm', precision: 1 },
};

/**
 * What choosing a method asks of the user: which profile fields to fill in, and which
 * measurements to keep taking.
 *
 * One table, because every surface that asks is asking the same question - Settings shows these
 * fields and ticks these boxes, the log dialog asks for them each round, and the blocked-estimate
 * notice names whichever is missing. Comparisons like `method !== 'NAVY'` stood in for "takes an
 * age term" until a fourth method made that reading false.
 *
 * `measurements` restates the site lists the API's formulas declare. Deliberately: these come
 * from the published equations and have not changed since 1984, and the two are not quite the
 * same fact - `MANUAL` reads nothing yet still has to ask for a figure, which is exactly the
 * entry that made a single shared table describe two different things at once.
 */
export interface BodyFatMethodRequirements {
  /** The coefficient set differs by sex. */
  sex: boolean;
  /** The formula takes age as a term, so it needs a birth date. */
  age: boolean;
  /** The formula reads height, which Settings collects once rather than each round. */
  height: boolean;
  /** What the method locks on in the checklist and asks for in the log dialog. */
  measurements: (sex: Sex) => MeasurementType[];
}

export const BODY_FAT_METHOD_REQUIREMENTS: Record<BodyFatMethod, BodyFatMethodRequirements> = {
  NAVY: {
    sex: true,
    age: false,
    height: true,
    measurements: (sex) => sex === 'FEMALE'
      ? ['NECK', 'WAIST', 'HIPS']
      : ['NECK', 'WAIST'],
  },
  JP3: {
    sex: true,
    age: true,
    height: false,
    measurements: (sex) => sex === 'FEMALE'
      ? ['SKINFOLD_TRICEPS', 'SKINFOLD_SUPRAILIAC', 'SKINFOLD_THIGH']
      : ['SKINFOLD_CHEST', 'SKINFOLD_ABDOMEN', 'SKINFOLD_THIGH'],
  },
  JP7: {
    sex: true,
    age: true,
    height: false,
    measurements: () => [...SKINFOLD_MEASUREMENT_TYPES],
  },
  MANUAL: {
    // Nothing from the profile: the figure arrives already worked out. It is still asked for each
    // round, because a reading the user types in is the one body-fat number that is not derived.
    sex: false,
    age: false,
    height: false,
    measurements: () => ['BODY_FAT'],
  },
};

/** What no method at all asks for: nothing. Saves every caller spelling the empty shape out. */
export const NO_BODY_FAT_METHOD_REQUIREMENTS: BodyFatMethodRequirements = {
  sex: false,
  age: false,
  height: false,
  measurements: () => [],
};

/**
 * Whether a method computes its figure rather than being told it.
 *
 * `MANUAL` is the odd one out everywhere it matters: it needs no formula variant, it can be
 * blocked by nothing, and its series is a row on the chart rather than a dashed derived line.
 */
export function isDerivedBodyFatMethod(method: BodyFatMethod): boolean {
  return method !== 'MANUAL';
}
