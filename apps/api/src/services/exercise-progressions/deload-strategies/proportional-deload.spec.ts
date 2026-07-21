import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleProportionalDeload } from './proportional-deload';
import type { PlanExerciseProgressionDto, PlanExerciseSetDto } from '@txg/shared';

describe('handleProportionalDeload', () => {
  const baseSet: PlanExerciseSetDto = {
    id: 'set1',
    plan_exercise_id: 'tpe1',
    set_index: 1,
    expected_reps: 5,
    expected_weight: 100,
  };

  const baseProgression: PlanExerciseProgressionDto = {
    id: 'prog1',
    exercise_id: 'ex1',
    plan_id: 'tp1',
    weight_increment: 2.5,
    deload_percentage: 10,
    deload_strategy: 'PROPORTIONAL',
    consecutive_failures: 0,
    failure_count_for_deload: 3,
    last_updated: null,
    reference_set_index: null,
  };

  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should correctly deload the weight proportionally and round down to nearest weight_increment', () => {
    const set: PlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: PlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 10, weight_increment: 2.5 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(90);
  });

  it('should round down correctly, e.g., 63kg deloaded by 10% (to 56.7kg) with 2.5 increment should be 55kg', () => {
    const set: PlanExerciseSetDto = { ...baseSet, expected_weight: 63 };
    const progression: PlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 10, weight_increment: 2.5 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(55);
  });

  it('should not deload below zero', () => {
    const set: PlanExerciseSetDto = { ...baseSet, expected_weight: 10 };
    const progression: PlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 50, weight_increment: 2.5 };
    const newSet1 = handleProportionalDeload(set, progression);
    expect(newSet1.expected_weight).toBe(5);

    const progressionHeavyDeload: PlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 150, weight_increment: 2.5 };
    const newSet2 = handleProportionalDeload(set, progressionHeavyDeload);
    expect(newSet2.expected_weight).toBe(0);
  });

  it('should return the original set and warn if deload_percentage is missing', () => {
    const set: PlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: PlanExerciseProgressionDto = { ...baseProgression, deload_percentage: null as unknown as number };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Proportional deload cannot be applied: deload_percentage or weight_increment is missing in progression.');
  });

  it('should return the original set and warn if weight_increment is missing', () => {
    const set: PlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: PlanExerciseProgressionDto = { ...baseProgression, weight_increment: undefined as unknown as number };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Proportional deload cannot be applied: deload_percentage or weight_increment is missing in progression.');
  });

  it('should return the original set and warn if weight_increment is zero', () => {
    const set: PlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: PlanExerciseProgressionDto = { ...baseProgression, weight_increment: 0 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Proportional deload cannot be applied: weight_increment must be positive.');
  });

  it('should return the original set and warn if weight_increment is negative', () => {
    const set: PlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: PlanExerciseProgressionDto = { ...baseProgression, weight_increment: -2.5 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Proportional deload cannot be applied: weight_increment must be positive.');
  });

  it('should handle zero initial weight correctly', () => {
    const set: PlanExerciseSetDto = { ...baseSet, expected_weight: 0 };
    const progression: PlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 10, weight_increment: 2.5 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(0);
  });

  it('should not lose a whole increment to floating-point error on fractional increments', () => {
    // 2 kg at 5% is exactly 1.9, but `1.9 / 0.1` evaluates just below 19 in binary floating point,
    // so flooring dropped a full 0.1 increment and returned 1.8.
    const set = { ...baseSet, expected_weight: 2 };
    const progression = { ...baseProgression, deload_percentage: 5, weight_increment: 0.1 };

    expect(handleProportionalDeload(set, progression).expected_weight).toBe(1.9);
  });

  it('should return a weight free of floating-point representation noise', () => {
    const set = { ...baseSet, expected_weight: 1 };
    const progression = { ...baseProgression, deload_percentage: 30, weight_increment: 0.1 };

    expect(handleProportionalDeload(set, progression).expected_weight).toBe(0.7);
  });
});
