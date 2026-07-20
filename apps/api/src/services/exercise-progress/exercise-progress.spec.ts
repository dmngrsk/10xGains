import { describe, it, expect } from 'vitest';
import { DEFAULT_PROGRESS_WINDOW_MONTHS, aggregateExerciseProgress, resolveProgressWindowStart } from './exercise-progress';
import type { ExerciseProgressRow } from './exercise-progress';

const SQUAT_ID = '2a7b3d4f-0c5e-4f9a-b2c3-d4e5f6a7b8c9';
const BENCH_ID = '1f6a2c3e-9b4d-4e8f-a1b2-c3d4e5f6a7b8';
const PLAN_ID = '7d9e0f1a-2b3c-4d5e-8f90-a1b2c3d4e5f6';
const SESSION_A = 'a9b8c7d6-1234-4abc-9def-567890abcdef';
const SESSION_B = 'b1c2d3e4-5678-4bcd-8ef0-1234567890ab';
const PLAN_EXERCISE_A = 'aaaa1111-2222-4333-8444-555566667777';

function makeRow(overrides: {
  weight: number;
  reps?: number | null;
  setIndex?: number;
  status?: ExerciseProgressRow['status'];
  planExerciseId?: string;
  sessionId?: string;
  sessionDate?: string | null;
  planId?: string;
  exerciseId?: string;
  exerciseName?: string;
}): ExerciseProgressRow {
  return {
    set_index: overrides.setIndex ?? 1,
    status: overrides.status ?? 'COMPLETED',
    actual_weight: overrides.weight,
    actual_reps: overrides.reps === undefined ? 5 : overrides.reps,
    plan_exercise_id: overrides.planExerciseId ?? PLAN_EXERCISE_A,
    session: {
      id: overrides.sessionId ?? SESSION_A,
      session_date: overrides.sessionDate === undefined ? '2026-04-15T17:32:11.000Z' : overrides.sessionDate,
      plan_id: overrides.planId ?? PLAN_ID,
    },
    plan_exercise: {
      exercise_id: overrides.exerciseId ?? SQUAT_ID,
      exercise: {
        id: overrides.exerciseId ?? SQUAT_ID,
        name: overrides.exerciseName ?? 'Squat',
      },
    },
  };
}

describe('aggregateExerciseProgress', () => {
  it('should return an empty array for empty input', () => {
    expect(aggregateExerciseProgress([])).toEqual([]);
  });

  it('should keep the maximum completed weight per exercise and session', () => {
    const rows = [
      makeRow({ weight: 100, setIndex: 1 }),
      makeRow({ weight: 110, setIndex: 2, reps: 3 }),
      makeRow({ weight: 105, setIndex: 3 }),
    ];

    const result = aggregateExerciseProgress(rows);

    expect(result).toHaveLength(1);
    expect(result[0].points).toHaveLength(1);
    expect(result[0].points[0]).toEqual({
      session_id: SESSION_A,
      session_date: '2026-04-15T17:32:11.000Z',
      plan_id: PLAN_ID,
      top_weight: 110,
      reps: [5, 3, 5],
    });
  });

  it('should report the reps of every set in set order', () => {
    const rows = [
      makeRow({ weight: 100, setIndex: 3, reps: 4, status: 'FAILED' }),
      makeRow({ weight: 100, setIndex: 1, reps: 5 }),
      makeRow({ weight: 100, setIndex: 2, reps: 5 }),
    ];

    const result = aggregateExerciseProgress(rows);

    expect(result[0].points[0].reps).toEqual([5, 5, 4]);
  });

  it('should include failed sets and count unperformed sets as zero reps', () => {
    const rows = [
      makeRow({ weight: 100, setIndex: 1, reps: 5 }),
      makeRow({ weight: 100, setIndex: 2, reps: 5 }),
      makeRow({ weight: 100, setIndex: 3, reps: 4, status: 'FAILED' }),
      makeRow({ weight: 100, setIndex: 4, reps: 0, status: 'FAILED' }),
      makeRow({ weight: 100, setIndex: 5, reps: null, status: 'SKIPPED' }),
    ];

    const result = aggregateExerciseProgress(rows);

    expect(result[0].points[0].reps).toEqual([5, 5, 4, 0, 0]);
    expect(result[0].points[0].top_weight).toBe(100);
  });

  it('should NOT derive the top weight from a failed set that lifted more', () => {
    const rows = [
      makeRow({ weight: 100, setIndex: 1, reps: 5 }),
      makeRow({ weight: 120, setIndex: 2, reps: 1, status: 'FAILED' }),
    ];

    const result = aggregateExerciseProgress(rows);

    expect(result[0].points[0].top_weight).toBe(100);
    expect(result[0].points[0].reps).toEqual([5, 1]);
  });

  it('should produce no point for a session where the exercise has no completed set', () => {
    const rows = [
      makeRow({ weight: 100, setIndex: 1, reps: 0, status: 'FAILED' }),
      makeRow({ weight: 100, setIndex: 2, reps: null, status: 'SKIPPED' }),
    ];

    expect(aggregateExerciseProgress(rows)).toEqual([]);
  });

  it('should break weight ties by the higher rep count, treating null reps as lowest', () => {
    const rows = [
      makeRow({ weight: 100, setIndex: 1, reps: null }),
      makeRow({ weight: 100, setIndex: 2, reps: 5 }),
      makeRow({ weight: 100, setIndex: 3, reps: 3 }),
    ];

    const result = aggregateExerciseProgress(rows);

    expect(result[0].points[0].top_weight).toBe(100);
    expect(result[0].points[0].reps).toEqual([0, 5, 3]);
  });

  it('should produce one point per session, sorted by session date ascending', () => {
    const rows = [
      makeRow({ sessionId: SESSION_B, sessionDate: '2026-04-22T18:01:47.000Z', weight: 105 }),
      makeRow({ sessionId: SESSION_A, sessionDate: '2026-04-15T17:32:11.000Z', weight: 100 }),
    ];

    const result = aggregateExerciseProgress(rows);

    expect(result[0].points.map(p => p.top_weight)).toEqual([100, 105]);
    expect(result[0].points.map(p => p.session_id)).toEqual([SESSION_A, SESSION_B]);
  });

  it('should group rows into separate series per exercise, sorted by exercise name', () => {
    const rows = [
      makeRow({ exerciseId: SQUAT_ID, exerciseName: 'Squat', weight: 100 }),
      makeRow({ exerciseId: BENCH_ID, exerciseName: 'Bench Press', weight: 80 }),
    ];

    const result = aggregateExerciseProgress(rows);

    expect(result.map(s => s.exercise_name)).toEqual(['Bench Press', 'Squat']);
    expect(result.map(s => s.exercise_id)).toEqual([BENCH_ID, SQUAT_ID]);
  });

  it('should skip rows whose session has no date', () => {
    const rows = [
      makeRow({ weight: 100, sessionDate: null }),
      makeRow({ weight: 90, sessionId: SESSION_B, sessionDate: '2026-04-22T18:01:47.000Z' }),
    ];

    const result = aggregateExerciseProgress(rows);

    expect(result[0].points).toHaveLength(1);
    expect(result[0].points[0].top_weight).toBe(90);
  });

  it('should carry the plan id of each point independently', () => {
    const otherPlanId = '9e8d7c6b-5a49-4321-8765-fedcba098765';
    const rows = [
      makeRow({ sessionId: SESSION_A, sessionDate: '2026-04-15T17:32:11.000Z', weight: 100, planId: PLAN_ID }),
      makeRow({ sessionId: SESSION_B, sessionDate: '2026-04-22T18:01:47.000Z', weight: 105, planId: otherPlanId }),
    ];

    const result = aggregateExerciseProgress(rows);

    expect(result[0].points.map(p => p.plan_id)).toEqual([PLAN_ID, otherPlanId]);
  });
});

describe('resolveProgressWindowStart', () => {
  const NOW = new Date('2026-07-20T12:00:00.000Z');

  it('should use the start date the caller asked for', () => {
    expect(resolveProgressWindowStart('2020-01-01T00:00:00.000Z', NOW)).toBe('2020-01-01T00:00:00.000Z');
  });

  it('should default to a bounded window rather than the whole training history', () => {
    // Without a floor the query reads every set of every completed session ever recorded, and
    // aggregates them in the API process - a cost that grows with the age of the account.
    expect(resolveProgressWindowStart(undefined, NOW)).toBe('2025-07-20T12:00:00.000Z');
  });

  it('should place the default window exactly DEFAULT_PROGRESS_WINDOW_MONTHS back', () => {
    const start = new Date(resolveProgressWindowStart(undefined, NOW));
    const monthsBack = (NOW.getUTCFullYear() - start.getUTCFullYear()) * 12 + (NOW.getUTCMonth() - start.getUTCMonth());

    expect(monthsBack).toBe(DEFAULT_PROGRESS_WINDOW_MONTHS);
  });

  it('should roll the year back correctly from early January', () => {
    expect(resolveProgressWindowStart(undefined, new Date('2026-01-05T00:00:00.000Z'))).toBe('2025-01-05T00:00:00.000Z');
  });
});
