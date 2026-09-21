import type { Sex } from '@txg/shared';
import { densityToBodyFat } from './siri';

/**
 * The circumference measurements the US Navy equations consume, in centimetres.
 *
 * `hipsCm` is required for the female variant and ignored by the male one, which is why it is
 * optional here rather than split across two input types.
 */
export interface NavyInputs {
  heightCm: number;
  neckCm: number;
  waistCm: number;
  hipsCm?: number | null;
}

/**
 * The published coefficients, one set per variant.
 *
 * Verified against the equations as documented by the tape-method calculators, not transcribed
 * from memory - a wrong digit here produces plausible-looking output forever. `navy.spec.ts`
 * pins them with a worked example (183 cm / 38.6 cm neck / 102.1 cm waist = 26.8%).
 */
const COEFFICIENTS = {
  MALE: { intercept: 1.0324, girth: 0.19077, height: 0.15456 },
  FEMALE: { intercept: 1.29579, girth: 0.35004, height: 0.22100 },
} as const satisfies Record<Sex, { intercept: number; girth: number; height: number }>;

/**
 * Estimates body fat from tape measurements using the US Navy equations.
 *
 * @param {Sex} sex - Selects the coefficient set; the female variant also uses the hips.
 * @param {NavyInputs} inputs - The measurements, in centimetres.
 * @returns {number | null} The percentage, or null when the inputs cannot yield a usable one.
 */
export function estimateNavyBodyFat(sex: Sex, inputs: NavyInputs): number | null {
  const { heightCm, neckCm, waistCm, hipsCm } = inputs;

  if (!isPositive(heightCm) || !isPositive(neckCm) || !isPositive(waistCm)) {
    return null;
  }

  if (sex === 'FEMALE' && !isPositive(hipsCm)) {
    return null;
  }

  // The girth term is the measurement the equation actually regresses on. A non-positive value
  // has no logarithm, which happens for real if a waist is mistyped as smaller than a neck.
  const girth = sex === 'FEMALE' ? waistCm + hipsCm! - neckCm : waistCm - neckCm;
  if (!isPositive(girth)) {
    return null;
  }

  // The regression predicts the same density term Jackson-Pollock does, so the conversion to a
  // percentage - and the plausibility floor and ceiling that go with it - is Siri's, not a second
  // copy of it here. The equations are fitted to a normal range of bodies, so unusual inputs (a
  // waist barely wider than the neck, a mistyped height) drive the term to values no human holds;
  // `densityToBodyFat` answers null for those rather than inventing a clamped number.
  const { intercept, girth: girthCoefficient, height: heightCoefficient } = COEFFICIENTS[sex];
  const density = intercept
    - girthCoefficient * Math.log10(girth)
    + heightCoefficient * Math.log10(heightCm);

  return densityToBodyFat(density);
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

