import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveExerciseProgressions } from './exercise-progressions.ts';
import * as DeloadStrategies from './deload-strategies/proportional-deload.ts';
import type { SessionSetDto, TrainingPlanExerciseDto, TrainingPlanExerciseProgressionDto, TrainingPlanExerciseSetDto } from '../../models/api-types.ts';

const mockTrainingPlanExerciseSet = (id: string, tpeId: string, index: number, weight: number, reps: number): TrainingPlanExerciseSetDto => ({
  id,
  training_plan_exercise_id: tpeId,
  set_index: index,
  expected_weight: weight,
  expected_reps: reps,
});

const mockSessionSet = (id: string, tpeId: string, index: number, actualWeight: number, actualReps: number, status = 'COMPLETED'): SessionSetDto => ({
  id,
  training_plan_exercise_id: tpeId,
  training_session_id: 'session1',
  set_index: index,
  expected_reps: actualReps,
  actual_reps: actualReps,
  actual_weight: actualWeight,
  status,
  completed_at: new Date().toISOString(),
});

const mockTrainingPlanExercise = (id: string, exerciseId: string, sets: TrainingPlanExerciseSetDto[]): TrainingPlanExerciseDto => ({
  id,
  training_plan_day_id: 'day1',
  exercise_id: exerciseId,
  order_index: 0,
  sets,
});

const mockExerciseProgression = (
  exerciseId: string,
  weightIncrement = 2.5,
  deloadStrategy = 'PROPORTIONAL',
  deloadPercentage = 10,
  consecutiveFailures = 0,
  failureCountForDeload = 2
): TrainingPlanExerciseProgressionDto => ({
  id: 'prog' + exerciseId,
  exercise_id: exerciseId,
  training_plan_id: 'tp1',
  weight_increment: weightIncrement,
  deload_strategy: deloadStrategy,
  deload_percentage: deloadPercentage,
  consecutive_failures: consecutiveFailures,
  failure_count_for_deload: failureCountForDeload,
  last_updated: new Date().toISOString(),
  reference_set_index: null,
});

const TEST_DELOAD_SENTINEL_WEIGHT = -999;

const handleTestDeloadStrategy = (set: TrainingPlanExerciseSetDto, _progression: TrainingPlanExerciseProgressionDto): TrainingPlanExerciseSetDto => {
  return { ...set, expected_weight: TEST_DELOAD_SENTINEL_WEIGHT };
};

describe('resolveExerciseProgressions', () => {
  let proportionalDeloadSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    proportionalDeloadSpy = vi.spyOn(DeloadStrategies, 'handleProportionalDeload');
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    proportionalDeloadSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should progress weight if all sets are successful', () => {
    const planExercise1Sets = [
      mockTrainingPlanExerciseSet('set1-1', 'tpe1', 0, 100, 5),
      mockTrainingPlanExerciseSet('set1-2', 'tpe1', 1, 100, 5),
    ];
    const planExercises: TrainingPlanExerciseDto[] = [mockTrainingPlanExercise('tpe1', 'ex1', planExercise1Sets)];
    const sessionSets: SessionSetDto[] = [
      mockSessionSet('ss1', 'tpe1', 0, 100, 5),
      mockSessionSet('ss2', 'tpe1', 1, 100, 5),
    ];
    const progressions: TrainingPlanExerciseProgressionDto[] = [mockExerciseProgression('ex1', 2.5)];

    const result = resolveExerciseProgressions(sessionSets, planExercises, progressions);

    expect(result.exerciseProgressionsToUpdate.length).toBe(1);
    expect(result.exerciseProgressionsToUpdate[0].consecutive_failures).toBe(0);
    expect(result.exerciseSetsToUpdate.length).toBe(2);
    result.exerciseSetsToUpdate.forEach((set: TrainingPlanExerciseSetDto) => {
      expect(set.expected_weight).toBe(100 + 2.5);
    });
  });

  it('should increment consecutive_failures if a set is failed and deload not triggered', () => {
    const planExercise1Sets = [mockTrainingPlanExerciseSet('set1-1', 'tpe1', 0, 100, 5)];
    const planExercises: TrainingPlanExerciseDto[] = [mockTrainingPlanExercise('tpe1', 'ex1', planExercise1Sets)];
    const sessionSets: SessionSetDto[] = [mockSessionSet('ss1', 'tpe1', 0, 100, 3)];
    const progressions: TrainingPlanExerciseProgressionDto[] = [mockExerciseProgression('ex1', 2.5, 'PROPORTIONAL', 10, 0, 2)];

    const result = resolveExerciseProgressions(sessionSets, planExercises, progressions);

    expect(result.exerciseProgressionsToUpdate[0].consecutive_failures).toBe(1);
    result.exerciseSetsToUpdate.forEach((set: TrainingPlanExerciseSetDto) => {
      expect(set.expected_weight).toBe(100);
    });
  });

  it('should trigger test deload strategy and set sentinel weight if configured', () => {
    proportionalDeloadSpy.mockImplementation(handleTestDeloadStrategy);

    const planExercise1Sets = [mockTrainingPlanExerciseSet('set1-1', 'tpe1', 0, 100, 5)];
    const planExercises: TrainingPlanExerciseDto[] = [mockTrainingPlanExercise('tpe1', 'ex1', planExercise1Sets)];
    const sessionSets: SessionSetDto[] = [mockSessionSet('ss1', 'tpe1', 0, 100, 3)];
    const progressions: TrainingPlanExerciseProgressionDto[] = [mockExerciseProgression('ex1', 2.5, 'PROPORTIONAL', 10, 1, 2)];

    const result = resolveExerciseProgressions(sessionSets, planExercises, progressions);

    expect(result.exerciseProgressionsToUpdate[0].consecutive_failures).toBe(0);
    expect(result.exerciseSetsToUpdate.length).toBe(1);
    result.exerciseSetsToUpdate.forEach((set: TrainingPlanExerciseSetDto) => {
      expect(set.expected_weight).toBe(TEST_DELOAD_SENTINEL_WEIGHT);
    });
    expect(proportionalDeloadSpy).toHaveBeenCalled();
  });

  it('should increment consecutive_failures if a set status is not COMPLETED', () => {
    const planExercise1Sets = [mockTrainingPlanExerciseSet('set1-1', 'tpe1', 0, 100, 5)];
    const planExercises: TrainingPlanExerciseDto[] = [mockTrainingPlanExercise('tpe1', 'ex1', planExercise1Sets)];
    // Crucially, the status is 'SKIPPED', but reps and weight are met/exceeded
    const sessionSets: SessionSetDto[] = [mockSessionSet('ss1', 'tpe1', 0, 100, 5, 'SKIPPED')];
    const progressions: TrainingPlanExerciseProgressionDto[] = [mockExerciseProgression('ex1', 2.5, 'PROPORTIONAL', 10, 0, 2)];

    const result = resolveExerciseProgressions(sessionSets, planExercises, progressions);

    expect(result.exerciseProgressionsToUpdate.length).toBe(1);
    expect(result.exerciseProgressionsToUpdate[0].consecutive_failures).toBe(1);
    expect(result.exerciseSetsToUpdate.length).toBe(1);
    expect(result.exerciseSetsToUpdate[0].expected_weight).toBe(100);
    expect(result.exerciseSetsToUpdate[0].expected_reps).toBe(5);
  });

  it('should correctly progress multiple exercises with shared exercise_id on success', () => {
    const sharedExerciseId = 'exShared01';
    const tpeId1 = 'tpeShared001';
    const tpeId2 = 'tpeShared002';
    const weightIncrement = 2.5;

    const planExercise1_sets: TrainingPlanExerciseSetDto[] = [
      mockTrainingPlanExerciseSet('set_pe1_s1', tpeId1, 0, 100, 5),
    ];
    const planExercise2_sets: TrainingPlanExerciseSetDto[] = [
      mockTrainingPlanExerciseSet('set_pe2_s1', tpeId2, 0, 80, 10),
    ];

    const planExercises: TrainingPlanExerciseDto[] = [
      mockTrainingPlanExercise(tpeId1, sharedExerciseId, planExercise1_sets),
      mockTrainingPlanExercise(tpeId2, sharedExerciseId, planExercise2_sets),
    ];

    const sessionSets: SessionSetDto[] = [
      mockSessionSet('ss_pe1_s1', tpeId1, 0, 100, 5, 'COMPLETED'),
      mockSessionSet('ss_pe2_s1', tpeId2, 0, 80, 10, 'COMPLETED'),
    ];

    const progressions: TrainingPlanExerciseProgressionDto[] = [
      mockExerciseProgression(sharedExerciseId, weightIncrement, 'PROPORTIONAL', 10, 0, 2),
    ];

    const result = resolveExerciseProgressions(sessionSets, planExercises, progressions);
    const updatedSetForTpe1 = result?.exerciseSetsToUpdate?.find(s => s.training_plan_exercise_id === tpeId1 && s.set_index === 0);
    const updatedSetForTpe2 = result?.exerciseSetsToUpdate?.find(s => s.training_plan_exercise_id === tpeId2 && s.set_index === 0);
    const updatedProgression = result.exerciseProgressionsToUpdate[0];

    expect(result.exerciseSetsToUpdate.length).toBe(2);
    expect(updatedSetForTpe1).toBeDefined();
    expect(updatedSetForTpe1?.expected_weight).toBe(100 + weightIncrement);
    expect(updatedSetForTpe1?.expected_reps).toBe(5);
    expect(updatedSetForTpe2).toBeDefined();
    expect(updatedSetForTpe2?.expected_weight).toBe(80 + weightIncrement);
    expect(updatedSetForTpe2?.expected_reps).toBe(10);
    expect(result.exerciseProgressionsToUpdate.length).toBe(1);
    expect(updatedProgression.exercise_id).toBe(sharedExerciseId);
    expect(updatedProgression.consecutive_failures).toBe(0);
  });

  it('should correctly progress multiple exercises with shared exercise_id on failure', () => {
    const sharedExerciseId = 'exShared01';
    const tpeId1 = 'tpeShared001';
    const tpeId2 = 'tpeShared002';
    const weightIncrement = 2.5;

    const planExercise1_sets: TrainingPlanExerciseSetDto[] = [
      mockTrainingPlanExerciseSet('set_pe1_s1', tpeId1, 0, 100, 5),
    ];
    const planExercise2_sets: TrainingPlanExerciseSetDto[] = [
      mockTrainingPlanExerciseSet('set_pe2_s1', tpeId2, 0, 80, 10),
    ];

    const planExercises: TrainingPlanExerciseDto[] = [
      mockTrainingPlanExercise(tpeId1, sharedExerciseId, planExercise1_sets),
      mockTrainingPlanExercise(tpeId2, sharedExerciseId, planExercise2_sets),
    ];

    const sessionSets: SessionSetDto[] = [
      mockSessionSet('ss_pe1_s1', tpeId1, 0, 100, 5, 'COMPLETED'),
      mockSessionSet('ss_pe2_s1', tpeId2, 0, 80, 8, 'FAILED'),
    ];

    const progressions: TrainingPlanExerciseProgressionDto[] = [
      mockExerciseProgression(sharedExerciseId, weightIncrement, 'PROPORTIONAL', 10, 0, 2),
    ];

    const result = resolveExerciseProgressions(sessionSets, planExercises, progressions);
    const updatedSetForTpe1 = result?.exerciseSetsToUpdate?.find(s => s.training_plan_exercise_id === tpeId1 && s.set_index === 0);
    const updatedSetForTpe2 = result?.exerciseSetsToUpdate?.find(s => s.training_plan_exercise_id === tpeId2 && s.set_index === 0);
    const updatedProgression = result.exerciseProgressionsToUpdate[0];

    expect(result.exerciseSetsToUpdate.length).toBe(2);
    expect(updatedSetForTpe1).toBeDefined();
    expect(updatedSetForTpe1?.expected_weight).toBe(100);
    expect(updatedSetForTpe1?.expected_reps).toBe(5);
    expect(updatedSetForTpe2).toBeDefined();
    expect(updatedSetForTpe2?.expected_weight).toBe(80);
    expect(updatedSetForTpe2?.expected_reps).toBe(10);
    expect(result.exerciseProgressionsToUpdate.length).toBe(1);
    expect(updatedProgression.exercise_id).toBe(sharedExerciseId);
    expect(updatedProgression.consecutive_failures).toBe(1);
  });

  it('should warn and skip progression if no expected sets found for an exercise', () => {
    const planExercises: TrainingPlanExerciseDto[] = [mockTrainingPlanExercise('tpe1', 'ex1', [])];
    const sessionSets: SessionSetDto[] = [mockSessionSet('ss1', 'tpe1', 0, 100, 5)];
    const progressions: TrainingPlanExerciseProgressionDto[] = [mockExerciseProgression('ex1', 2.5)];

    const result = resolveExerciseProgressions(sessionSets, planExercises, progressions);

    expect(result.exerciseProgressionsToUpdate.length).toBe(0);
    expect(result.exerciseSetsToUpdate.length).toBe(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith('No expected sets found for exercise ex1. Skipping progression update.');
  });

  it('should throw error for unsupported deload strategy', () => {
    const planExercise1Sets = [mockTrainingPlanExerciseSet('set1-1', 'tpe1', 0, 100, 5)];
    const planExercises: TrainingPlanExerciseDto[] = [mockTrainingPlanExercise('tpe1', 'ex1', planExercise1Sets)];
    const sessionSets: SessionSetDto[] = [mockSessionSet('ss1', 'tpe1', 0, 100, 3)];
    const progressions: TrainingPlanExerciseProgressionDto[] = [mockExerciseProgression('ex1', 2.5, 'UNKNOWN_STRATEGY', 10, 1, 2)];

    expect(() => {
      resolveExerciseProgressions(sessionSets, planExercises, progressions);
    }).toThrow("Unsupported deload strategy: 'UNKNOWN_STRATEGY' for exercise ex1.");
  });

  it('should throw error if no progression found for an exercise', () => {
    const planExercise1Sets = [mockTrainingPlanExerciseSet('set1-1', 'tpe1', 0, 100, 5)];
    const planExercises: TrainingPlanExerciseDto[] = [mockTrainingPlanExercise('tpe1', 'ex1', planExercise1Sets)];
    const sessionSets: SessionSetDto[] = [mockSessionSet('ss1', 'tpe1', 0, 100, 5)];
    const progressions: TrainingPlanExerciseProgressionDto[] = [];

    expect(() => {
      resolveExerciseProgressions(sessionSets, planExercises, progressions);
    }).toThrow('No exercise progression found for exercise_id: ex1.');
  });

   it('should throw error if an expected set is missing from actual performed sets', () => {
    const planExercise1Sets = [
      mockTrainingPlanExerciseSet('set1-1', 'tpe1', 0, 100, 5),
      mockTrainingPlanExerciseSet('set1-2', 'tpe1', 1, 100, 5),
    ];
    const planExercises: TrainingPlanExerciseDto[] = [mockTrainingPlanExercise('tpe1', 'ex1', planExercise1Sets)];
    const sessionSets: SessionSetDto[] = [
      mockSessionSet('ss1', 'tpe1', 0, 100, 5),
    ];
    const progressions: TrainingPlanExerciseProgressionDto[] = [mockExerciseProgression('ex1', 2.5, 'PROPORTIONAL', 10, 0, 2)];

    expect(() => {
      resolveExerciseProgressions(sessionSets, planExercises, progressions);
    }).toThrow('No actual set found for expected set with index 1 of exercise ex1 (plan exercise ID: tpe1).');
  });
});
