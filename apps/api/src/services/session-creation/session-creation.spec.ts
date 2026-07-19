import type { SessionDto } from '@txg/shared';
import { describe, it, expect } from 'vitest';
import { buildSessionSets, cancelOutstandingSessions, resolveNextPlanDayId } from './session-creation';
import type { PlanDayForSession, SessionForRotation } from './session-creation';

const DAY_A = 'day-a';
const DAY_B = 'day-b';
const DAY_C = 'day-c';

const DAYS: PlanDayForSession[] = [
  { id: DAY_A, order_index: 1 },
  { id: DAY_B, order_index: 2 },
  { id: DAY_C, order_index: 3 },
];

function completed(planDayId: string, date: string): SessionForRotation {
  return { status: 'COMPLETED', session_date: date, plan_day_id: planDayId };
}

function makeSession(overrides: Partial<SessionDto> = {}): SessionDto {
  return {
    id: 'session-1',
    user_id: 'user-1',
    plan_id: 'plan-1',
    plan_day_id: DAY_A,
    session_date: '2026-06-01T10:00:00.000Z',
    status: 'COMPLETED',
    notes: null,
    ...overrides,
  };
}

describe('resolveNextPlanDayId', () => {
  describe('when a day is explicitly requested', () => {
    it('should return that day, ignoring the rotation', () => {
      const sessions = [completed(DAY_A, '2026-06-01T10:00:00.000Z')];

      expect(resolveNextPlanDayId(DAYS, sessions, DAY_C)).toBe(DAY_C);
    });

    it('should return that day even when the plan has no session history', () => {
      expect(resolveNextPlanDayId(DAYS, [], DAY_B)).toBe(DAY_B);
    });
  });

  describe('when the plan has no completed session yet', () => {
    it('should start at the first day', () => {
      expect(resolveNextPlanDayId(DAYS, [])).toBe(DAY_A);
    });

    it('should start at the first day by order_index, not by array position', () => {
      const shuffled: PlanDayForSession[] = [
        { id: DAY_C, order_index: 3 },
        { id: DAY_A, order_index: 1 },
        { id: DAY_B, order_index: 2 },
      ];

      expect(resolveNextPlanDayId(shuffled, [])).toBe(DAY_A);
    });

    it('should NOT let a pending or in-progress session advance the rotation', () => {
      const sessions: SessionForRotation[] = [
        { status: 'IN_PROGRESS', session_date: '2026-06-02T10:00:00.000Z', plan_day_id: DAY_A },
        { status: 'PENDING', session_date: null, plan_day_id: DAY_B },
      ];

      expect(resolveNextPlanDayId(DAYS, sessions)).toBe(DAY_A);
    });

    it('should NOT let a cancelled session advance the rotation', () => {
      const sessions: SessionForRotation[] = [
        { status: 'CANCELLED', session_date: '2026-06-02T10:00:00.000Z', plan_day_id: DAY_A },
      ];

      expect(resolveNextPlanDayId(DAYS, sessions)).toBe(DAY_A);
    });
  });

  describe('when the plan has completed sessions', () => {
    it('should advance to the day after the last completed one', () => {
      const sessions = [completed(DAY_A, '2026-06-01T10:00:00.000Z')];

      expect(resolveNextPlanDayId(DAYS, sessions)).toBe(DAY_B);
    });

    it('should wrap around to the first day after the last day of the plan', () => {
      const sessions = [completed(DAY_C, '2026-06-01T10:00:00.000Z')];

      expect(resolveNextPlanDayId(DAYS, sessions)).toBe(DAY_A);
    });

    it('should follow the most recent completed session, regardless of input order', () => {
      const sessions = [
        completed(DAY_A, '2026-06-01T10:00:00.000Z'),
        completed(DAY_B, '2026-06-05T10:00:00.000Z'),
        completed(DAY_A, '2026-06-03T10:00:00.000Z'),
      ];

      expect(resolveNextPlanDayId(DAYS, sessions)).toBe(DAY_C);
    });

    it('should ignore a completed session that has no date', () => {
      const sessions: SessionForRotation[] = [
        { status: 'COMPLETED', session_date: null, plan_day_id: DAY_C },
        completed(DAY_A, '2026-06-01T10:00:00.000Z'),
      ];

      expect(resolveNextPlanDayId(DAYS, sessions)).toBe(DAY_B);
    });

    it('should repeat the only day of a single-day plan', () => {
      const singleDay: PlanDayForSession[] = [{ id: DAY_A, order_index: 1 }];
      const sessions = [completed(DAY_A, '2026-06-01T10:00:00.000Z')];

      expect(resolveNextPlanDayId(singleDay, sessions)).toBe(DAY_A);
    });
  });

  describe('when the rotation cannot be resumed', () => {
    it('should throw if the last completed session trained a day no longer in the plan', () => {
      const sessions = [completed('day-deleted', '2026-06-01T10:00:00.000Z')];

      expect(() => resolveNextPlanDayId(DAYS, sessions)).toThrow('Failed to identify the next day for this plan.');
    });

    it('should throw if the plan has no days', () => {
      expect(() => resolveNextPlanDayId([], [])).toThrow('Failed to identify the next day for this plan.');
    });
  });
});

describe('cancelOutstandingSessions', () => {
  it.each(['PENDING', 'IN_PROGRESS'] as const)('should cancel a %s session', (status) => {
    const sessions = [makeSession({ id: 'session-1', status })];

    const result = cancelOutstandingSessions(sessions);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'session-1', status: 'CANCELLED' });
  });

  it('should never touch a completed session, which is history', () => {
    const sessions = [makeSession({ status: 'COMPLETED' })];

    expect(cancelOutstandingSessions(sessions)).toEqual([]);
  });

  it('should leave an already cancelled session alone', () => {
    const sessions = [makeSession({ status: 'CANCELLED' })];

    expect(cancelOutstandingSessions(sessions)).toEqual([]);
  });

  it('should return only the sessions that changed', () => {
    const sessions = [
      makeSession({ id: 'session-1', status: 'COMPLETED' }),
      makeSession({ id: 'session-2', status: 'IN_PROGRESS' }),
      makeSession({ id: 'session-3', status: 'CANCELLED' }),
    ];

    const result = cancelOutstandingSessions(sessions);

    expect(result.map(s => s.id)).toEqual(['session-2']);
  });

  it('should preserve the other fields of a cancelled session', () => {
    const sessions = [makeSession({ status: 'IN_PROGRESS', notes: 'Felt strong today.' })];

    expect(cancelOutstandingSessions(sessions)[0].notes).toBe('Felt strong today.');
  });

  it('should not mutate the input sessions', () => {
    const sessions = [makeSession({ status: 'IN_PROGRESS' })];

    cancelOutstandingSessions(sessions);

    expect(sessions[0].status).toBe('IN_PROGRESS');
  });
});

describe('buildSessionSets', () => {
  const day: PlanDayForSession = {
    id: DAY_A,
    order_index: 1,
    exercises: [
      {
        sets: [
          { id: 'ps-1', plan_exercise_id: 'pe-1', set_index: 1, expected_reps: 5, expected_weight: 100 },
          { id: 'ps-2', plan_exercise_id: 'pe-1', set_index: 2, expected_reps: 5, expected_weight: 100 },
        ],
      },
      {
        sets: [
          { id: 'ps-3', plan_exercise_id: 'pe-2', set_index: 1, expected_reps: 8, expected_weight: 60 },
        ],
      },
    ],
  };

  const ids = () => {
    let n = 0;
    return () => `set-${++n}`;
  };

  it('should seed a pending set for every planned set, across all exercises of the day', () => {
    const result = buildSessionSets(day, 'session-1', ids());

    expect(result).toHaveLength(3);
    expect(result.every(s => s.status === 'PENDING')).toBe(true);
    expect(result.every(s => s.session_id === 'session-1')).toBe(true);
  });

  it('should start each set at the planned weight, with the reps not yet recorded', () => {
    const result = buildSessionSets(day, 'session-1', ids());

    expect(result[0]).toEqual({
      id: 'set-1',
      session_id: 'session-1',
      plan_exercise_id: 'pe-1',
      set_index: 1,
      expected_reps: 5,
      actual_reps: null,
      actual_weight: 100,
      status: 'PENDING',
      completed_at: null,
    });
  });

  it('should carry the plan exercise and set index of each planned set', () => {
    const result = buildSessionSets(day, 'session-1', ids());

    expect(result.map(s => [s.plan_exercise_id, s.set_index])).toEqual([
      ['pe-1', 1],
      ['pe-1', 2],
      ['pe-2', 1],
    ]);
  });

  it('should give every set a distinct id', () => {
    const result = buildSessionSets(day, 'session-1');

    expect(new Set(result.map(s => s.id)).size).toBe(3);
  });

  it('should return no sets for a day with no exercises', () => {
    expect(buildSessionSets({ id: DAY_A, order_index: 1 }, 'session-1')).toEqual([]);
    expect(buildSessionSets({ id: DAY_A, order_index: 1, exercises: [] }, 'session-1')).toEqual([]);
  });

  it('should skip an exercise that has no sets', () => {
    const dayWithEmptyExercise: PlanDayForSession = {
      id: DAY_A,
      order_index: 1,
      exercises: [{ sets: null }, { sets: [{ id: 'ps-1', plan_exercise_id: 'pe-1', set_index: 1, expected_reps: 5, expected_weight: 100 }] }],
    };

    expect(buildSessionSets(dayWithEmptyExercise, 'session-1')).toHaveLength(1);
  });
});
