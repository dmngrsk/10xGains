import type { Sex } from '@txg/shared';
import { densityToBodyFat } from './siri';

/** The Jackson-Pollock variants this module implements. */
export type JacksonPollockMethod = 'JP3' | 'JP7';

/**
 * The published coefficients, one set per method and variant.
 *
 * Each equation is quadratic in the sum of the skinfolds (in millimetres) with a linear age term,
 * and predicts body *density*; `densityToBodyFat` converts it. Verified against two independent
 * statements of the equations rather than transcribed from memory - a wrong digit here produces
 * plausible-looking output forever - and `jackson-pollock.spec.ts` pins every set.
 *
 * JP-3 has a second published male variant over chest/triceps/subscapular. This is the
 * chest/abdomen/thigh one, which is what the catalog's sites are chosen for.
 */
const COEFFICIENTS = {
  JP3: {
    MALE: { intercept: 1.10938, sum: 0.0008267, sumSquared: 0.0000016, age: 0.0002574 },
    FEMALE: { intercept: 1.0994921, sum: 0.0009929, sumSquared: 0.0000023, age: 0.0001392 },
  },
  JP7: {
    MALE: { intercept: 1.112, sum: 0.00043499, sumSquared: 0.00000055, age: 0.00028826 },
    FEMALE: { intercept: 1.097, sum: 0.00046971, sumSquared: 0.00000056, age: 0.00012828 },
  },
} as const satisfies Record<JacksonPollockMethod, Record<Sex, {
  intercept: number;
  sum: number;
  sumSquared: number;
  age: number;
}>>;

/**
 * Estimates body fat from caliper measurements using a Jackson-Pollock equation.
 *
 * @param {JacksonPollockMethod} method - Which variant's coefficients to use.
 * @param {Sex} sex - Selects the coefficient set within that variant.
 * @param {readonly number[]} skinfoldsMm - The sites the variant calls for, in millimetres.
 * @param {number} ageYears - Age at the date being estimated, which the equations take as a term.
 * @returns {number | null} The percentage, or null when the inputs cannot yield a usable one.
 */
export function estimateJacksonPollockBodyFat(
  method: JacksonPollockMethod,
  sex: Sex,
  skinfoldsMm: readonly number[],
  ageYears: number
): number | null {
  if (skinfoldsMm.length === 0 || skinfoldsMm.some(value => !isPositive(value))) {
    return null;
  }

  // Age is a term in every variant, so an implausible one silently shifts the result rather than
  // failing. The floor is the youngest the equations were fitted on; the ceiling is a sanity bound.
  if (!Number.isFinite(ageYears) || ageYears < 15 || ageYears > 100) {
    return null;
  }

  const sum = skinfoldsMm.reduce((total, value) => total + value, 0);
  const c = COEFFICIENTS[method][sex];
  const density = c.intercept - c.sum * sum + c.sumSquared * sum * sum - c.age * ageYears;

  return densityToBodyFat(density);
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
