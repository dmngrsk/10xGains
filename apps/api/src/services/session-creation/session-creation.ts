import type { PlanExerciseSetDto, SessionDto, SessionSetDto } from '@txg/shared';
import { DataIntegrityError } from '../../utils/errors';

/** A plan day, reduced to what creating a session from it requires. */
export interface PlanDayForSession {
  id: string;
  order_index: number;
  exercises?: { sets?: PlanExerciseSetDto[] | null }[] | null;
}

/** A session of the same plan, reduced to what deciding the next day requires. */
export type SessionForRotation = Pick<SessionDto, 'status' | 'session_date' | 'plan_day_id'>;

/**
 * Resolves which day of a plan the next session should train.
 *
 * An explicitly requested day always wins. Otherwise the days are walked in `order_index`
 * order, starting after the day of the most recent COMPLETED session and wrapping around
 * at the end of the plan; a user with no completed session yet starts at the first day.
 *
 * Only dated, COMPLETED sessions advance the rotation: a cancelled or still-pending
 * session must not consume a day, or the user would silently skip a workout.
 *
 * @param {PlanDayForSession[]} days - The days of the plan; must not be empty.
 * @param {SessionForRotation[]} sessions - The user's sessions for that plan, in any order.
 * @param {string | null | undefined} requestedDayId - A day explicitly asked for, if any.
 * @returns {string} The id of the day to train next.
 * @throws {Error} If the plan has no days, or the last completed session trained a day
 *                 that no longer belongs to the plan (so the rotation cannot be resumed).
 */
export function resolveNextPlanDayId(
  days: PlanDayForSession[],
  sessions: SessionForRotation[],
  requestedDayId?: string | null
): string {
  if (requestedDayId) {
    return requestedDayId;
  }

  if (days.length === 0) {
    throw new DataIntegrityError('Failed to identify the next day for this plan.', 'NEXT_DAY_UNRESOLVED', 'next_day_unresolved_error');
  }

  const dayIds = [...days].sort((a, b) => a.order_index - b.order_index).map(d => d.id);

  const lastCompleted = sessions
    .filter(s => s.status === 'COMPLETED' && !!s.session_date)
    .sort((a, b) => new Date(b.session_date!).getTime() - new Date(a.session_date!).getTime())[0];

  if (!lastCompleted) {
    return dayIds[0];
  }

  const lastIndex = dayIds.indexOf(lastCompleted.plan_day_id!);
  if (lastIndex === -1) {
    throw new DataIntegrityError('Failed to identify the next day for this plan.', 'NEXT_DAY_UNRESOLVED', 'next_day_unresolved_error');
  }

  return dayIds[(lastIndex + 1) % dayIds.length];
}

/**
 * Cancels the sessions left outstanding when a new one is started.
 *
 * A user may only have one session open at a time, so any session still PENDING or
 * IN_PROGRESS is closed as CANCELLED. Completed sessions are history and are never
 * touched.
 *
 * @param {SessionDto[]} sessions - The user's sessions for the plan.
 * @returns {SessionDto[]} Only the sessions that changed, ready to be persisted.
 */
export function cancelOutstandingSessions(sessions: SessionDto[]): SessionDto[] {
  return sessions
    .filter(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS')
    .map(s => ({ ...s, status: 'CANCELLED' as const }));
}

/**
 * Seeds the sets of a new session from the plan day's prescription.
 *
 * Each planned set becomes a PENDING session set whose weight starts at the planned
 * weight and whose reps are not yet recorded: `expected_*` is what the plan asks for,
 * `actual_*` is what the user ends up doing.
 *
 * @param {PlanDayForSession} day - The plan day being trained, with its exercises and sets.
 * @param {string} sessionId - The id of the session the sets belong to.
 * @param {() => string} newId - Id factory, injected so the result is deterministic in tests.
 * @returns {SessionSetDto[]} The sets to create alongside the session.
 */
export function buildSessionSets(
  day: PlanDayForSession,
  sessionId: string,
  newId: () => string = () => crypto.randomUUID()
): SessionSetDto[] {
  return (day.exercises ?? [])
    .flatMap(exercise => exercise.sets ?? [])
    .map(plannedSet => ({
      id: newId(),
      session_id: sessionId,
      plan_exercise_id: plannedSet.plan_exercise_id,
      set_index: plannedSet.set_index,
      expected_reps: plannedSet.expected_reps,
      actual_reps: null,
      actual_weight: plannedSet.expected_weight,
      status: 'PENDING' as const,
      completed_at: null,
    }));
}
