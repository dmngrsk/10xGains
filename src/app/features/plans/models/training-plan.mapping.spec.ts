import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrainingPlanDto, UserProfileDto, ExerciseDto } from '@shared/api/api.types';
import { mapToTrainingPlanViewModel, mapToTrainingPlanDto, mapToTrainingPlanDayDto, mapToTrainingPlanExerciseDto, mapToTrainingPlanExerciseSetDto } from './training-plan.mapping';
import type { TrainingPlanViewModel, TrainingPlanDayViewModel, TrainingPlanExerciseViewModel, TrainingPlanExerciseSetViewModel } from './training-plan.viewmodel';

describe('Training Plan Mapping', () => {
  describe('mapToTrainingPlanExerciseSetDto', () => {
    it('should throw an error if the set ViewModel is null or undefined', () => {
      expect(() => mapToTrainingPlanExerciseSetDto(null!)).toThrowError('Training plan exercise set ViewModel is required');
      expect(() => mapToTrainingPlanExerciseSetDto(undefined!)).toThrowError('Training plan exercise set ViewModel is required');
    });

    it('should correctly map TrainingPlanExerciseSetViewModel to TrainingPlanExerciseSetDto', () => {
      const viewModelSet: TrainingPlanExerciseSetViewModel = {
        id: 'set-1',
        setIndex: 1,
        expectedReps: 10,
        expectedWeight: 50,
        trainingPlanExerciseId: 'tpe-1',
      };
      const result = mapToTrainingPlanExerciseSetDto(viewModelSet);
      expect(result).toMatchInlineSnapshot(`
        {
          "expected_reps": 10,
          "expected_weight": 50,
          "id": "set-1",
          "set_index": 1,
          "training_plan_exercise_id": "tpe-1",
        }
      `);
    });

    it('should default null expectedReps and expectedWeight to 0', () => {
      const viewModelSet: TrainingPlanExerciseSetViewModel = {
        id: 'set-2',
        setIndex: 2,
        expectedReps: null,
        expectedWeight: null,
        trainingPlanExerciseId: 'tpe-1',
      };
      const result = mapToTrainingPlanExerciseSetDto(viewModelSet);
      expect(result.expected_reps).toBe(0);
      expect(result.expected_weight).toBe(0);
      expect(result).toMatchInlineSnapshot(`
        {
          "expected_reps": 0,
          "expected_weight": 0,
          "id": "set-2",
          "set_index": 2,
          "training_plan_exercise_id": "tpe-1",
        }
      `);
    });
  });

  describe('mapToTrainingPlanExerciseDto', () => {
    it('should throw an error if the exercise ViewModel is null or undefined', () => {
      expect(() => mapToTrainingPlanExerciseDto(null!)).toThrowError('Training plan exercise ViewModel is required');
      expect(() => mapToTrainingPlanExerciseDto(undefined!)).toThrowError('Training plan exercise ViewModel is required');
    });

    it('should correctly map TrainingPlanExerciseViewModel to TrainingPlanExerciseDto', () => {
      const viewModelExercise: TrainingPlanExerciseViewModel = {
        id: 'ex-1',
        exerciseId: 'e-1',
        exerciseName: 'Bench Press',
        orderIndex: 0,
        trainingPlanDayId: 'tpd-1',
        sets: [
          { id: 'set-1', setIndex: 1, expectedReps: 10, expectedWeight: 50, trainingPlanExerciseId: 'ex-1' },
          { id: 'set-0', setIndex: 0, expectedReps: 12, expectedWeight: 40, trainingPlanExerciseId: 'ex-1' },
        ],
      };
      const result = mapToTrainingPlanExerciseDto(viewModelExercise);
      expect(result).toMatchInlineSnapshot(`
        {
          "exercise_id": "e-1",
          "id": "ex-1",
          "order_index": 0,
          "sets": [
            {
              "expected_reps": 12,
              "expected_weight": 40,
              "id": "set-0",
              "set_index": 0,
              "training_plan_exercise_id": "ex-1",
            },
            {
              "expected_reps": 10,
              "expected_weight": 50,
              "id": "set-1",
              "set_index": 1,
              "training_plan_exercise_id": "ex-1",
            },
          ],
          "training_plan_day_id": "tpd-1",
        }
      `);

      expect(result.sets![0].id).toBe('set-0');
      expect(result.sets![1].id).toBe('set-1');
    });

    it('should handle empty sets array', () => {
      const viewModelExercise: TrainingPlanExerciseViewModel = {
        id: 'ex-2',
        exerciseId: 'e-2',
        exerciseName: 'Squats',
        orderIndex: 1,
        trainingPlanDayId: 'tpd-1',
        sets: [],
      };
      const result = mapToTrainingPlanExerciseDto(viewModelExercise);
      expect(result.sets).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "exercise_id": "e-2",
          "id": "ex-2",
          "order_index": 1,
          "sets": [],
          "training_plan_day_id": "tpd-1",
        }
      `);
    });

    it('should handle null sets property', () => {
      const viewModelExercise: TrainingPlanExerciseViewModel = {
        id: 'ex-3',
        exerciseId: 'e-3',
        exerciseName: 'Deadlift',
        orderIndex: 2,
        trainingPlanDayId: 'tpd-1',
        sets: null!
      };
      const result = mapToTrainingPlanExerciseDto(viewModelExercise);
      expect(result.sets).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "exercise_id": "e-3",
          "id": "ex-3",
          "order_index": 2,
          "sets": [],
          "training_plan_day_id": "tpd-1",
        }
      `);
    });
  });

  describe('mapToTrainingPlanDayDto', () => {
    it('should throw an error if the day ViewModel is null or undefined', () => {
      expect(() => mapToTrainingPlanDayDto(null!)).toThrowError('Training plan day ViewModel is required');
      expect(() => mapToTrainingPlanDayDto(undefined!)).toThrowError('Training plan day ViewModel is required');
    });

    it('should correctly map TrainingPlanDayViewModel to TrainingPlanDayDto', () => {
      const viewModelDay: TrainingPlanDayViewModel = {
        id: 'day-1',
        name: 'Push Day',
        description: 'Chest, Shoulders, Triceps',
        orderIndex: 0,
        trainingPlanId: 'tp-1',
        exercises: [
          {
            id: 'ex-1',
            exerciseId: 'e-1',
            exerciseName: 'Bench Press',
            orderIndex: 1,
            trainingPlanDayId: 'day-1',
            sets: [
              { id: 'set-1a', setIndex: 0, expectedReps: 8, expectedWeight: 60, trainingPlanExerciseId: 'ex-1' },
            ],
          },
          {
            id: 'ex-0',
            exerciseId: 'e-0',
            exerciseName: 'Overhead Press',
            orderIndex: 0,
            trainingPlanDayId: 'day-1',
            sets: [
              { id: 'set-0a', setIndex: 0, expectedReps: 10, expectedWeight: 40, trainingPlanExerciseId: 'ex-0' },
            ],
          },
        ],
      };
      const result = mapToTrainingPlanDayDto(viewModelDay);
      expect(result).toMatchInlineSnapshot(`
        {
          "description": "Chest, Shoulders, Triceps",
          "exercises": [
            {
              "exercise_id": "e-0",
              "id": "ex-0",
              "order_index": 0,
              "sets": [
                {
                  "expected_reps": 10,
                  "expected_weight": 40,
                  "id": "set-0a",
                  "set_index": 0,
                  "training_plan_exercise_id": "ex-0",
                },
              ],
              "training_plan_day_id": "day-1",
            },
            {
              "exercise_id": "e-1",
              "id": "ex-1",
              "order_index": 1,
              "sets": [
                {
                  "expected_reps": 8,
                  "expected_weight": 60,
                  "id": "set-1a",
                  "set_index": 0,
                  "training_plan_exercise_id": "ex-1",
                },
              ],
              "training_plan_day_id": "day-1",
            },
          ],
          "id": "day-1",
          "name": "Push Day",
          "order_index": 0,
          "training_plan_id": "tp-1",
        }
      `);

      expect(result.exercises![0].id).toBe('ex-0');
      expect(result.exercises![1].id).toBe('ex-1');
    });

    it('should handle empty exercises array', () => {
      const viewModelDay: TrainingPlanDayViewModel = {
        id: 'day-2',
        name: 'Rest Day',
        description: null,
        orderIndex: 1,
        trainingPlanId: 'tp-1',
        exercises: [],
      };
      const result = mapToTrainingPlanDayDto(viewModelDay);
      expect(result.exercises).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "description": null,
          "exercises": [],
          "id": "day-2",
          "name": "Rest Day",
          "order_index": 1,
          "training_plan_id": "tp-1",
        }
      `);
    });

    it('should handle null exercises property', () => {
      const viewModelDay: TrainingPlanDayViewModel = {
        id: 'day-3',
        name: 'Cardio Day',
        description: 'LISS',
        orderIndex: 2,
        trainingPlanId: 'tp-1',
        exercises: null!,
      };
      const result = mapToTrainingPlanDayDto(viewModelDay);
      expect(result.exercises).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "description": "LISS",
          "exercises": [],
          "id": "day-3",
          "name": "Cardio Day",
          "order_index": 2,
          "training_plan_id": "tp-1",
        }
      `);
    });
  });

  describe('mapToTrainingPlanDto', () => {
    it('should throw an error if the plan ViewModel is null or undefined', () => {
      expect(() => mapToTrainingPlanDto(null!)).toThrowError('Training plan ViewModel is required');
      expect(() => mapToTrainingPlanDto(undefined!)).toThrowError('Training plan ViewModel is required');
    });

    it('should correctly map TrainingPlanViewModel to TrainingPlanDto', () => {
      const viewModelPlan: TrainingPlanViewModel = {
        id: 'plan-1',
        userId: 'user-123',
        name: 'My Awesome Plan',
        description: 'A plan to be awesome',
        createdAt: '2023-01-01T00:00:00.000Z',
        isActive: true,
        days: [
          {
            id: 'day-1',
            name: 'Day 1',
            description: 'Push',
            orderIndex: 1,
            trainingPlanId: 'plan-1',
            exercises: [
              {
                id: 'ex-1',
                exerciseId: 'e-1',
                exerciseName: 'Bench',
                orderIndex: 0,
                trainingPlanDayId: 'day-1',
                sets: [
                  { id: 'set-1a', setIndex: 0, expectedReps: 5, expectedWeight: 100, trainingPlanExerciseId: 'ex-1' },
                ],
              },
            ],
          },
          {
            id: 'day-0',
            name: 'Day 0',
            description: 'Pull',
            orderIndex: 0,
            trainingPlanId: 'plan-1',
            exercises: [],
          },
        ],
      };

      const fixedDate = new Date('2024-01-01T10:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => fixedDate as Date);

      const result = mapToTrainingPlanDto(viewModelPlan);

      expect(result).toMatchInlineSnapshot(`
        {
          "created_at": "2023-01-01T00:00:00.000Z",
          "days": [
            {
              "description": "Pull",
              "exercises": [],
              "id": "day-0",
              "name": "Day 0",
              "order_index": 0,
              "training_plan_id": "plan-1",
            },
            {
              "description": "Push",
              "exercises": [
                {
                  "exercise_id": "e-1",
                  "id": "ex-1",
                  "order_index": 0,
                  "sets": [
                    {
                      "expected_reps": 5,
                      "expected_weight": 100,
                      "id": "set-1a",
                      "set_index": 0,
                      "training_plan_exercise_id": "ex-1",
                    },
                  ],
                  "training_plan_day_id": "day-1",
                },
              ],
              "id": "day-1",
              "name": "Day 1",
              "order_index": 1,
              "training_plan_id": "plan-1",
            },
          ],
          "description": "A plan to be awesome",
          "id": "plan-1",
          "name": "My Awesome Plan",
          "user_id": "user-123",
        }
      `);

      expect(result.days![0].id).toBe('day-0');
      expect(result.days![1].id).toBe('day-1');

      vi.restoreAllMocks();
    });

    it('should use current date for created_at if viewModel.createdAt is null', () => {
      const viewModelPlan: TrainingPlanViewModel = {
        id: 'plan-2',
        userId: 'user-456',
        name: 'Plan with null createdAt',
        description: null,
        createdAt: null,
        isActive: false,
        days: [],
      };

      const mockDate = new Date('2023-03-15T12:30:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as Date);

      const result = mapToTrainingPlanDto(viewModelPlan);
      expect(result.created_at).toBe('2023-03-15T12:30:00.000Z');
      expect(result).toMatchInlineSnapshot(`
        {
          "created_at": "2023-03-15T12:30:00.000Z",
          "days": [],
          "description": null,
          "id": "plan-2",
          "name": "Plan with null createdAt",
          "user_id": "user-456",
        }
      `);
      vi.restoreAllMocks();
    });

    it('should handle empty days array', () => {
      const viewModelPlan: TrainingPlanViewModel = {
        id: 'plan-no-days',
        userId: 'user-789',
        name: 'Plan without days',
        description: 'empty',
        createdAt: '2023-01-01T00:00:00.000Z',
        isActive: true,
        days: [],
      };
      const result = mapToTrainingPlanDto(viewModelPlan);
      expect(result.days).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "created_at": "2023-01-01T00:00:00.000Z",
          "days": [],
          "description": "empty",
          "id": "plan-no-days",
          "name": "Plan without days",
          "user_id": "user-789",
        }
      `);
    });

    it('should handle null days property', () => {
      const viewModelPlan: TrainingPlanViewModel = {
        id: 'plan-null-days',
        userId: 'user-abc',
        name: 'Plan with null days',
        description: 'also empty',
        createdAt: '2023-01-01T00:00:00.000Z',
        isActive: false,
        days: null!,
      };
      const result = mapToTrainingPlanDto(viewModelPlan);
      expect(result.days).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "created_at": "2023-01-01T00:00:00.000Z",
          "days": [],
          "description": "also empty",
          "id": "plan-null-days",
          "name": "Plan with null days",
          "user_id": "user-abc",
        }
      `);
    });
  });

  describe('mapToTrainingPlanViewModel', () => {
    let mockTrainingPlanDto: TrainingPlanDto;
    let mockUserProfileDto: UserProfileDto;
    let mockExercises: Pick<ExerciseDto, 'id' | 'name' | 'description'>[];

    beforeEach(() => {
      mockTrainingPlanDto = {
        id: 'tp-1',
        user_id: 'user-123',
        name: 'Strength Program',
        description: 'A plan focused on building strength.',
        created_at: new Date().toISOString(),
        days: [
          {
            id: 'day-1',
            name: 'Push Day',
            description: 'Chest, Shoulders, Triceps',
            order_index: 0,
            training_plan_id: 'tp-1',
            exercises: [
              {
                id: 'ex-1',
                exercise_id: 'e-1',
                order_index: 0,
                training_plan_day_id: 'day-1',
                sets: [
                  { id: 'set-1a', set_index: 0, expected_reps: 8, expected_weight: 60, training_plan_exercise_id: 'ex-1' },
                ],
              },
            ],
          },
        ],
      };
      mockUserProfileDto = {
        id: 'user-profile-1',
        first_name: 'Test',
        active_training_plan_id: 'tp-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ai_suggestions_remaining: 5
      };
      mockExercises = [
        { id: 'e-1', name: 'Bench Press', description: 'Chest exercise' },
        { id: 'e-2', name: 'Squat', description: 'Leg exercise' },
        { id: 'e-b1', name: 'Exercise e-b1', description: 'desc'},
        { id: 'e-b2', name: 'Exercise e-b2', description: 'desc'},
        { id: 'e-a1', name: 'Exercise e-a1', description: 'desc'},
        { id: 'e-a2', name: 'Exercise e-a2', description: 'desc'},
      ];
    });

    it('should throw an error if the DTO is null or undefined', () => {
      expect(() => mapToTrainingPlanViewModel(null!, mockExercises, null)).toThrowError('Training plan DTO is required');
      expect(() => mapToTrainingPlanViewModel(undefined!, mockExercises, null)).toThrowError('Training plan DTO is required');
    });

    it('should correctly map TrainingPlanDto to TrainingPlanViewModel', () => {
      const result = mapToTrainingPlanViewModel(mockTrainingPlanDto, mockExercises, mockUserProfileDto);
      expect(result.id).toBe('tp-1');
      expect(result.name).toBe('Strength Program');
      expect(result.description).toBe('A plan focused on building strength.');
      expect(result.isActive).toBe(true);
      expect(result.days).toHaveLength(1);
      expect(result.days[0].name).toBe('Push Day');
      expect(result.days[0].exercises[0].exerciseName).toBe('Bench Press');
    });

    it('should set isActive to false if userProfile is null', () => {
      const result = mapToTrainingPlanViewModel(mockTrainingPlanDto, mockExercises, null);
      expect(result.isActive).toBe(false);
    });

    it('should set isActive to false if active_training_plan_id does not match', () => {
      const nonActiveUserProfile: UserProfileDto = { ...mockUserProfileDto, active_training_plan_id: 'tp-other' };
      const result = mapToTrainingPlanViewModel(mockTrainingPlanDto, mockExercises, nonActiveUserProfile);
      expect(result.isActive).toBe(false);
    });

    it('should set isActive to false if active_training_plan_id is null in userProfile', () => {
      const profileWithNullActivePlan: UserProfileDto = { ...mockUserProfileDto, active_training_plan_id: null };
      const result = mapToTrainingPlanViewModel(mockTrainingPlanDto, mockExercises, profileWithNullActivePlan);
      expect(result.isActive).toBe(false);
    });

    it('should handle null or empty days array', () => {
      const dtoNoDays: TrainingPlanDto = { ...mockTrainingPlanDto, days: [] };
      let result = mapToTrainingPlanViewModel(dtoNoDays, mockExercises, mockUserProfileDto);
      expect(result.days).toEqual([]);

      const dtoNullDays: TrainingPlanDto = { ...mockTrainingPlanDto, days: null! };
      result = mapToTrainingPlanViewModel(dtoNullDays, mockExercises, mockUserProfileDto);
      expect(result.days).toEqual([]);
    });

    it('should sort days and exercises by orderIndex', () => {
      const unsortedDto: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        id: 'tp-unsorted',
        days: [
          { id: 'day-2', name: 'Day B', description: null, order_index: 1, training_plan_id: 'tp-unsorted', exercises: [
            { id: 'ex-b2', exercise_id: 'e-b2', order_index: 1, training_plan_day_id: 'day-2', sets: [] },
            { id: 'ex-b1', exercise_id: 'e-b1', order_index: 0, training_plan_day_id: 'day-2', sets: [] },
          ]},
          { id: 'day-1', name: 'Day A', description: null, order_index: 0, training_plan_id: 'tp-unsorted', exercises: [
            { id: 'ex-a2', exercise_id: 'e-a2', order_index: 1, training_plan_day_id: 'day-1', sets: [] },
            { id: 'ex-a1', exercise_id: 'e-a1', order_index: 0, training_plan_day_id: 'day-1', sets: [] },
          ]},
        ],
      };
      const result = mapToTrainingPlanViewModel(unsortedDto, mockExercises, mockUserProfileDto);
      expect(result.days[0].id).toBe('day-1');
      expect(result.days[1].id).toBe('day-2');
      expect(result.days[0].exercises[0].id).toBe('ex-a1');
      expect(result.days[0].exercises[1].id).toBe('ex-a2');
      expect(result.days[1].exercises[0].id).toBe('ex-b1');
      expect(result.days[1].exercises[1].id).toBe('ex-b2');
    });

    it('should use "Unknown Exercise" if matching exercise is not found', () => {
      const dtoWithUnknownExercise: TrainingPlanDto = {
        ...mockTrainingPlanDto,
        days: [
          {
            ...mockTrainingPlanDto.days![0],
            exercises: [
              {
                ...mockTrainingPlanDto.days![0].exercises![0],
                exercise_id: 'e-unknown',
              },
            ],
          },
        ],
      };
      const result = mapToTrainingPlanViewModel(dtoWithUnknownExercise, mockExercises, mockUserProfileDto);
      expect(result.days[0].exercises[0].exerciseName).toBe('Unknown Exercise');
    });
  });

  describe('Round-trip mapping integrity', () => {
    let mockUserProfileDto: UserProfileDto;
    let mockExercises: Pick<ExerciseDto, 'id' | 'name' | 'description'>[];
    let mockDto: TrainingPlanDto;
    let mockViewModel: TrainingPlanViewModel;

    beforeEach(() => {
      mockUserProfileDto = {
        id: 'user-profile-common',
        first_name: 'CommonUser',
        active_training_plan_id: 'tp-vm-rt',
        created_at: new Date('2023-01-01T00:00:00.000Z').toISOString(),
        updated_at: new Date('2023-01-01T00:00:00.000Z').toISOString(),
        ai_suggestions_remaining: 10
      };

      mockExercises = [
        { id: 'e-rt-dto1', name: 'Exercise e-rt-dto1', description:'DTO exercise'},
        { id: 'e-vm-rt1', name: 'VM RT Exercise 1', description:'VM exercise'},
      ];

      mockDto = {
        id: 'base-dto-id',
        user_id: 'user-rt-dto',
        name: 'DTO Round Trip Plan',
        description: 'Full description for DTO round trip.',
        created_at: new Date('2023-01-01T12:00:00.000Z').toISOString(),
        days: [
          {
            id: 'day-rt-dto1',
            name: 'RT Day DTO1',
            description: 'RT Day DTO1 Desc',
            order_index: 0,
            training_plan_id: 'base-dto-id',
            exercises: [
              {
                id: 'ex-rt-dto1a',
                exercise_id: 'e-rt-dto1',
                order_index: 0,
                training_plan_day_id: 'day-rt-dto1',
                sets: [
                  { id: 'set-rt-dto1a1', set_index: 0, expected_reps: 5, expected_weight: 100, training_plan_exercise_id: 'ex-rt-dto1a' },
                ],
              },
            ],
          },
        ],
      };

      mockViewModel = {
        id: 'tp-vm-rt',
        userId: 'user-vm-rt',
        name: 'VM Round Trip Plan',
        description: 'Full description for VM round trip.',
        createdAt: new Date('2023-02-01T10:00:00.000Z').toISOString(),
        isActive: true,
        days: [
          {
            id: 'day-vm-rt1',
            name: 'VM RT Day 1',
            description: 'RT Day 1 Desc',
            orderIndex: 0,
            trainingPlanId: 'tp-vm-rt',
            exercises: [
              {
                id: 'ex-vm-rt1a',
                exerciseId: 'e-vm-rt1',
                exerciseName: 'VM RT Exercise 1',
                orderIndex: 0,
                trainingPlanDayId: 'day-vm-rt1',
                sets: [
                  { id: 'set-vm-rt1a1', setIndex: 0, expectedReps: 8, expectedWeight: 80, trainingPlanExerciseId: 'ex-vm-rt1a' },
                ],
              },
            ],
          },
        ],
      };
    });

    it('DTO -> ViewModel -> DTO: should maintain data integrity', () => {
      const intermediateViewModel = mapToTrainingPlanViewModel(mockDto, mockExercises, mockUserProfileDto);
      const finalDto = mapToTrainingPlanDto(intermediateViewModel);

      expect(finalDto.id).toBe(mockDto.id);
      expect(finalDto.user_id).toBe(mockDto.user_id);
      expect(finalDto.name).toBe(mockDto.name);
      expect(finalDto.description).toBe(mockDto.description);
      expect(finalDto.created_at).toBe(mockDto.created_at);

      expect(finalDto.days).toHaveLength(mockDto.days!.length);
      finalDto.days?.forEach((dayDto, dayIndex) => {
        const originalDayDto = mockDto.days![dayIndex];
        expect(dayDto.id).toBe(originalDayDto.id);
        expect(dayDto.name).toBe(originalDayDto.name);
        expect(dayDto.description).toBe(originalDayDto.description);
        expect(dayDto.order_index).toBe(originalDayDto.order_index);
        expect(dayDto.training_plan_id).toBe(originalDayDto.training_plan_id);

        expect(dayDto.exercises).toHaveLength(originalDayDto.exercises!.length);
        dayDto.exercises?.forEach((exDto, exIndex) => {
          const originalExDto = originalDayDto.exercises![exIndex];
          expect(exDto.id).toBe(originalExDto.id);
          expect(exDto.exercise_id).toBe(originalExDto.exercise_id);
          expect(exDto.order_index).toBe(originalExDto.order_index);
          expect(exDto.training_plan_day_id).toBe(originalExDto.training_plan_day_id);

          expect(exDto.sets).toHaveLength(originalExDto.sets!.length);
          exDto.sets?.forEach((setDto, setIndex) => {
            const originalSetDto = originalExDto.sets![setIndex];
            expect(setDto.id).toBe(originalSetDto.id);
            expect(setDto.set_index).toBe(originalSetDto.set_index);
            expect(setDto.expected_weight).toBe(originalSetDto.expected_weight);
            expect(setDto.expected_reps).toBe(originalSetDto.expected_reps);
            expect(setDto.training_plan_exercise_id).toBe(originalSetDto.training_plan_exercise_id);
          });
        });
      });
    });

    it('ViewModel -> DTO -> ViewModel: should maintain data integrity', () => {
      const intermediateDto = mapToTrainingPlanDto(mockViewModel);
      const finalViewModel = mapToTrainingPlanViewModel(intermediateDto, mockExercises, mockUserProfileDto);

      expect(finalViewModel.id).toBe(mockViewModel.id);
      expect(finalViewModel.userId).toBe(mockViewModel.userId);
      expect(finalViewModel.name).toBe(mockViewModel.name);
      expect(finalViewModel.description).toBe(mockViewModel.description);
      expect(finalViewModel.createdAt).toBe(mockViewModel.createdAt);
      expect(finalViewModel.isActive).toBe(mockViewModel.isActive);

      expect(finalViewModel.days).toHaveLength(mockViewModel.days.length);
      finalViewModel.days.forEach((dayVm, dayIndex) => {
        const originalDayVm = mockViewModel.days[dayIndex];
        expect(dayVm.id).toBe(originalDayVm.id);
        expect(dayVm.name).toBe(originalDayVm.name);
        expect(dayVm.description).toBe(originalDayVm.description);
        expect(dayVm.orderIndex).toBe(originalDayVm.orderIndex);
        expect(dayVm.trainingPlanId).toBe(originalDayVm.trainingPlanId);

        expect(dayVm.exercises).toHaveLength(originalDayVm.exercises.length);
        dayVm.exercises.forEach((exVm, exIndex) => {
          const originalExVm = originalDayVm.exercises[exIndex];
          expect(exVm.id).toBe(originalExVm.id);
          expect(exVm.exerciseId).toBe(originalExVm.exerciseId);
          expect(exVm.exerciseName).toBe(originalExVm.exerciseName);
          expect(exVm.orderIndex).toBe(originalExVm.orderIndex);
          expect(exVm.trainingPlanDayId).toBe(originalExVm.trainingPlanDayId);

          expect(exVm.sets).toHaveLength(originalExVm.sets.length);
          exVm.sets.forEach((setVm, setIndex) => {
            const originalSetVm = originalExVm.sets[setIndex];
            expect(setVm.id).toBe(originalSetVm.id);
            expect(setVm.setIndex).toBe(originalSetVm.setIndex);
            expect(setVm.expectedReps).toBe(originalSetVm.expectedReps);
            expect(setVm.expectedWeight).toBe(originalSetVm.expectedWeight);
            expect(setVm.trainingPlanExerciseId).toBe(originalSetVm.trainingPlanExerciseId);
          });
        });
      });
    });
  });
});
