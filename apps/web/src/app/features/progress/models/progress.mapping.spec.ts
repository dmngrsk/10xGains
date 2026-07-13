import { ExerciseProgressDto, PlanDto } from '@txg/shared';
import { describe, expect, it } from 'vitest';
import { SERIES_COLOR_TOKENS, formatRepsLabel, mapToExerciseSeriesViewModels, presetToDateFrom } from './progress.mapping';

const NOW = new Date('2026-07-13T12:00:00.000Z');

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

describe('presetToDateFrom', () => {
  it.each([
    { preset: '3M', months: 3 },
    { preset: '6M', months: 6 },
    { preset: '1Y', months: 12 },
  ] as const)('should subtract the preset length for $preset', ({ preset, months }) => {
    const result = new Date(presetToDateFrom(preset, NOW)!);

    const expected = new Date(NOW);
    expected.setMonth(expected.getMonth() - months);

    // Local-time month arithmetic may shift the UTC hour across DST boundaries.
    const dstToleranceMs = 2 * 60 * 60 * 1000;
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThanOrEqual(dstToleranceMs);
  });

  it('should return undefined for ALL, meaning no lower bound', () => {
    expect(presetToDateFrom('ALL', NOW)).toBeUndefined();
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
