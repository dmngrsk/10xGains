/**
 * The range outside which a converted result is reported as no answer rather than as a number.
 *
 * Every formula here ends in this conversion - Jackson-Pollock predicts density directly, and the
 * Navy regression predicts the same term - so this is the one place that decides what counts as a
 * usable answer. Inputs the equations were never fitted to drive the term to values no human
 * holds, including ones that invert the conversion.
 */
const PLAUSIBLE_RANGE = { min: 1, max: 75 } as const;

/**
 * Converts body density to a body-fat percentage using the Siri (1956) equation.
 *
 * The Jackson-Pollock equations predict *density*, not fat, so every one of their variants ends
 * here - which is why this is its own module rather than a line inside them.
 *
 * @param {number} density - Body density in g/cm³, as the skinfold equations produce it.
 * @returns {number | null} The percentage, or null when the density yields no usable one.
 */
export function densityToBodyFat(density: number): number | null {
  if (!Number.isFinite(density) || density <= 0) {
    return null;
  }

  const bodyFat = 495 / density - 450;
  if (!Number.isFinite(bodyFat) || bodyFat < PLAUSIBLE_RANGE.min || bodyFat > PLAUSIBLE_RANGE.max) {
    return null;
  }

  return Math.round(bodyFat * 10) / 10;
}
