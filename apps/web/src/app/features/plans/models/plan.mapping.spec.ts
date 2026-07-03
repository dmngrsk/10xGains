import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlanDto, ProfileDto, ExerciseDto, PlanExerciseProgressionDto } from '@shared/api/api.types';
import { mapToPlanViewModel, mapToPlanDto, mapToPlanDayDto, mapToPlanExerciseDto, mapToPlanExerciseSetDto, mapToPlanExerciseProgressionDto } from './plan.mapping';
import type { PlanViewModel, PlanDayViewModel, PlanExerciseViewModel, PlanExerciseSetViewModel, PlanExerciseProgressionViewModel } from './plan.viewmodel';

describe('Plan Mapping Functions', () => {
  describe('mapToPlanDto', () => {
    it('should throw an error if the plan ViewModel is null or undefined', () => {
      expect(() => mapToPlanDto(null!)).toThrowError('Plan ViewModel is required');
      expect(() => mapToPlanDto(undefined!)).toThrowError('Plan ViewModel is required');
    });

    it('should correctly map PlanViewModel to PlanDto', () => {
      const viewModelPlan: PlanViewModel = {
        id: 'plan-1',
        userId: 'user-123',
        name: 'My Awesome Plan',
        description: 'A plan to be awesome',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        isActive: true,
        days: [
          {
            id: 'day-1',
            name: 'Day 1',
            description: 'Push',
            orderIndex: 1,
            planId: 'plan-1',
            exercises: [
              {
                id: 'ex-1',
                exerciseId: 'e-1',
                exerciseName: 'Bench',
                exerciseDescription: 'Bench press description',
                orderIndex: 0,
                planDayId: 'day-1',
                sets: [
                  { id: 'set-1a', setIndex: 0, expectedReps: 5, expectedWeight: 100, planExerciseId: 'ex-1' },
                ],
              },
            ],
          },
          {
            id: 'day-0',
            name: 'Day 0',
            description: 'Pull',
            orderIndex: 0,
            planId: 'plan-1',
            exercises: [],
          },
        ],
        progressions: [
          {
            id: 'prog-1',
            planId: 'plan-1',
            exerciseId: 'e-1',
            exerciseName: 'Bench Press',
            weightIncrement: 5,
            failureCountForDeload: 3,
            deloadPercentage: 20,
            deloadStrategy: 'PERCENTAGE',
            consecutiveFailures: 0,
            referenceSetIndex: 0,
            lastUpdated: new Date('2023-01-01T00:00:00.000Z'),
          },
        ],
      };

      const fixedDate = new Date('2024-01-01T10:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => fixedDate as Date);

      const result = mapToPlanDto(viewModelPlan);
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
              "plan_id": "plan-1",
            },
            {
              "description": "Push",
              "exercises": [
                {
                  "exercise_id": "e-1",
                  "id": "ex-1",
                  "order_index": 0,
                  "plan_day_id": "day-1",
                  "sets": [
                    {
                      "expected_reps": 5,
                      "expected_weight": 100,
                      "id": "set-1a",
                      "plan_exercise_id": "ex-1",
                      "set_index": 0,
                    },
                  ],
                },
              ],
              "id": "day-1",
              "name": "Day 1",
              "order_index": 1,
              "plan_id": "plan-1",
            },
          ],
          "description": "A plan to be awesome",
          "id": "plan-1",
          "name": "My Awesome Plan",
          "progressions": [
            {
              "consecutive_failures": 0,
              "deload_percentage": 20,
              "deload_strategy": "PERCENTAGE",
              "exercise_id": "e-1",
              "failure_count_for_deload": 3,
              "id": "prog-1",
              "last_updated": "2023-01-01T00:00:00.000Z",
              "plan_id": "plan-1",
              "reference_set_index": 0,
              "weight_increment": 5,
            },
          ],
          "user_id": "user-123",
        }
      `);

      expect(result.days![0].id).toBe('day-0');
      expect(result.days![1].id).toBe('day-1');

      vi.restoreAllMocks();
    });

    it('should use current date for created_at if viewModel.createdAt is null', () => {
      const viewModelPlan: PlanViewModel = {
        id: 'plan-2',
        userId: 'user-456',
        name: 'Plan with null createdAt',
        description: null,
        createdAt: null,
        isActive: false,
        days: [],
        progressions: [],
      };

      const mockDate = new Date('2023-03-15T12:30:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as Date);

      const result = mapToPlanDto(viewModelPlan);
      expect(result.created_at).toBe('2023-03-15T12:30:00.000Z');
      expect(result).toMatchInlineSnapshot(`
        {
          "created_at": "2023-03-15T12:30:00.000Z",
          "days": [],
          "description": null,
          "id": "plan-2",
          "name": "Plan with null createdAt",
          "progressions": [],
          "user_id": "user-456",
        }
      `);
      vi.restoreAllMocks();
    });

    it('should handle empty days array', () => {
      const viewModelPlan: PlanViewModel = {
        id: 'plan-no-days',
        userId: 'user-789',
        name: 'Plan without days',
        description: 'empty',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        isActive: true,
        days: [],
        progressions: [],
      };
      const result = mapToPlanDto(viewModelPlan);
      expect(result.days).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "created_at": "2023-01-01T00:00:00.000Z",
          "days": [],
          "description": "empty",
          "id": "plan-no-days",
          "name": "Plan without days",
          "progressions": [],
          "user_id": "user-789",
        }
      `);
    });

    it('should handle null days property', () => {
      const viewModelPlan: PlanViewModel = {
        id: 'plan-null-days',
        userId: 'user-abc',
        name: 'Plan with null days',
        description: 'also empty',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        isActive: false,
        days: null!,
        progressions: [],
      };
      const result = mapToPlanDto(viewModelPlan);
      expect(result.days).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "created_at": "2023-01-01T00:00:00.000Z",
          "days": [],
          "description": "also empty",
          "id": "plan-null-days",
          "name": "Plan with null days",
          "progressions": [],
          "user_id": "user-abc",
        }
      `);
    });

    it('should handle empty progressions array', () => {
      const viewModelPlan: PlanViewModel = {
        id: 'plan-no-progressions',
        userId: 'user-abc',
        name: 'Plan with no progressions',
        description: 'empty',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        isActive: false,
        days: null!,
        progressions: []!,
      };

      const result = mapToPlanDto(viewModelPlan);
      expect(result.progressions).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "created_at": "2023-01-01T00:00:00.000Z",
          "days": [],
          "description": "empty",
          "id": "plan-no-progressions",
          "name": "Plan with no progressions",
          "progressions": [],
          "user_id": "user-abc",
        }
      `);
    });

    it('should handle null progressions array', () => {
      const viewModelPlan: PlanViewModel = {
        id: 'plan-null-progressions',
        userId: 'user-abc',
        name: 'Plan with null progressions',
        description: 'also empty',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        isActive: false,
        days: null!,
        progressions: null!,
      };

      const result = mapToPlanDto(viewModelPlan);
      expect(result.progressions).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "created_at": "2023-01-01T00:00:00.000Z",
          "days": [],
          "description": "also empty",
          "id": "plan-null-progressions",
          "name": "Plan with null progressions",
          "progressions": [],
          "user_id": "user-abc",
        }
      `);
    });
  });

  describe('mapToPlanDayDto', () => {
    it('should throw an error if the day ViewModel is null or undefined', () => {
      expect(() => mapToPlanDayDto(null!)).toThrowError('Plan day ViewModel is required');
      expect(() => mapToPlanDayDto(undefined!)).toThrowError('Plan day ViewModel is required');
    });

    it('should correctly map PlanDayViewModel to PlanDayDto', () => {
      const viewModelDay: PlanDayViewModel = {
        id: 'day-1',
        name: 'Push Day',
        description: 'Chest, Shoulders, Triceps',
        orderIndex: 0,
        planId: 'tp-1',
        exercises: [
          {
            id: 'ex-1',
            exerciseId: 'e-1',
            exerciseName: 'Bench Press',
            exerciseDescription: 'Bench press description',
            orderIndex: 1,
            planDayId: 'day-1',
            sets: [
              { id: 'set-1a', setIndex: 0, expectedReps: 8, expectedWeight: 60, planExerciseId: 'ex-1' },
            ],
          },
          {
            id: 'ex-0',
            exerciseId: 'e-0',
            exerciseName: 'Overhead Press',
            exerciseDescription: 'Overhead press description',
            orderIndex: 0,
            planDayId: 'day-1',
            sets: [
              { id: 'set-0a', setIndex: 0, expectedReps: 10, expectedWeight: 40, planExerciseId: 'ex-0' },
            ],
          },
        ],
      };
      const result = mapToPlanDayDto(viewModelDay);
      expect(result).toMatchInlineSnapshot(`
        {
          "description": "Chest, Shoulders, Triceps",
          "exercises": [
            {
              "exercise_id": "e-0",
              "id": "ex-0",
              "order_index": 0,
              "plan_day_id": "day-1",
              "sets": [
                {
                  "expected_reps": 10,
                  "expected_weight": 40,
                  "id": "set-0a",
                  "plan_exercise_id": "ex-0",
                  "set_index": 0,
                },
              ],
            },
            {
              "exercise_id": "e-1",
              "id": "ex-1",
              "order_index": 1,
              "plan_day_id": "day-1",
              "sets": [
                {
                  "expected_reps": 8,
                  "expected_weight": 60,
                  "id": "set-1a",
                  "plan_exercise_id": "ex-1",
                  "set_index": 0,
                },
              ],
            },
          ],
          "id": "day-1",
          "name": "Push Day",
          "order_index": 0,
          "plan_id": "tp-1",
        }
      `);

      expect(result.exercises![0].id).toBe('ex-0');
      expect(result.exercises![1].id).toBe('ex-1');
    });

    it('should handle empty exercises array', () => {
      const viewModelDay: PlanDayViewModel = {
        id: 'day-2',
        name: 'Rest Day',
        description: null,
        orderIndex: 1,
        planId: 'tp-1',
        exercises: [],
      };
      const result = mapToPlanDayDto(viewModelDay);
      expect(result.exercises).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "description": null,
          "exercises": [],
          "id": "day-2",
          "name": "Rest Day",
          "order_index": 1,
          "plan_id": "tp-1",
        }
      `);
    });

    it('should handle null exercises property', () => {
      const viewModelDay: PlanDayViewModel = {
        id: 'day-3',
        name: 'Cardio Day',
        description: 'LISS',
        orderIndex: 2,
        planId: 'tp-1',
        exercises: null!,
      };
      const result = mapToPlanDayDto(viewModelDay);
      expect(result.exercises).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "description": "LISS",
          "exercises": [],
          "id": "day-3",
          "name": "Cardio Day",
          "order_index": 2,
          "plan_id": "tp-1",
        }
      `);
    });
  });

  describe('mapToPlanExerciseDto', () => {
    it('should throw an error if the exercise ViewModel is null or undefined', () => {
      expect(() => mapToPlanExerciseDto(null!)).toThrowError('Plan exercise ViewModel is required');
      expect(() => mapToPlanExerciseDto(undefined!)).toThrowError('Plan exercise ViewModel is required');
    });

    it('should correctly map PlanExerciseViewModel to PlanExerciseDto', () => {
      const viewModelExercise: PlanExerciseViewModel = {
        id: 'ex-1',
        exerciseId: 'e-1',
        exerciseName: 'Bench Press',
        exerciseDescription: 'Bench press description',
        orderIndex: 0,
        planDayId: 'tpd-1',
        sets: [
          { id: 'set-1', setIndex: 1, expectedReps: 10, expectedWeight: 50, planExerciseId: 'ex-1' },
          { id: 'set-0', setIndex: 0, expectedReps: 12, expectedWeight: 40, planExerciseId: 'ex-1' },
        ],
      };
      const result = mapToPlanExerciseDto(viewModelExercise);
      expect(result).toMatchInlineSnapshot(`
        {
          "exercise_id": "e-1",
          "id": "ex-1",
          "order_index": 0,
          "plan_day_id": "tpd-1",
          "sets": [
            {
              "expected_reps": 12,
              "expected_weight": 40,
              "id": "set-0",
              "plan_exercise_id": "ex-1",
              "set_index": 0,
            },
            {
              "expected_reps": 10,
              "expected_weight": 50,
              "id": "set-1",
              "plan_exercise_id": "ex-1",
              "set_index": 1,
            },
          ],
        }
      `);

      expect(result.sets![0].id).toBe('set-0');
      expect(result.sets![1].id).toBe('set-1');
    });

    it('should handle empty sets array', () => {
      const viewModelExercise: PlanExerciseViewModel = {
        id: 'ex-2',
        exerciseId: 'e-2',
        exerciseName: 'Squats',
        exerciseDescription: 'Squats description',
        orderIndex: 1,
        planDayId: 'tpd-1',
        sets: [],
      };
      const result = mapToPlanExerciseDto(viewModelExercise);
      expect(result.sets).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "exercise_id": "e-2",
          "id": "ex-2",
          "order_index": 1,
          "plan_day_id": "tpd-1",
          "sets": [],
        }
      `);
    });

    it('should handle null sets property', () => {
      const viewModelExercise: PlanExerciseViewModel = {
        id: 'ex-3',
        exerciseId: 'e-3',
        exerciseName: 'Deadlift',
        exerciseDescription: 'Deadlift description',
        orderIndex: 2,
        planDayId: 'tpd-1',
        sets: null!
      };
      const result = mapToPlanExerciseDto(viewModelExercise);
      expect(result.sets).toEqual([]);
      expect(result).toMatchInlineSnapshot(`
        {
          "exercise_id": "e-3",
          "id": "ex-3",
          "order_index": 2,
          "plan_day_id": "tpd-1",
          "sets": [],
        }
      `);
    });
  });

  describe('mapToPlanExerciseSetDto', () => {
    it('should throw an error if the set ViewModel is null or undefined', () => {
      expect(() => mapToPlanExerciseSetDto(null!)).toThrowError('Plan exercise set ViewModel is required');
      expect(() => mapToPlanExerciseSetDto(undefined!)).toThrowError('Plan exercise set ViewModel is required');
    });

    it('should correctly map PlanExerciseSetViewModel to PlanExerciseSetDto', () => {
      const viewModelSet: PlanExerciseSetViewModel = {
        id: 'set-1',
        setIndex: 1,
        expectedReps: 10,
        expectedWeight: 50,
        planExerciseId: 'tpe-1',
      };
      const result = mapToPlanExerciseSetDto(viewModelSet);
      expect(result).toMatchInlineSnapshot(`
        {
          "expected_reps": 10,
          "expected_weight": 50,
          "id": "set-1",
          "plan_exercise_id": "tpe-1",
          "set_index": 1,
        }
      `);
    });

    it('should default null expectedReps and expectedWeight to 0', () => {
      const viewModelSet: PlanExerciseSetViewModel = {
        id: 'set-2',
        setIndex: 2,
        expectedReps: null,
        expectedWeight: null,
        planExerciseId: 'tpe-1',
      };
      const result = mapToPlanExerciseSetDto(viewModelSet);
      expect(result.expected_reps).toBe(0);
      expect(result.expected_weight).toBe(0);
      expect(result).toMatchInlineSnapshot(`
        {
          "expected_reps": 0,
          "expected_weight": 0,
          "id": "set-2",
          "plan_exercise_id": "tpe-1",
          "set_index": 2,
        }
      `);
    });
  });

  describe('mapToPlanExerciseProgressionDto', () => {
    it('should throw an error if the progression ViewModel is null or undefined', () => {
      expect(() => mapToPlanExerciseProgressionDto(null!)).toThrowError('Plan exercise progression ViewModel is required');
      expect(() => mapToPlanExerciseProgressionDto(undefined!)).toThrowError('Plan exercise progression ViewModel is required');
    });

    it('should correctly map PlanExerciseProgressionViewModel to PlanExerciseProgressionDto', () => {
      const viewModelProgression: PlanExerciseProgressionViewModel = {
        id: 'prog-1',
        planId: 'tp-1',
        exerciseId: 'e-1',
        exerciseName: 'Bench Press',
        weightIncrement: 5,
        failureCountForDeload: 3,
        deloadPercentage: 20,
        deloadStrategy: 'PERCENTAGE',
        consecutiveFailures: 0,
        referenceSetIndex: 0,
        lastUpdated: new Date('2023-01-01T00:00:00.000Z'),
      };
      const result = mapToPlanExerciseProgressionDto(viewModelProgression);
      expect(result).toMatchInlineSnapshot(`
        {
          "consecutive_failures": 0,
          "deload_percentage": 20,
          "deload_strategy": "PERCENTAGE",
          "exercise_id": "e-1",
          "failure_count_for_deload": 3,
          "id": "prog-1",
          "last_updated": "2023-01-01T00:00:00.000Z",
          "plan_id": "tp-1",
          "reference_set_index": 0,
          "weight_increment": 5,
        }
      `);
    });

    it('should use current date for last_updated if viewModel.lastUpdated is null', () => {
      const viewModelProgression: PlanExerciseProgressionViewModel = {
        id: 'prog-1',
        planId: 'tp-1',
        exerciseId: 'e-1',
        exerciseName: 'Bench Press',
        weightIncrement: 5,
        failureCountForDeload: 3,
        deloadPercentage: 20,
        deloadStrategy: 'PERCENTAGE',
        consecutiveFailures: 0,
        referenceSetIndex: 0,
        lastUpdated: null,
      };

      const mockDate = new Date('2023-03-15T12:30:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as Date);

      const result = mapToPlanExerciseProgressionDto(viewModelProgression);
      expect(result.last_updated).toBe('2023-03-15T12:30:00.000Z');

      vi.restoreAllMocks();
    });
  });

  describe('mapToPlanViewModel', () => {
    let mockPlanDto: PlanDto;
    let mockProfileDto: ProfileDto;
    let mockExercises: Pick<ExerciseDto, 'id' | 'name' | 'description'>[];

    beforeEach(() => {
      mockPlanDto = {
        id: 'tp-1',
        user_id: 'user-123',
        name: 'Strength Program',
        description: 'A plan focused on building strength.',
        created_at: new Date().toISOString(),
        progressions: [
          {
            id: 'prog-1',
            plan_id: 'tp-1',
            exercise_id: 'e-1',
            weight_increment: 5,
            failure_count_for_deload: 3,
            deload_percentage: 20,
            deload_strategy: 'PROPORTIONAL',
            consecutive_failures: 0,
            reference_set_index: 0,
            last_updated: new Date().toISOString(),
          } as PlanExerciseProgressionDto,
        ],
        days: [
          {
            id: 'day-1',
            name: 'Push Day',
            description: 'Chest, Shoulders, Triceps',
            order_index: 0,
            plan_id: 'tp-1',
            exercises: [
              {
                id: 'ex-1',
                exercise_id: 'e-1',
                order_index: 0,
                plan_day_id: 'day-1',
                sets: [
                  { id: 'set-1a', set_index: 0, expected_reps: 8, expected_weight: 60, plan_exercise_id: 'ex-1' },
                ],
              },
            ],
          },
        ],
      };
      mockProfileDto = {
        id: 'profile-1',
        first_name: 'Test',
        active_plan_id: 'tp-1',
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
      expect(() => mapToPlanViewModel(null!, mockExercises, null)).toThrowError('Plan DTO is required');
      expect(() => mapToPlanViewModel(undefined!, mockExercises, null)).toThrowError('Plan DTO is required');
    });

    it('should correctly map PlanDto to PlanViewModel', () => {
      const result = mapToPlanViewModel(mockPlanDto, mockExercises, mockProfileDto);
      expect(result.id).toBe('tp-1');
      expect(result.name).toBe('Strength Program');
      expect(result.description).toBe('A plan focused on building strength.');
      expect(result.createdAt).toEqual(new Date(mockPlanDto.created_at!));
      expect(result.isActive).toBe(true);
      expect(result.days).toHaveLength(1);
      expect(result.days[0].name).toBe('Push Day');
      expect(result.days[0].exercises[0].exerciseName).toBe('Bench Press');
    });

    it('should set isActive to false if profile is null', () => {
      const result = mapToPlanViewModel(mockPlanDto, mockExercises, null);
      expect(result.isActive).toBe(false);
    });

    it('should set isActive to false if active_plan_id does not match', () => {
      const nonActiveProfile: ProfileDto = { ...mockProfileDto, active_plan_id: 'tp-other' };
      const result = mapToPlanViewModel(mockPlanDto, mockExercises, nonActiveProfile);
      expect(result.isActive).toBe(false);
    });

    it('should set isActive to false if active_plan_id is null in profile', () => {
      const profileWithNullActivePlan: ProfileDto = { ...mockProfileDto, active_plan_id: null };
      const result = mapToPlanViewModel(mockPlanDto, mockExercises, profileWithNullActivePlan);
      expect(result.isActive).toBe(false);
    });

    it('should handle null or empty days array', () => {
      const dtoNoDays: PlanDto = { ...mockPlanDto, days: [] };
      let result = mapToPlanViewModel(dtoNoDays, mockExercises, mockProfileDto);
      expect(result.days).toEqual([]);

      const dtoNullDays: PlanDto = { ...mockPlanDto, days: null! };
      result = mapToPlanViewModel(dtoNullDays, mockExercises, mockProfileDto);
      expect(result.days).toEqual([]);
    });

    it('should sort days and exercises by orderIndex', () => {
      const unsortedDto: PlanDto = {
        ...mockPlanDto,
        id: 'tp-unsorted',
        days: [
          { id: 'day-2', name: 'Day B', description: null, order_index: 1, plan_id: 'tp-unsorted', exercises: [
            { id: 'ex-b2', exercise_id: 'e-b2', order_index: 1, plan_day_id: 'day-2', sets: [] },
            { id: 'ex-b1', exercise_id: 'e-b1', order_index: 0, plan_day_id: 'day-2', sets: [] },
          ]},
          { id: 'day-1', name: 'Day A', description: null, order_index: 0, plan_id: 'tp-unsorted', exercises: [
            { id: 'ex-a2', exercise_id: 'e-a2', order_index: 1, plan_day_id: 'day-1', sets: [] },
            { id: 'ex-a1', exercise_id: 'e-a1', order_index: 0, plan_day_id: 'day-1', sets: [] },
          ]},
        ],
      };
      const result = mapToPlanViewModel(unsortedDto, mockExercises, mockProfileDto);
      expect(result.days[0].id).toBe('day-1');
      expect(result.days[1].id).toBe('day-2');
      expect(result.days[0].exercises[0].id).toBe('ex-a1');
      expect(result.days[0].exercises[1].id).toBe('ex-a2');
      expect(result.days[1].exercises[0].id).toBe('ex-b1');
      expect(result.days[1].exercises[1].id).toBe('ex-b2');
    });

    it('should use "Unknown Exercise" if matching exercise is not found', () => {
      const dtoWithUnknownExercise: PlanDto = {
        ...mockPlanDto,
        days: [
          {
            ...mockPlanDto.days![0],
            exercises: [
              {
                ...mockPlanDto.days![0].exercises![0],
                exercise_id: 'e-unknown',
              },
            ],
          },
        ],
      };
      const result = mapToPlanViewModel(dtoWithUnknownExercise, mockExercises, mockProfileDto);
      expect(result.days[0].exercises[0].exerciseName).toBe('Unknown Exercise');
    });

    it('should correctly map exercise progressions from DTO to ViewModel', () => {
      const result = mapToPlanViewModel(mockPlanDto, mockExercises, mockProfileDto);
      expect(result.progressions).toBeDefined();
      expect(result.progressions).toHaveLength(1);
      expect(result.progressions[0].id).toBe('prog-1');
      expect(result.progressions[0].exerciseName).toBe('Bench Press');
      expect(result.progressions[0].weightIncrement).toBe(5);
      expect(result.progressions[0].lastUpdated).toEqual(new Date(mockPlanDto.progressions![0].last_updated!));
    });

    it('should use "Unknown Exercise" for progression if matching exercise is not found', () => {
      const dtoWithUnknownExerciseProgression = {
        ...mockPlanDto,
        progressions: [
          {
            ...mockPlanDto.progressions![0],
            exercise_id: 'e-unknown',
          },
        ],
      };
      const result = mapToPlanViewModel(dtoWithUnknownExerciseProgression, mockExercises, mockProfileDto);
      expect(result.progressions[0].exerciseName).toBe('Unknown Exercise');
    });

    it('should handle null or empty exercise_progressions array', () => {
      const dtoNoProgressions: PlanDto = { ...mockPlanDto, progressions: [] };
      let result = mapToPlanViewModel(dtoNoProgressions, mockExercises, mockProfileDto);
      expect(result.progressions).toEqual([]);

      const dtoNullProgressions: PlanDto = { ...mockPlanDto, progressions: null! };
      result = mapToPlanViewModel(dtoNullProgressions, mockExercises, mockProfileDto);
      expect(result.progressions).toEqual([]);
    });
  });

  describe('Round-trip mapping integrity', () => {
    let mockProfileDto: ProfileDto;
    let mockExercises: Pick<ExerciseDto, 'id' | 'name' | 'description'>[];
    let mockDto: PlanDto;
    let mockViewModel: PlanViewModel;

    beforeEach(() => {
      mockProfileDto = {
        id: 'profile-common',
        first_name: 'CommonUser',
        active_plan_id: 'tp-vm-rt',
        created_at: new Date('2023-01-01T00:00:00.000Z').toISOString(),
        updated_at: new Date('2023-01-01T00:00:00.000Z').toISOString(),
        ai_suggestions_remaining: 10
      };

      mockExercises = [
        { id: 'e-rt-dto1', name: 'Exercise e-rt-dto1', description: 'DTO exercise description'},
        { id: 'e-vm-rt1', name: 'VM RT Exercise 1', description: 'VM exercise description'},
      ];

      mockDto = {
        id: 'base-dto-id',
        user_id: 'user-rt-dto',
        name: 'DTO Round Trip Plan',
        description: 'Full description for DTO round trip.',
        created_at: new Date('2023-01-01T12:00:00.000Z').toISOString(),
        progressions: [
          {
            id: 'prog-rt-dto1',
            plan_id: 'base-dto-id',
            exercise_id: 'e-rt-dto1',
            weight_increment: 2.5,
            failure_count_for_deload: 2,
            deload_percentage: 10,
            deload_strategy: 'PROPORTIONAL',
            consecutive_failures: 1,
            reference_set_index: 0,
            last_updated: new Date('2023-01-01T12:00:00.000Z').toISOString(),
          } as PlanExerciseProgressionDto,
        ],
        days: [
          {
            id: 'day-rt-dto1',
            name: 'RT Day DTO1',
            description: 'RT Day DTO1 Desc',
            order_index: 0,
            plan_id: 'base-dto-id',
            exercises: [
              {
                id: 'ex-rt-dto1a',
                exercise_id: 'e-rt-dto1',
                order_index: 0,
                plan_day_id: 'day-rt-dto1',
                sets: [
                  { id: 'set-rt-dto1a1', set_index: 0, expected_reps: 5, expected_weight: 100, plan_exercise_id: 'ex-rt-dto1a' },
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
        createdAt: new Date('2023-02-01T10:00:00.000Z'),
        isActive: true,
        progressions: [
          {
            id: 'prog-vm-rt1',
            planId: 'tp-vm-rt',
            exerciseId: 'e-vm-rt1',
            exerciseName: 'VM RT Exercise 1',
            weightIncrement: 5,
            failureCountForDeload: 3,
            deloadPercentage: 15,
            deloadStrategy: 'STRATEGY_B',
            consecutiveFailures: 0,
            referenceSetIndex: 1,
            lastUpdated: new Date('2023-02-01T10:00:00.000Z'),
          },
        ],
        days: [
          {
            id: 'day-vm-rt1',
            name: 'VM RT Day 1',
            description: 'RT Day 1 Desc',
            orderIndex: 0,
            planId: 'tp-vm-rt',
            exercises: [
              {
                id: 'ex-vm-rt1a',
                exerciseId: 'e-vm-rt1',
                exerciseName: 'VM RT Exercise 1',
                exerciseDescription: 'VM exercise description',
                orderIndex: 0,
                planDayId: 'day-vm-rt1',
                sets: [
                  { id: 'set-vm-rt1a1', setIndex: 0, expectedReps: 8, expectedWeight: 80, planExerciseId: 'ex-vm-rt1a' },
                ],
              },
            ],
          },
        ],
      };
    });

    it('DTO -> ViewModel -> DTO: should maintain data integrity', () => {
      const intermediateViewModel = mapToPlanViewModel(mockDto, mockExercises, mockProfileDto);
      const finalDto = mapToPlanDto(intermediateViewModel);

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
        expect(dayDto.plan_id).toBe(originalDayDto.plan_id);

        expect(dayDto.exercises).toHaveLength(originalDayDto.exercises!.length);
        dayDto.exercises?.forEach((exDto, exIndex) => {
          const originalExDto = originalDayDto.exercises![exIndex];
          expect(exDto.id).toBe(originalExDto.id);
          expect(exDto.exercise_id).toBe(originalExDto.exercise_id);
          expect(exDto.order_index).toBe(originalExDto.order_index);
          expect(exDto.plan_day_id).toBe(originalExDto.plan_day_id);

          expect(exDto.sets).toHaveLength(originalExDto.sets!.length);
          exDto.sets?.forEach((setDto, setIndex) => {
            const originalSetDto = originalExDto.sets![setIndex];
            expect(setDto.id).toBe(originalSetDto.id);
            expect(setDto.set_index).toBe(originalSetDto.set_index);
            expect(setDto.expected_weight).toBe(originalSetDto.expected_weight);
            expect(setDto.expected_reps).toBe(originalSetDto.expected_reps);
            expect(setDto.plan_exercise_id).toBe(originalSetDto.plan_exercise_id);
          });
        });
      });

      expect(finalDto.progressions).toHaveLength(mockDto.progressions!.length);
      finalDto.progressions?.forEach((progDto, progIndex) => {
        const originalProgDto = mockDto.progressions![progIndex];
        expect(progDto.id).toBe(originalProgDto.id);
        expect(progDto.plan_id).toBe(originalProgDto.plan_id);
        expect(progDto.exercise_id).toBe(originalProgDto.exercise_id);
        expect(progDto.weight_increment).toBe(originalProgDto.weight_increment);
        expect(progDto.last_updated).toBe(originalProgDto.last_updated);
      });
    });

    it('ViewModel -> DTO -> ViewModel: should maintain data integrity', () => {
      const intermediateDto = mapToPlanDto(mockViewModel);
      const finalViewModel = mapToPlanViewModel(intermediateDto, mockExercises, mockProfileDto);

      expect(finalViewModel.id).toBe(mockViewModel.id);
      expect(finalViewModel.userId).toBe(mockViewModel.userId);
      expect(finalViewModel.name).toBe(mockViewModel.name);
      expect(finalViewModel.description).toBe(mockViewModel.description);
      expect(finalViewModel.createdAt).toEqual(mockViewModel.createdAt);
      expect(finalViewModel.isActive).toBe(mockViewModel.isActive);

      expect(finalViewModel.days).toHaveLength(mockViewModel.days.length);
      finalViewModel.days.forEach((dayVm, dayIndex) => {
        const originalDayVm = mockViewModel.days[dayIndex];
        expect(dayVm.id).toBe(originalDayVm.id);
        expect(dayVm.name).toBe(originalDayVm.name);
        expect(dayVm.description).toBe(originalDayVm.description);
        expect(dayVm.orderIndex).toBe(originalDayVm.orderIndex);
        expect(dayVm.planId).toBe(originalDayVm.planId);

        expect(dayVm.exercises).toHaveLength(originalDayVm.exercises.length);
        dayVm.exercises.forEach((exVm, exIndex) => {
          const originalExVm = originalDayVm.exercises[exIndex];
          expect(exVm.id).toBe(originalExVm.id);
          expect(exVm.exerciseId).toBe(originalExVm.exerciseId);
          expect(exVm.exerciseName).toBe(originalExVm.exerciseName);
          expect(exVm.exerciseDescription).toBe(originalExVm.exerciseDescription);
          expect(exVm.orderIndex).toBe(originalExVm.orderIndex);
          expect(exVm.planDayId).toBe(originalExVm.planDayId);

          expect(exVm.sets).toHaveLength(originalExVm.sets.length);
          exVm.sets.forEach((setVm, setIndex) => {
            const originalSetVm = originalExVm.sets[setIndex];
            expect(setVm.id).toBe(originalSetVm.id);
            expect(setVm.setIndex).toBe(originalSetVm.setIndex);
            expect(setVm.expectedReps).toBe(originalSetVm.expectedReps);
            expect(setVm.expectedWeight).toBe(originalSetVm.expectedWeight);
            expect(setVm.planExerciseId).toBe(originalSetVm.planExerciseId);
          });
        });
      });

      expect(finalViewModel.progressions).toHaveLength(mockViewModel.progressions.length);
      finalViewModel.progressions.forEach((progVm, progIndex) => {
        const originalProgVm = mockViewModel.progressions[progIndex];
        expect(progVm.id).toBe(originalProgVm.id);
        expect(progVm.planId).toBe(originalProgVm.planId);
        expect(progVm.exerciseId).toBe(originalProgVm.exerciseId);
        expect(progVm.exerciseName).toBe(originalProgVm.exerciseName);
        expect(progVm.weightIncrement).toBe(originalProgVm.weightIncrement);
        expect(progVm.lastUpdated).toEqual(originalProgVm.lastUpdated);
      });
    });
  });
});
