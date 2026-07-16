import { ExerciseProgressDto, PlanDto } from '@txg/shared';
import { describe, expect, it } from 'vitest';
import { SERIES_COLOR_TOKENS, formatRepsLabel, mapToExerciseSeriesViewModels } from './progress.mapping';

const PLANS = [
  { id: 'plan-1', name: 'Starting Strength' },
  { id: 'plan-2', name: 'Texas Method' },
] as PlanDto[];

function makeDto(overrides: Partial<ExerciseProgressDto> = {}): ExerciseProgressDto {
  return {
    exercise_id: 'ex-1',
    exercise_name: 'Squat',
    points: [
      { session_id: 's-1', session_date: '2026-06-01T10:00:00.000Z', plan_id: 'plan-1', top_weight: 100, reps: [5, 5, 5] },
    ],
    ...overrides,
  };
}

describe('formatRepsLabel', () => {
  it('should collapse a uniform session to sets x reps', () => {
    expect(formatRepsLabel([5, 5, 5, 5, 5])).toBe('5x5');
  });

  it('should list each set when the reps differ', () => {
    expect(formatRepsLabel([5, 5, 4, 0, 0])).toBe('5/5/4/0/0');
  });

  it('should handle a single set', () => {
    expect(formatRepsLabel([5])).toBe('1x5');
  });

  it('should return an empty label for no sets', () => {
    expect(formatRepsLabel([])).toBe('');
  });
});

describe('mapToExerciseSeriesViewModels', () => {
  it('should map DTO fields onto the series view model', () => {
    const result = mapToExerciseSeriesViewModels([makeDto()], PLANS, () => true);

    expect(result).toEqual([
      {
        exerciseId: 'ex-1',
        exerciseName: 'Squat',
        colorToken: SERIES_COLOR_TOKENS[0],
        selected: true,
        points: [
          { date: '2026-06-01T10:00:00.000Z', weight: 100, repsLabel: '3x5', planName: 'Starting Strength' },
        ],
      },
    ]);
  });

  it('should assign color tokens by series position and wrap around', () => {
    const dtos = Array.from({ length: SERIES_COLOR_TOKENS.length + 1 }, (_, i) =>
      makeDto({ exercise_id: `ex-${i}`, exercise_name: `Exercise ${i}` })
    );

    const result = mapToExerciseSeriesViewModels(dtos, PLANS, () => true);

    expect(result[0].colorToken).toBe(SERIES_COLOR_TOKENS[0]);
    expect(result[SERIES_COLOR_TOKENS.length].colorToken).toBe(SERIES_COLOR_TOKENS[0]);
  });

  it('should apply the selection predicate per exercise', () => {
    const dtos = [
      makeDto({ exercise_id: 'ex-1' }),
      makeDto({ exercise_id: 'ex-2', exercise_name: 'Bench Press' }),
    ];

    const result = mapToExerciseSeriesViewModels(dtos, PLANS, id => id === 'ex-2');

    expect(result.map(s => s.selected)).toEqual([false, true]);
  });

  it('should fall back to a placeholder plan name for unknown plan ids', () => {
    const dto = makeDto({
      points: [{ session_id: 's-1', session_date: '2026-06-01T10:00:00.000Z', plan_id: 'gone', top_weight: 100, reps: [5] }],
    });

    const result = mapToExerciseSeriesViewModels([dto], PLANS, () => true);

    expect(result[0].points[0].planName).toBe('Unknown plan');
  });
});

describe('mapToExerciseSeriesViewModels ordering', () => {
  function makePlan(id: string, createdAt: string, dayExerciseIds: string[][]): PlanDto {
    return {
      id,
      name: `Plan ${id}`,
      created_at: createdAt,
      days: dayExerciseIds.map((exerciseIds, dayIndex) => ({
        id: `${id}-day-${dayIndex}`,
        order_index: dayIndex,
        exercises: exerciseIds.map((exerciseId, exerciseIndex) => ({
          id: `${id}-day-${dayIndex}-ex-${exerciseIndex}`,
          exercise_id: exerciseId,
          order_index: exerciseIndex,
        })),
      })),
    } as PlanDto;
  }

  // Alphabetical input order, as the API returns it.
  const DTOS = [
    makeDto({ exercise_id: 'ex-bench', exercise_name: 'Bench Press' }),
    makeDto({ exercise_id: 'ex-deadlift', exercise_name: 'Deadlift' }),
    makeDto({ exercise_id: 'ex-squat', exercise_name: 'Squat' }),
  ];

  it('should order series by exercise appearance in the plan', () => {
    const plan = makePlan('plan-1', '2026-01-01T00:00:00.000Z', [['ex-squat', 'ex-bench'], ['ex-deadlift']]);

    const result = mapToExerciseSeriesViewModels(DTOS, [plan], () => true);

    expect(result.map(s => s.exerciseId)).toEqual(['ex-squat', 'ex-bench', 'ex-deadlift']);
  });

  it('should rank exercises of an older plan before those of a newer one', () => {
    const newer = makePlan('plan-newer', '2026-05-01T00:00:00.000Z', [['ex-deadlift', 'ex-squat']]);
    const older = makePlan('plan-older', '2026-01-01T00:00:00.000Z', [['ex-squat', 'ex-bench']]);

    const result = mapToExerciseSeriesViewModels(DTOS, [newer, older], () => true);

    expect(result.map(s => s.exerciseId)).toEqual(['ex-squat', 'ex-bench', 'ex-deadlift']);
  });

  it('should keep exercises absent from every plan last, in API order', () => {
    const plan = makePlan('plan-1', '2026-01-01T00:00:00.000Z', [['ex-squat']]);

    const result = mapToExerciseSeriesViewModels(DTOS, [plan], () => true);

    expect(result.map(s => s.exerciseId)).toEqual(['ex-squat', 'ex-bench', 'ex-deadlift']);
  });

  it('should scope the appearance order to the selected plan when one is set', () => {
    const older = makePlan('plan-older', '2026-01-01T00:00:00.000Z', [['ex-squat', 'ex-bench']]);
    const newer = makePlan('plan-newer', '2026-05-01T00:00:00.000Z', [['ex-deadlift', 'ex-squat']]);

    const result = mapToExerciseSeriesViewModels(DTOS, [older, newer], () => true, 'plan-newer');

    expect(result.map(s => s.exerciseId)).toEqual(['ex-deadlift', 'ex-squat', 'ex-bench']);
  });

  it('should assign color tokens by the sorted position', () => {
    const plan = makePlan('plan-1', '2026-01-01T00:00:00.000Z', [['ex-squat', 'ex-bench'], ['ex-deadlift']]);

    const result = mapToExerciseSeriesViewModels(DTOS, [plan], () => true);

    expect(result.map(s => s.colorToken)).toEqual([SERIES_COLOR_TOKENS[0], SERIES_COLOR_TOKENS[1], SERIES_COLOR_TOKENS[2]]);
  });
});
