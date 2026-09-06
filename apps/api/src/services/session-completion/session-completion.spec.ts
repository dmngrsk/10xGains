import type { SessionSetDto } from '@txg/shared';
import { describe, it, expect } from 'vitest';
import {
  assertSessionCompletable,
  assertSessionEndAfterPreviousSession,
  assertSessionEndNotInFuture,
  extractPlanExercises,
  extractSessionSetContext,
  resolveSessionFinishedAt,
  retimeSessionToEnd,
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
    expected_weight: 100,
    is_prescribed: true,
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

describe('assertSessionEndNotInFuture', () => {
  const NOW = '2026-06-01T20:00:00.000Z';

  it('should accept an end in the past', () => {
    expect(() => assertSessionEndNotInFuture('2026-05-31T19:30:00.000Z', NOW)).not.toThrow();
  });

  it('should tolerate a client clock running a couple of minutes fast', () => {
    expect(() => assertSessionEndNotInFuture('2026-06-01T20:02:00.000Z', NOW)).not.toThrow();
  });

  it('should reject an end beyond the clock-skew allowance', () => {
    expect(() => assertSessionEndNotInFuture('2026-06-01T20:06:00.000Z', NOW))
      .toThrow('A session cannot end in the future.');
  });
});

describe('assertSessionEndAfterPreviousSession', () => {
  const PREVIOUS_END = '2026-06-01T19:30:00.000Z';

  it('should accept a session that starts after the previous one finished', () => {
    expect(() => assertSessionEndAfterPreviousSession('2026-06-02T18:00:00.000Z', PREVIOUS_END)).not.toThrow();
  });

  it('should reject a session back-dated behind a workout already finished on the plan', () => {
    expect(() => assertSessionEndAfterPreviousSession('2026-05-31T18:00:00.000Z', PREVIOUS_END))
      .toThrow('This session would overlap a workout you already finished on this plan. Pick a later time.');
  });

  it('should reject a session that starts while the previous one was still running', () => {
    // Clears a start-to-start check (19:00 is after the previous session's 18:00 start), but the
    // two workouts would overlap.
    expect(() => assertSessionEndAfterPreviousSession('2026-06-01T19:00:00.000Z', PREVIOUS_END))
      .toThrow('This session would overlap a workout you already finished on this plan. Pick a later time.');
  });

  it('should reject an exact tie, which leaves the plan-day rotation to pick arbitrarily', () => {
    expect(() => assertSessionEndAfterPreviousSession(PREVIOUS_END, PREVIOUS_END))
      .toThrow('This session would overlap a workout you already finished on this plan. Pick a later time.');
  });

  it.each([
    ['no retimed date', null, PREVIOUS_END],
    ['no previous session', '2026-06-01T18:00:00.000Z', null],
  ])('should accept when there is %s to compare', (_label, sessionDate, previousEnd) => {
    expect(() => assertSessionEndAfterPreviousSession(sessionDate, previousEnd)).not.toThrow();
  });
});

describe('retimeSessionToEnd', () => {
  const at = (completedAt: string | null, id: string): SessionSetDto =>
    makeSet({ id, completed_at: completedAt, status: completedAt ? 'COMPLETED' : 'PENDING' });

  it('should translate a wholly late-logged session as one block, keeping its intervals', () => {
    const sets = [
      at('2026-06-02T08:00:00.000Z', 'set-1'),
      at('2026-06-02T08:03:00.000Z', 'set-2'),
      at('2026-06-02T08:05:00.000Z', 'set-3'),
    ];

    const result = retimeSessionToEnd('2026-06-02T08:00:00.000Z', sets, '2026-06-01T19:30:00.000Z');

    expect(result.sessionDate).toBe('2026-06-01T19:25:00.000Z');
    expect(result.sets.map(s => s.completed_at)).toEqual([
      '2026-06-01T19:25:00.000Z',
      '2026-06-01T19:28:00.000Z',
      '2026-06-01T19:30:00.000Z',
    ]);
  });

  it('should move only a set marked the next morning, leaving the evening sets alone', () => {
    const sets = [
      at('2026-06-01T18:00:00.000Z', 'set-1'),
      at('2026-06-01T19:25:00.000Z', 'set-2'),
      at('2026-06-02T08:30:00.000Z', 'set-straggler'),
    ];

    const result = retimeSessionToEnd('2026-06-01T18:00:00.000Z', sets, '2026-06-01T19:30:00.000Z');

    expect(result.sessionDate).toBe('2026-06-01T18:00:00.000Z');
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0]!.id).toBe('set-straggler');
    expect(result.sets[0]!.completed_at).toBe('2026-06-01T19:30:00.000Z');
  });

  it('should floor a shifted set at the latest set that stayed, so the recorded order holds', () => {
    const sets = [
      at('2026-06-01T19:25:00.000Z', 'set-kept'),
      at('2026-06-02T08:00:00.000Z', 'set-early-late'),
      at('2026-06-02T08:30:00.000Z', 'set-last'),
    ];

    const result = retimeSessionToEnd('2026-06-01T19:00:00.000Z', sets, '2026-06-01T19:30:00.000Z');

    // Shifted by -13h the first would land at 19:00, before the set that stayed at 19:25.
    expect(result.sets.map(s => [s.id, s.completed_at])).toEqual([
      ['set-early-late', '2026-06-01T19:25:00.000Z'],
      ['set-last', '2026-06-01T19:30:00.000Z'],
    ]);
  });

  it('should move nothing when the chosen end is already after everything recorded', () => {
    const sets = [at('2026-06-01T19:25:00.000Z', 'set-1')];

    const result = retimeSessionToEnd('2026-06-01T18:00:00.000Z', sets, '2026-06-01T19:30:00.000Z');

    expect(result).toEqual({ sessionDate: '2026-06-01T18:00:00.000Z', sets: [] });
  });

  it('should leave sets that carry no timestamp untouched', () => {
    const sets = [at('2026-06-02T08:30:00.000Z', 'set-1'), at(null, 'set-pending')];

    const result = retimeSessionToEnd('2026-06-02T08:00:00.000Z', sets, '2026-06-01T19:30:00.000Z');

    expect(result.sets.map(s => s.id)).toEqual(['set-1']);
  });

  it('should shift a session that has a date but no recorded sets', () => {
    const result = retimeSessionToEnd('2026-06-02T08:00:00.000Z', [at(null, 'set-pending')], '2026-06-01T19:30:00.000Z');

    expect(result.sessionDate).toBe('2026-06-01T19:30:00.000Z');
    expect(result.sets).toEqual([]);
  });

  it('should read a naive database timestamp as UTC and write back a UTC instant', () => {
    const sets = [at('2026-06-02T08:30:00', 'set-1')];

    const result = retimeSessionToEnd('2026-06-02T08:00:00', sets, '2026-06-01T21:30:00+02:00');

    expect(result.sessionDate).toBe('2026-06-01T19:00:00.000Z');
    expect(result.sets[0]!.completed_at).toBe('2026-06-01T19:30:00.000Z');
  });
});

describe('resolveSessionFinishedAt', () => {
  const NOW = '2026-06-01T20:00:00.000Z';

  it('should record the chosen end when the caller named one', () => {
    expect(resolveSessionFinishedAt('2026-06-01T19:30:00.000Z', NOW)).toBe('2026-06-01T19:30:00.000Z');
  });

  it('should record the current instant when no end was named', () => {
    expect(resolveSessionFinishedAt(undefined, NOW)).toBe(NOW);
  });

  it('should reduce an offset the client sent to the UTC instant the column stores', () => {
    expect(resolveSessionFinishedAt('2026-06-01T21:30:00+02:00', NOW)).toBe('2026-06-01T19:30:00.000Z');
  });
});
