import { MEASUREMENT_TYPES, SEXES, SKINFOLD_MEASUREMENT_TYPES } from '@txg/shared';
import type { BodyFatEstimateDto, BodyFatMethod, MeasurementType, Sex } from '@txg/shared';
import { estimateJacksonPollockBodyFat } from './jackson-pollock';
import { estimateNavyBodyFat } from './navy';

/**
 * How stale a reading may be when filled in for a date that does not have one, in days.
 *
 * Only the estimator asks this, so it lives here rather than beside the type catalog. The caliper
 * sites get a shorter window than the circumferences: a caliper round is done in one sitting, so
 * mixing sites weeks apart would estimate from a body that no longer existed. Seven days tolerates
 * a session finished the next day without inviting that drift.
 */
const DEFAULT_LOOKBACK_DAYS = 90;
const SKINFOLD_LOOKBACK_DAYS = 7;

const MEASUREMENT_LOOKBACK_DAYS: Record<MeasurementType, number> = Object.fromEntries(
  MEASUREMENT_TYPES.map(type => [
    type,
    (SKINFOLD_MEASUREMENT_TYPES as readonly MeasurementType[]).includes(type)
      ? SKINFOLD_LOOKBACK_DAYS
      : DEFAULT_LOOKBACK_DAYS,
  ])
) as Record<MeasurementType, number>;

/** The subset of a measurement row this module needs. */
export interface MeasurementReading {
  measured_on: string;
  type: MeasurementType;
  value: number;
}

/** The profile fields body-fat estimation depends on. */
export interface BodyCompositionProfile {
  sex: Sex | null;
  /** Required by the skinfold methods, which take age as a term. Null disables them. */
  date_of_birth?: string | null;
  /** Required by the Navy equation, which is the only one that reads it. Null disables it. */
  height_cm?: number | null;
}

/** Everything a formula needs that is not a measurement: the profile, resolved for one date. */
interface FormulaContext {
  sex: Sex;
  heightCm: number | null;
  ageYears: number | null;
}

/** One resolved formula input, and whether it was measured on the day or carried forward. */
interface ResolvedInput {
  value: number;
  carriedForward: boolean;
}

/**
 * A method's shape: which measurements it consumes for a given variant, and how it turns them
 * into a percentage. A further method is an entry in `METHODS`, not a branch in the loop below.
 */
interface MethodDescriptor {
  method: BodyFatMethod;
  inputs: (sex: Sex) => readonly MeasurementType[];
  compute: (
    context: FormulaContext,
    values: Readonly<Record<string, number>>,
    inputs: readonly MeasurementType[]
  ) => number | null;
}

/**
 * The formulas, and exactly what each one reads.
 *
 * `inputs` sits beside its own `compute` rather than in `@txg/shared`, because that is the pair
 * that has to agree: `compute` indexes the resolved values by hand (`v['NECK']`), so a site
 * declared here and not read there - or read and not declared - is a crash or a silent null. Held
 * a package away, the one coupling that matters was the one you could not see.
 *
 * The web app states the same sites again, for a different question: which boxes a chosen method
 * ticks in Settings. Duplicated deliberately. These lists come from the published equations and
 * have not changed since 1984, and the alternative put a fourth method's "ask the user for a
 * typed-in figure" into a table that claims to describe formula inputs.
 *
 * `MANUAL` has no entry at all: nothing is derived from a figure the user read off a scale.
 */
const METHODS: readonly MethodDescriptor[] = [
  {
    method: 'NAVY',
    inputs: (sex) => sex === 'FEMALE'
      ? ['NECK', 'WAIST', 'HIPS']
      : ['NECK', 'WAIST'],
    // Height comes from the profile, not the round: it is the one term the user sets once.
    compute: ({ sex, heightCm }, v) => heightCm === null ? null : estimateNavyBodyFat(sex, {
      heightCm,
      neckCm: v['NECK']!,
      waistCm: v['WAIST']!,
      hipsCm: v['HIPS'],
    }),
  },
  {
    method: 'JP3',
    inputs: (sex) => sex === 'FEMALE'
      ? ['SKINFOLD_TRICEPS', 'SKINFOLD_SUPRAILIAC', 'SKINFOLD_THIGH']
      : ['SKINFOLD_CHEST', 'SKINFOLD_ABDOMEN', 'SKINFOLD_THIGH'],
    // The sites are passed in the order they are declared: the equations sum them, so the order
    // is immaterial to the result but the count is not.
    compute: ({ sex, ageYears }, v, sites) => ageYears === null
      ? null
      : estimateJacksonPollockBodyFat('JP3', sex, sites.map(site => v[site]!), ageYears),
  },
  {
    method: 'JP7',
    inputs: () => SKINFOLD_MEASUREMENT_TYPES,
    compute: ({ sex, ageYears }, v, sites) => ageYears === null
      ? null
      : estimateJacksonPollockBodyFat('JP7', sex, sites.map(site => v[site]!), ageYears),
  },
];

/**
 * What one method reads for one variant; empty for a method that derives nothing.
 *
 * The declaration lives in `METHODS`, beside the `compute` that indexes it. This exposes it for
 * the specs that pin the sites to their published equations.
 *
 * @param {BodyFatMethod} method - The method to describe.
 * @param {Sex} sex - The variant, which changes the sites for NAVY and JP3.
 * @returns {readonly MeasurementType[]} The sites, in the order the formula receives them.
 */
export function bodyFatMethodInputs(method: BodyFatMethod, sex: Sex): readonly MeasurementType[] {
  return METHODS.find(descriptor => descriptor.method === method)?.inputs(sex) ?? [];
}

/**
 * Every measurement type a formula consumes, across all methods and both variants.
 *
 * Derived from `METHODS` rather than listed by hand, so a site added for a future method cannot
 * be left out of the query that feeds it.
 */
export const BODY_FAT_INPUT_TYPES: readonly MeasurementType[] = [...new Set(
  METHODS.flatMap(descriptor => SEXES.flatMap(sex => descriptor.inputs(sex)))
)];

/**
 * Builds every body-fat estimate the given readings support.
 *
 * Deliberately not filtered by the user's chosen method: that setting decides what the log dialog
 * asks for and which series is selected by default, never what exists. Filtering by it would erase
 * a year of tape estimates the day someone switched to calipers, and the switch cannot be
 * backfilled because the historical readings for the new method do not exist.
 *
 * A date qualifies when at least one of a method's inputs was recorded on it; the rest are filled
 * from the most recent earlier reading, within that type's own window (see
 * `MEASUREMENT_LOOKBACK_DAYS`). Requiring every input on one date would leave the series
 * nearly empty, because the input that moves - the waist - is the one just measured, while the
 * neck is always weeks old.
 *
 * @param {readonly MeasurementReading[]} readings - The user's measurements, any order.
 * @param {BodyCompositionProfile} profile - The formula variant to use; null yields no estimates.
 * @returns {BodyFatEstimateDto[]} Estimates ascending by date, then by method.
 */
export function estimateBodyFatSeries(
  readings: readonly MeasurementReading[],
  profile: BodyCompositionProfile
): BodyFatEstimateDto[] {
  const sex = profile.sex;
  if (!sex) {
    return [];
  }

  const byType = groupByTypeAscending(readings);
  const estimates: BodyFatEstimateDto[] = [];

  for (const descriptor of METHODS) {
    const inputs = descriptor.inputs(sex);

    for (const date of candidateDates(byType, inputs)) {
      const resolved = resolveInputs(byType, inputs, date);
      if (!resolved) {
        continue;
      }

      const values = Object.fromEntries(
        Object.entries(resolved).map(([type, input]) => [type, input.value])
      );

      const value = descriptor.compute({
        sex,
        heightCm: profile.height_cm ?? null,
        ageYears: ageAt(profile.date_of_birth, date),
      }, values, inputs);
      if (value === null) {
        continue;
      }

      estimates.push({
        measured_on: date,
        method: descriptor.method,
        value,
        carried_forward: Object.values(resolved).some(input => input.carriedForward),
      });
    }
  }

  return estimates.sort((a, b) =>
    a.measured_on.localeCompare(b.measured_on) || a.method.localeCompare(b.method));
}

/**
 * Resolves each input for one date, or null when any of them is missing or too stale.
 *
 * @param {Map<MeasurementType, MeasurementReading[]>} byType - Readings per type, ascending by date.
 * @param {readonly MeasurementType[]} inputs - The types the method needs.
 * @param {string} date - The date being estimated.
 * @returns {Record<string, ResolvedInput> | null} The resolved inputs, or null if incomplete.
 */
function resolveInputs(
  byType: Map<MeasurementType, MeasurementReading[]>,
  inputs: readonly MeasurementType[],
  date: string
): Record<string, ResolvedInput> | null {
  const resolved: Record<string, ResolvedInput> = {};

  for (const type of inputs) {
    const candidates = byType.get(type);
    if (!candidates || candidates.length === 0) {
      return null;
    }

    // The latest reading at or before this date; ascending order makes the last match the newest.
    // Never forwards: a waist measured today says nothing about last month.
    let match: MeasurementReading | undefined;
    for (const reading of candidates) {
      if (reading.measured_on > date) {
        break;
      }
      match = reading;
    }

    if (!match) {
      return null;
    }

    const reused = match.measured_on !== date;
    if (reused && !isWithinLookback(match.measured_on, date, type)) {
      return null;
    }

    resolved[type] = { value: match.value, carriedForward: reused };
  }

  return resolved;
}

/**
 * The dates worth estimating: those on which at least one of the method's inputs was measured.
 *
 * @param {Map<MeasurementType, MeasurementReading[]>} byType - Readings per type.
 * @param {readonly MeasurementType[]} inputs - The types the method needs.
 * @returns {string[]} Distinct dates, ascending.
 */
function candidateDates(
  byType: Map<MeasurementType, MeasurementReading[]>,
  inputs: readonly MeasurementType[]
): string[] {
  const dates = new Set<string>();

  for (const type of inputs) {
    for (const reading of byType.get(type) ?? []) {
      dates.add(reading.measured_on);
    }
  }

  return [...dates].sort();
}

function groupByTypeAscending(
  readings: readonly MeasurementReading[]
): Map<MeasurementType, MeasurementReading[]> {
  const byType = new Map<MeasurementType, MeasurementReading[]>();

  for (const reading of readings) {
    const bucket = byType.get(reading.type);
    if (bucket) {
      bucket.push(reading);
    } else {
      byType.set(reading.type, [reading]);
    }
  }

  for (const bucket of byType.values()) {
    bucket.sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  }

  return byType;
}

/** Whether a carried-forward reading is still fresh enough for the date being estimated. */
function isWithinLookback(from: string, to: string, type: MeasurementType): boolean {
  return daysBetween(from, to) <= MEASUREMENT_LOOKBACK_DAYS[type];
}

/**
 * Age in whole years on a given date.
 *
 * Computed per estimate rather than once, because a series spans birthdays and the skinfold
 * equations take age as a term: using today's age throughout would quietly restate every past
 * point. This is the same reason the profile stores a birth date rather than an age.
 *
 * @param {string | null | undefined} dateOfBirth - The birth date, or null when unknown.
 * @param {string} on - The date being estimated.
 * @returns {number | null} Age in years, or null when no birth date is known.
 */
function ageAt(dateOfBirth: string | null | undefined, on: string): number | null {
  if (!dateOfBirth) {
    return null;
  }

  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const target = new Date(`${on}T00:00:00Z`);

  if (Number.isNaN(birth.getTime()) || Number.isNaN(target.getTime())) {
    return null;
  }

  let age = target.getUTCFullYear() - birth.getUTCFullYear();

  // Not yet had this year's birthday on the target date.
  const monthDelta = target.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && target.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }

  return age;
}

/** Whole days between two `YYYY-MM-DD` dates, computed in UTC so no zone can shift the count. */
function daysBetween(from: string, to: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}
