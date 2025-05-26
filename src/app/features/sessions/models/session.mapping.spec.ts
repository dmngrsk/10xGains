import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TrainingPlanDayDto, TrainingPlanDto, TrainingPlanExerciseDto, TrainingPlanExerciseSetDto, TrainingSessionDto, ExerciseDto, SessionSetDto } from '@shared/api/api.types';
import { mapToSessionCardViewModel, mapToSessionPageViewModel, mapToSessionSetViewModel } from './session.mapping';
import { SessionSetStatus, SessionStatus } from './session.types';

const mockSetDto: SessionSetDto = {
  id: 'set1',
  training_plan_exercise_id: 'tpe1',
  training_session_id: 's1',
  set_index: 0,
  status: 'PENDING' as SessionSetStatus,
  expected_reps: 10,
  actual_reps: null,
  actual_weight: 0,
  completed_at: null,
};

const mockExerciseDto: ExerciseDto = {
  id: 'ex1',
  name: 'Bench Press',
  description: null,
};
const mockAllExercises: ExerciseDto[] = [mockExerciseDto];

const mockTrainingPlanExerciseSetDto: TrainingPlanExerciseSetDto = {
  id: 'tpes1',
  training_plan_exercise_id: 'tpe1',
  set_index: 0,
  expected_reps: 12,
  expected_weight: 50,
};

const mockTrainingPlanExerciseDto: TrainingPlanExerciseDto = {
  id: 'tpe1',
  training_plan_day_id: 'day1',
  exercise_id: 'ex1',
  order_index: 0,
  sets: [mockTrainingPlanExerciseSetDto],
};

const mockTrainingPlanDay: TrainingPlanDayDto = {
  id: 'day1',
  training_plan_id: 'plan1',
  name: 'Chest Day',
  order_index: 0,
  description: null,
  exercises: [mockTrainingPlanExerciseDto],
};

const mockTrainingPlanDto: TrainingPlanDto = {
  id: 'plan1',
  user_id: 'user1',
  name: 'My Strength Plan',
  description: 'A plan for strength',
  created_at: '2023-01-01T00:00:00Z',
  days: [mockTrainingPlanDay],
};

const mockTrainingSessionDto: TrainingSessionDto = {
  id: 's1',
  user_id: 'user1',
  training_plan_id: 'plan1',
  training_plan_day_id: 'day1',
  session_date: '2023-01-10T10:00:00Z',
  status: 'PENDING' as SessionStatus,
  sets: [mockSetDto],
};

describe('Session Mapping Functions', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('mapToSessionSetViewModel', () => {
    it('should map SessionSetDto to SessionSetViewModel correctly', () => {
      const localMockSetDto: SessionSetDto = {
        id: 'set1', training_plan_exercise_id: 'tpe1', training_session_id: 's1', set_index: 0,
        status: 'PENDING' as SessionSetStatus, expected_reps: 10, actual_reps: null, actual_weight: 0, completed_at: null,
      };

      const result = mapToSessionSetViewModel(localMockSetDto, 12);

      expect(result.id).toBe('set1');
      expect(result.status).toBe('PENDING');
      expect(result.order).toBe(0);
      expect(result.expectedReps).toBe(12);
      expect(result.actualReps).toBeNull();
      expect(result.weight).toBe(0);
      expect(result.trainingPlanExerciseId).toBe('tpe1');
    });

    it('should use dto.expected_reps if originalExpectedReps is null', () => {
      const localMockSetDto: SessionSetDto = {
        id: 'set1', training_plan_exercise_id: 'tpe1', training_session_id: 's1', set_index: 0,
        status: 'PENDING' as SessionSetStatus, expected_reps: 10, actual_reps: null, actual_weight: 0, completed_at: null,
      };

      const result = mapToSessionSetViewModel(localMockSetDto, null);

      expect(result.expectedReps).toBe(10);
    });

    it('should use dto.expected_reps if originalExpectedReps is undefined', () => {
       const localMockSetDto: SessionSetDto = {
        id: 'set1', training_plan_exercise_id: 'tpe1', training_session_id: 's1', set_index: 0,
        status: 'PENDING' as SessionSetStatus, expected_reps: 10, actual_reps: null, actual_weight: 0, completed_at: null,
      };

      const result = mapToSessionSetViewModel(localMockSetDto);

      expect(result.expectedReps).toBe(10);
    });

    it('should default expectedReps to 0 if dto.expected_reps is null (which it should not be based on type, but testing defensively) and original is null', () => {
      const dtoWithNullExpectedReps: SessionSetDto = {
        id: 'set1', training_plan_exercise_id: 'tpe1', training_session_id: 's1', set_index: 0,
        status: 'PENDING' as SessionSetStatus,
        expected_reps: 0,
        actual_reps: null, actual_weight: 0, completed_at: null,
      };

      const result = mapToSessionSetViewModel(dtoWithNullExpectedReps, null);
      expect(result.expectedReps).toBe(0);

      const dtoWithNonNullExpectedReps: SessionSetDto = {
        id: 'set1', training_plan_exercise_id: 'tpe1', training_session_id: 's1', set_index: 0,
        status: 'PENDING' as SessionSetStatus,
        expected_reps: 5,
        actual_reps: null, actual_weight: 0, completed_at: null,
      };

      const resultWithNonNull = mapToSessionSetViewModel(dtoWithNonNullExpectedReps, null);
      expect(resultWithNonNull.expectedReps).toBe(5);
    });
  });

  describe('mapToSessionCardViewModel', () => {
    it('should map TrainingSessionDto to SessionCardViewModel correctly', () => {
      const result = mapToSessionCardViewModel(mockTrainingSessionDto, mockTrainingPlanDto, mockAllExercises);
      expect(result.id).toBe('s1');
      expect(result.title).toBe('Chest Day');
      expect(result.sessionDate).toEqual(new Date('2023-01-10T10:00:00Z'));
      expect(result.status).toBe('PENDING');
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].name).toBe('Bench Press');
      expect(result.exercises[0].sets).toHaveLength(1);
      expect(result.exercises[0].sets[0].status).toBe('PENDING');
      expect(result.exercises[0].sets[0].expectedReps).toBe(10);
      expect(result.exercises[0].sets[0].actualWeight).toBe(0);
    });

    it('should handle missing planDay gracefully', () => {
      const sessionWithNoMatchingDay = { ...mockTrainingSessionDto, training_plan_day_id: 'nonexistentday' };
      const result = mapToSessionCardViewModel(sessionWithNoMatchingDay, mockTrainingPlanDto, mockAllExercises);
      expect(result.title).toBe('N/A');
      expect(result.exercises).toHaveLength(0);
    });

    it('should handle session.sets being undefined by creating exercise entries with empty sets', () => {
      const sessionWithoutSets = { ...mockTrainingSessionDto, sets: undefined };
      const result = mapToSessionCardViewModel(sessionWithoutSets, mockTrainingPlanDto, mockAllExercises);
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].sets).toHaveLength(0);
    });

    it('should handle planDay.exercises being undefined', () => {
      const planWithoutExercisesInDay: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        days: [{ ...mockTrainingPlanDay, exercises: undefined }],
      };
      const result = mapToSessionCardViewModel(mockTrainingSessionDto, planWithoutExercisesInDay, mockAllExercises);
      expect(result.exercises).toHaveLength(0);
    });

    it('should handle planDay.exercises being an empty array', () => {
      const planWithEmptyExercisesInDay: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        days: [{ ...mockTrainingPlanDay, exercises: [] }],
      };
      const result = mapToSessionCardViewModel(mockTrainingSessionDto, planWithEmptyExercisesInDay, mockAllExercises);
      expect(result.exercises).toHaveLength(0);
    });

    it('should use current date for sessionDate if session_date is null', () => {
      const sessionWithoutDate = { ...mockTrainingSessionDto, session_date: null };
      const result = mapToSessionCardViewModel(sessionWithoutDate, mockTrainingPlanDto, mockAllExercises);
      const now = new Date();
      const diff = now.getTime() - (result.sessionDate?.getTime() || 0);
      expect(diff).toBeLessThan(5000);
    });

    it('should handle exercises in planDay not found in allExercises gracefully', () => {
      const planWithUnknownExercise: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        days: [
          {
            ...mockTrainingPlanDay,
            exercises: [
              { ...mockTrainingPlanExerciseDto, exercise_id: 'unknownEx' },
            ],
          },
        ],
      };
      const result = mapToSessionCardViewModel(mockTrainingSessionDto, planWithUnknownExercise, mockAllExercises);
      expect(result.exercises).toHaveLength(0);
    });
  });

  describe('mapToSessionPageViewModel', () => {
    const exerciseMap = new Map<string, Pick<ExerciseDto, 'name'>>();
    exerciseMap.set(mockExerciseDto.id, { name: mockExerciseDto.name });

    it('should map TrainingSessionDto to SessionPageViewModel correctly', () => {
      const result = mapToSessionPageViewModel(mockTrainingSessionDto, mockTrainingPlanDto, exerciseMap);
      expect(result).not.toBeNull();
      if (!result) throw new Error('mapToSessionPageViewModel returned null unexpectedly');

      expect(result.id).toBe('s1');
      expect(result.metadata).toBeDefined();
      if (!result.metadata) throw new Error('Metadata should be defined');
      expect(result.metadata.planName).toBe('My Strength Plan');
      expect(result.metadata.dayName).toBe('Chest Day');
      expect(result.metadata.status).toBe('PENDING');
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].exerciseName).toBe('Bench Press');
      expect(result.exercises[0].trainingPlanExerciseId).toBe('tpe1');
      expect(result.exercises[0].sets).toHaveLength(1);
      expect(result.exercises[0].sets[0].id).toBe('set1');
      expect(result.exercises[0].sets[0].expectedReps).toBe(12);
      expect(result.exercises[0].sets[0].weight).toBe(0);
    });

    it('should return null if plan is null or undefined', () => {
      expect(mapToSessionPageViewModel(mockTrainingSessionDto, null, exerciseMap)).toBeNull();
      expect(mapToSessionPageViewModel(mockTrainingSessionDto, undefined, exerciseMap)).toBeNull();
    });

    it('should return null if planDay is not found in plan', () => {
      const planWithoutMatchingDay: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        days: [{...mockTrainingPlanDay, id: 'anotherDayId'}]
      };
      expect(mapToSessionPageViewModel(mockTrainingSessionDto, planWithoutMatchingDay, exerciseMap)).toBeNull();
    });

    it('should return null if planDay.exercises are missing (undefined or null)', () => {
      const planWithoutDayExercisesUndefined: TrainingPlanDto = { ...mockTrainingPlanDto, days: [{ ...mockTrainingPlanDay, exercises: undefined }] };
      expect(mapToSessionPageViewModel(mockTrainingSessionDto, planWithoutDayExercisesUndefined, exerciseMap)).toBeNull();

      const mockTrainingPlanDayWithNullExercises: TrainingPlanDayDto = {
        ...mockTrainingPlanDay,
        exercises: null as unknown as TrainingPlanExerciseDto[]
      };
      const planWithoutDayExercisesNull: TrainingPlanDto = { ...mockTrainingPlanDto, days: [mockTrainingPlanDayWithNullExercises] };
      expect(mapToSessionPageViewModel(mockTrainingSessionDto, planWithoutDayExercisesNull, exerciseMap)).toBeNull();
    });

    it('should handle currentSession.sets being undefined, resulting in empty set view models for planned exercises', () => {
      const sessionWithoutSets = { ...mockTrainingSessionDto, sets: undefined };
      const result = mapToSessionPageViewModel(sessionWithoutSets, mockTrainingPlanDto, exerciseMap);
      expect(result).not.toBeNull();
      if (!result) throw new Error('mapToSessionPageViewModel returned null unexpectedly');
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].sets).toHaveLength(0);
    });

    it('should correctly map expectedReps from planned set if available, otherwise from actual set DTO', () => {
      const setDtoWithExpectedReps8: SessionSetDto = { ...mockSetDto, expected_reps: 8, actual_weight: 10 };
      const plannedExerciseWithSpecificSet: TrainingPlanExerciseDto = {
        ...mockTrainingPlanExerciseDto,
        sets: [{ ...mockTrainingPlanExerciseSetDto, set_index: 0, expected_reps: 15, expected_weight: 70 }],
      };
      const planWithSpecificSet: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        days: [{ ...mockTrainingPlanDay, exercises: [plannedExerciseWithSpecificSet] }],
      };
      const sessionWithSpecificSet = { ...mockTrainingSessionDto, sets: [setDtoWithExpectedReps8] };

      const result = mapToSessionPageViewModel(sessionWithSpecificSet, planWithSpecificSet, exerciseMap);
      expect(result).not.toBeNull();
      if (!result) throw new Error('mapToSessionPageViewModel returned null unexpectedly');
      expect(result.exercises[0].sets[0].expectedReps).toBe(15);

      const plannedSetWithNullExpectedReps: TrainingPlanExerciseSetDto = {
        ...mockTrainingPlanExerciseSetDto,
        set_index: 0,
        expected_reps: 0,
      };
       const plannedExerciseWithZeroExpectedRepsInSet: TrainingPlanExerciseDto = {
        ...mockTrainingPlanExerciseDto,
        sets: [plannedSetWithNullExpectedReps],
      };
      const planWithZeroExpectedRepsInSet: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        days: [{ ...mockTrainingPlanDay, exercises: [plannedExerciseWithZeroExpectedRepsInSet] }],
      };
      const result2 = mapToSessionPageViewModel(sessionWithSpecificSet, planWithZeroExpectedRepsInSet, exerciseMap);
      expect(result2).not.toBeNull();

      if (!result2) throw new Error('mapToSessionPageViewModel returned null unexpectedly');
      expect(result2.exercises[0].sets[0].expectedReps).toBe(0);
    });

     it('should default to 0 expectedReps if not in planned set (e.g. 0) and not in actual set DTO (e.g. 0)', () => {
      const setDtoNoExpected: SessionSetDto = { ...mockSetDto, expected_reps: 0, actual_weight: 10 };
      const plannedSetNoExpected: TrainingPlanExerciseSetDto = {
        ...mockTrainingPlanExerciseSetDto,
        set_index: 0,
        expected_reps: 0,
      };
       const plannedExerciseNoExpected: TrainingPlanExerciseDto = {
        ...mockTrainingPlanExerciseDto,
        sets: [plannedSetNoExpected],
      };
      const planNoExpected: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        days: [{ ...mockTrainingPlanDay, exercises: [plannedExerciseNoExpected] }],
      };
      const sessionNoExpected = { ...mockTrainingSessionDto, sets: [setDtoNoExpected] };

      const result = mapToSessionPageViewModel(sessionNoExpected, planNoExpected, exerciseMap);
      expect(result).not.toBeNull();
      if (!result) throw new Error('mapToSessionPageViewModel returned null unexpectedly');
      expect(result.exercises[0].sets[0].expectedReps).toBe(0);
    });

    it('should map exercise name to Unknown Exercise if not in exerciseDetailsMap', () => {
      const planWithUnknownExerciseId: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        days: [
          {
            ...mockTrainingPlanDay,
            exercises: [
              { ...mockTrainingPlanExerciseDto, exercise_id: 'unknownExId' },
            ],
          },
        ],
      };
      const result = mapToSessionPageViewModel(mockTrainingSessionDto, planWithUnknownExerciseId, exerciseMap);
      expect(result).not.toBeNull();
      if (!result) throw new Error('mapToSessionPageViewModel returned null unexpectedly');
      expect(result.exercises[0].exerciseName).toBe('Unknown Exercise');
    });
  });
});
