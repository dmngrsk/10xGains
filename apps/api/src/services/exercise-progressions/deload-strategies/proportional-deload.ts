import type { PlanExerciseProgressionDto, PlanExerciseSetDto } from '@txg/shared';

/**
 * Handles the proportional deload strategy for an exercise set.
 * It calculates the new expected_weight by applying a deload_percentage from the progression rule,
 * then rounds the result down to the nearest multiple of weight_increment.
 *
 * @param set - The plan exercise set to be deloaded.
 * @param progression - The current exercise progression rule, containing deload_percentage and weight_increment.
 * @returns A new PlanExerciseSetDto with the updated expected_weight.
 */
export function handleProportionalDeload(
  set: PlanExerciseSetDto,
  progression: PlanExerciseProgressionDto
): PlanExerciseSetDto {
  if (progression.deload_percentage === null || progression.deload_percentage === undefined || progression.weight_increment === null || progression.weight_increment === undefined) {
    console.warn('Proportional deload cannot be applied: deload_percentage or weight_increment is missing in progression.');
    return { ...set }; // Return original set if params are missing
  }
  if (progression.weight_increment <= 0) {
    console.warn('Proportional deload cannot be applied: weight_increment must be positive.');
    return { ...set }; // Return original set if weight_increment is invalid
  }

  const currentWeight = set.expected_weight;
  const deloadPercentage = progression.deload_percentage / 100;
  const targetUnroundedWeight = currentWeight * (1 - deloadPercentage);

  // Round down to the nearest multiple of weight_increment, doing the division in integer space.
  // Binary floating point cannot represent the fractional increments gyms actually use, so
  // `target / increment` can land a hair below a whole number and `Math.floor` then drops an entire
  // increment - 0.1 kg plates being the obvious case. Scaling by 1000 (a milligram-level precision
  // no plate needs) makes both operands exact integers before the division.
  const SCALE = 1000;
  const scaledTarget = Math.round(targetUnroundedWeight * SCALE);
  const scaledIncrement = Math.round(progression.weight_increment * SCALE);
  // Multiplying back out reintroduces representation noise (0.7 becoming 0.7000000000000001), so
  // the result is rounded to the precision the weight column stores anyway.
  const newExpectedWeight = Math.round(Math.floor(scaledTarget / scaledIncrement) * scaledIncrement) / SCALE;

  // Ensure weight doesn't go below a minimum (e.g., 0)
  return { ...set, expected_weight: Math.max(0, newExpectedWeight) };
}
