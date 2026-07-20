import type { SessionSetDto } from '@txg/shared';
import { describe, it, expect } from 'vitest';
import {
  assertSessionCompletable,
  extractPlanExercises,
  extractSessionSetContext,
  skipPendingSets
} from './session-completion';
import type { PlanDayWithExercisesRow, SessionSetWithExerciseRow } from './session-completion';

const SQUAT_ID = 'exercise-squat';
const BENCH_ID = 'exercise-bench';

function makeSet(overrides: Partial<SessionSetDto> = {}): SessionSetDto {
  return {
    id: 'set-1',
    session_id: 'session-1',
    plan_exercise_id: 'plan-exercise-1',
    set_index: 1,
    expected_reps: 5,
    actual_reps: 5,
    actual_weight: 100,
    status: 'COMPLETED',
    completed_at: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('assertSessionCompletable', () => {
  it('should accept a session that is in progress and has a plan', () => {
    expect(() => assertSessionCompletable({ status: 'IN_PROGRESS', plan_id: 'plan-1' })).not.toThrow();
  });

  it.each(['PENDING', 'COMPLETED', 'CANCELLED'] as const)(
    'should reject a session whose status is %s',
    (status) => {
      expect(() => assertSessionCompletable({ status, plan_id: 'plan-1' }))
        .toThrow(`Session cannot be completed. Current status: ${status}. Expected: IN_PROGRESS.`);
    }
  );

  it('should reject a session with no plan, as progressions cannot be calculated', () => {
    expect(() => assertSessionCompletable({ status: 'IN_PROGRESS', plan_id: null as unknown as string }))
      .toThrow('Plan ID missing from the session. Cannot calculate progressions.');
  });
});

describe('extractSessionSetContext', () => {
  it('should strip the embedded relation off the sets', () => {
    const rows = [
      { ...makeSet(), plan_exercises: { exercises: { id: SQUAT_ID } } },
    ] as SessionSetWithExerciseRow[];

    const { sessionSets } = extractSessionSetContext(rows);

    expect(sessionSets).toEqual([makeSet()]);
    expect(sessionSets[0]).not.toHaveProperty('plan_exercises');
  });

  it('should collect the unique exercise ids the session trained', () => {
    const rows = [
      { ...makeSet({ id: 'set-1' }), plan_exercises: { exercises: { id: SQUAT_ID } } },
      { ...makeSet({ id: 'set-2' }), plan_exercises: { exercises: { id: SQUAT_ID } } },
      { ...makeSet({ id: 'set-3' }), plan_exercises: { exercises: { id: BENCH_ID } } },
    ] as SessionSetWithExerciseRow[];

    const { exerciseIds } = extractSessionSetContext(rows);

    expect(exerciseIds).toEqual([SQUAT_ID, BENCH_ID]);
  });

  it('should read an embed that arrives as an array just like a to-one object', () => {
    const rows = [
      { ...makeSet(), plan_exercises: [{ exercises: [{ id: SQUAT_ID }] }] },
    ] as unknown as SessionSetWithExerciseRow[];

    const { exerciseIds } = extractSessionSetContext(rows);

    expect(exerciseIds).toEqual([SQUAT_ID]);
  });

  it('should tolerate a missing embed rather than throwing', () => {
    const rows = [
      { ...makeSet(), plan_exercises: null },
    ] as SessionSetWithExerciseRow[];

    const { sessionSets, exerciseIds } = extractSessionSetContext(rows);

    expect(sessionSets).toHaveLength(1);
    expect(exerciseIds).toEqual([]);
  });

  it('should return empty results for no rows', () => {
    expect(extractSessionSetContext([])).toEqual({ sessionSets: [], exerciseIds: [] });
  });
});

describe('extractPlanExercises', () => {
  it('should flatten the days into plan exercises', () => {
    const rows = [
      {
        exercises: [
          { id: 'pe-1', plan_day_id: 'day-1', exercise_id: SQUAT_ID, order_index: 1 },
        ],
      },
    ] as unknown as PlanDayWithExercisesRow[];

    expect(extractPlanExercises(rows)).toEqual([{ id: 'pe-1', plan_day_id: 'day-1', exercise_id: SQUAT_ID, order_index: 1 }]);
  });

  it('should de-duplicate an exercise that the join repeats across days', () => {
    const squat = { id: 'pe-1', plan_day_id: 'day-1', exercise_id: SQUAT_ID, order_index: 1 };
    const rows = [
      { exercises: [squat] },
      { exercises: [squat] },
    ] as unknown as PlanDayWithExercisesRow[];

    expect(extractPlanExercises(rows)).toHaveLength(1);
  });

  it('should read an embed that arrives as a single object just like an array', () => {
    const rows = [
      { exercises: { id: 'pe-1', plan_day_id: 'day-1', exercise_id: SQUAT_ID, order_index: 1 } },
    ] as unknown as PlanDayWithExercisesRow[];

    expect(extractPlanExercises(rows).map(e => e.id)).toEqual(['pe-1']);
  });

  it('should tolerate a day with no exercises', () => {
    const rows = [{ exercises: null }] as unknown as PlanDayWithExercisesRow[];

    expect(extractPlanExercises(rows)).toEqual([]);
  });

  it('should return empty results for no rows', () => {
    expect(extractPlanExercises([])).toEqual([]);
  });
});

describe('skipPendingSets', () => {
  it('should mark every pending set as skipped', () => {
    const sets = [
      makeSet({ id: 'set-1', status: 'PENDING' }),
      makeSet({ id: 'set-2', status: 'PENDING' }),
    ];

    const result = skipPendingSets(sets);

    expect(result.map(s => s.id)).toEqual(['set-1', 'set-2']);
    expect(result.every(s => s.status === 'SKIPPED')).toBe(true);
  });

  it('should return only the sets that changed', () => {
    const sets = [
      makeSet({ id: 'set-1', status: 'COMPLETED' }),
      makeSet({ id: 'set-2', status: 'FAILED' }),
      makeSet({ id: 'set-3', status: 'PENDING' }),
    ];

    const result = skipPendingSets(sets);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('set-3');
  });

  it('should NOT overwrite the outcome of a set the user already completed or failed', () => {
    const sets = [
      makeSet({ id: 'set-1', status: 'COMPLETED' }),
      makeSet({ id: 'set-2', status: 'FAILED' }),
    ];

    expect(skipPendingSets(sets)).toEqual([]);
  });

  it('should not mutate the input sets', () => {
    const sets = [makeSet({ status: 'PENDING' })];

    skipPendingSets(sets);

    expect(sets[0].status).toBe('PENDING');
  });
});
