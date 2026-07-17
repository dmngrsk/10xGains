import { SessionWarmupSetViewModel } from '../../../models/session-page.viewmodel';

/**
 * Starting Strength even-jump warmup scheme: two sets of five with the empty
 * bar, then ramp sets at even weight jumps between the bar and the working
 * weight, with descending reps to limit fatigue.
 */
export const WARMUP_SCHEME = {
  barWeightKg: 20,
  barSets: { count: 2, reps: 5 },
  rampReps: [5, 3, 2],
  weightStepKg: 2.5,
} as const;

export function calculateWarmupSets(workingWeight: number | undefined): SessionWarmupSetViewModel[] {
  const { barWeightKg, barSets, rampReps, weightStepKg } = WARMUP_SCHEME;

  if (!workingWeight || workingWeight <= barWeightKg) {
    return [];
  }

  const sets: SessionWarmupSetViewModel[] = [];

  for (let i = 0; i < barSets.count; i++) {
    sets.push({ id: `warmup-${sets.length}`, reps: barSets.reps, weight: barWeightKg });
  }

  const jump = (workingWeight - barWeightKg) / (rampReps.length + 1);
  let previousWeight: number = barWeightKg;

  for (let i = 0; i < rampReps.length; i++) {
    const rawWeight = barWeightKg + (i + 1) * jump;
    const weight = Math.round(rawWeight / weightStepKg) * weightStepKg;

    if (weight <= previousWeight || weight >= workingWeight) continue;

    sets.push({ id: `warmup-${sets.length}`, reps: rampReps[i], weight });
    previousWeight = weight;
  }

  return sets;
}
