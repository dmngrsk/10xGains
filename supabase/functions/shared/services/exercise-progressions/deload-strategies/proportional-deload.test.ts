import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleProportionalDeload } from './proportional-deload.ts';
import type { TrainingPlanExerciseProgressionDto, TrainingPlanExerciseSetDto } from '../../../models/api-types.ts';

describe('handleProportionalDeload', () => {
  const baseSet: TrainingPlanExerciseSetDto = {
    id: 'set1',
    training_plan_exercise_id: 'tpe1',
    set_index: 1,
    expected_reps: 5,
    expected_weight: 100,
  };

  const baseProgression: TrainingPlanExerciseProgressionDto = {
    id: 'prog1',
    exercise_id: 'ex1',
    training_plan_id: 'tp1',
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
    const set: TrainingPlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: TrainingPlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 10, weight_increment: 2.5 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(90);
  });

  it('should round down correctly, e.g., 63kg deloaded by 10% (to 56.7kg) with 2.5 increment should be 55kg', () => {
    const set: TrainingPlanExerciseSetDto = { ...baseSet, expected_weight: 63 };
    const progression: TrainingPlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 10, weight_increment: 2.5 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(55);
  });

  it('should not deload below zero', () => {
    const set: TrainingPlanExerciseSetDto = { ...baseSet, expected_weight: 10 };
    const progression: TrainingPlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 50, weight_increment: 2.5 };
    const newSet1 = handleProportionalDeload(set, progression);
    expect(newSet1.expected_weight).toBe(5);

    const progressionHeavyDeload: TrainingPlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 150, weight_increment: 2.5 };
    const newSet2 = handleProportionalDeload(set, progressionHeavyDeload);
    expect(newSet2.expected_weight).toBe(0);
  });

  it('should return the original set and warn if deload_percentage is missing', () => {
    const set: TrainingPlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: TrainingPlanExerciseProgressionDto = { ...baseProgression, deload_percentage: null as any };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Proportional deload cannot be applied: deload_percentage or weight_increment is missing in progression.');
  });

  it('should return the original set and warn if weight_increment is missing', () => {
    const set: TrainingPlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: TrainingPlanExerciseProgressionDto = { ...baseProgression, weight_increment: undefined as any };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Proportional deload cannot be applied: deload_percentage or weight_increment is missing in progression.');
  });

  it('should return the original set and warn if weight_increment is zero', () => {
    const set: TrainingPlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: TrainingPlanExerciseProgressionDto = { ...baseProgression, weight_increment: 0 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Proportional deload cannot be applied: weight_increment must be positive.');
  });

  it('should return the original set and warn if weight_increment is negative', () => {
    const set: TrainingPlanExerciseSetDto = { ...baseSet, expected_weight: 100 };
    const progression: TrainingPlanExerciseProgressionDto = { ...baseProgression, weight_increment: -2.5 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(100);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Proportional deload cannot be applied: weight_increment must be positive.');
  });

  it('should handle zero initial weight correctly', () => {
    const set: TrainingPlanExerciseSetDto = { ...baseSet, expected_weight: 0 };
    const progression: TrainingPlanExerciseProgressionDto = { ...baseProgression, deload_percentage: 10, weight_increment: 2.5 };
    const newSet = handleProportionalDeload(set, progression);
    expect(newSet.expected_weight).toBe(0);
  });
});
