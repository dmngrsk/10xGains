import type { PlanExerciseDto, SessionDto, SessionSetDto } from '@txg/shared';
import { ConflictError, DataIntegrityError } from '../../utils/errors';

/**
 * PostgREST returns an embedded relation as an object for a to-one join and as an array
 * for a to-many one, and the generated types do not always distinguish the two. Every
 * embed is therefore read through this helper rather than assumed to be one or the other.
 */
function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

interface ExerciseRef {
  id: string;
}

interface PlanExerciseJoin {
  exercises: ExerciseRef | ExerciseRef[] | null;
}

/** A session set joined with the global exercise it belongs to. */
export type SessionSetWithExerciseRow = SessionSetDto & {
  plan_exercises: PlanExerciseJoin | PlanExerciseJoin[] | null;
};

/** A plan day joined with its exercises and their expected sets. */
export interface PlanDayWithExercisesRow {
  exercises: PlanExerciseDto | PlanExerciseDto[] | null;
}

/**
 * Asserts that a session is in a state that can be completed.
 *
 * @param {Pick<SessionDto, 'status' | 'plan_id'>} session - The session to check.
 * @throws {Error} If the session is not IN_PROGRESS, or carries no plan to progress.
 */
export function assertSessionCompletable(session: Pick<SessionDto, 'status' | 'plan_id'>): void {
  if (session.status !== 'IN_PROGRESS') {
    throw new ConflictError(`Session cannot be completed. Current status: ${session.status}. Expected: IN_PROGRESS.`, 'SESSION_NOT_COMPLETABLE', 'session_completion_error');
  }

  if (!session.plan_id) {
    throw new DataIntegrityError('Plan ID missing from the session. Cannot calculate progressions.', 'PLAN_MISSING', 'plan_missing_error');
  }
}

/**
 * Separates the joined session-set rows into the plain sets and the ids of the global
 * exercises they trained; the latter narrow the follow-up query for progression rules.
 *
 * @param {SessionSetWithExerciseRow[]} rows - The joined session set rows.
 * @returns The sets without their embedded relation, and the unique exercise ids.
 */
export function extractSessionSetContext(rows: SessionSetWithExerciseRow[]): { sessionSets: SessionSetDto[]; exerciseIds: string[] } {
  const sessionSets = rows.map(({ plan_exercises: _planExercises, ...set }) => set);

  const exerciseIds = [...new Set(
    rows
      .flatMap(row => toArray(row.plan_exercises))
      .flatMap(planExercise => toArray(planExercise.exercises))
      .map(exercise => exercise.id)
  )];

  return { sessionSets, exerciseIds };
}

/**
 * Flattens the plan days into the exercises `resolveExerciseProgressions` needs,
 * de-duplicating entries that the join repeats because the same exercise can appear on
 * several days of a plan.
 *
 * @param {PlanDayWithExercisesRow[]} rows - The joined plan day rows.
 * @returns {PlanExerciseDto[]} The plan's exercises, each unique by id.
 */
export function extractPlanExercises(rows: PlanDayWithExercisesRow[]): PlanExerciseDto[] {
  const exerciseRows = rows.flatMap(row => toArray(row.exercises));

  return [...new Map(
    exerciseRows.map(planExercise => [planExercise.id, planExercise])
  ).values()];
}

/**
 * Marks every set the user never got to as SKIPPED.
 *
 * Completing a session must not leave PENDING sets behind: they would otherwise count as
 * neither done nor failed, and a later session of the same plan would still show them as
 * outstanding. Sets that already succeeded or failed keep their outcome.
 *
 * @param {SessionSetDto[]} sessionSets - All sets of the session being completed.
 * @returns {SessionSetDto[]} Only the sets that changed, ready to be persisted.
 */
export function skipPendingSets(sessionSets: SessionSetDto[]): SessionSetDto[] {
  return sessionSets
    .filter(set => set.status === 'PENDING')
    .map(set => ({ ...set, status: 'SKIPPED' as const }));
}

/**
 * How far into the future a client's clock may run before its end time is rejected.
 *
 * The client picks the end from its own clock, which is not the server's. A small allowance keeps
 * an ordinary "finish now" from failing on a device a minute or two fast, without admitting a date
 * the user could not have trained on.
 */
const CLOCK_SKEW_ALLOWANCE_MS = 5 * 60 * 1000;

/** The session's new date and the sets whose timestamps moved with it. */
export interface SessionRetiming {
  /** The session's date after the shift; unchanged when the start was not itself late. */
  sessionDate: string | null;
  /** Only the sets that moved, ready to be persisted. */
  sets: SessionSetDto[];
}

/**
 * Asserts that a session did not end in the future.
 *
 * @param {string} endAt - The end instant the client chose, as an ISO 8601 string.
 * @param {string} now - The server's current instant, as an ISO 8601 string.
 * @throws {ConflictError} If the end lies further ahead than the clock-skew allowance.
 */
export function assertSessionEndNotInFuture(endAt: string, now: string): void {
  if (toEpochMs(endAt) > toEpochMs(now) + CLOCK_SKEW_ALLOWANCE_MS) {
    throw new ConflictError(
      'A session cannot end in the future.',
      'SESSION_END_IN_FUTURE',
      'session_end_error'
    );
  }
}

/**
 * Asserts that a retimed session starts after the last workout on the same plan had finished.
 *
 * Two guarantees, one comparison. Which day of a plan comes next is read off the most recent
 * completed session, so a session back-dated behind an earlier one would make that earlier one the
 * latest again and the rotation would repeat a day - and an exact tie leaves `order by session_date
 * desc limit 1` to pick between them arbitrarily, which is the same failure. Comparing against the
 * previous session's *end* rather than its start also keeps two workouts on one plan from
 * overlapping in history: starting at 19:00 a session whose predecessor ran until 19:30 clears a
 * start-to-start check but describes two workouts happening at once.
 *
 * @param {string | null} sessionDate - The session's date after retiming.
 * @param {string | null} previousSessionEnd - When the latest other completed session of the same
 *   plan finished, if there is one.
 * @throws {ConflictError} If the retimed session would start at or before that moment.
 */
export function assertSessionEndAfterPreviousSession(
  sessionDate: string | null,
  previousSessionEnd: string | null
): void {
  if (!sessionDate || !previousSessionEnd) {
    return;
  }

  if (toEpochMs(sessionDate) <= toEpochMs(previousSessionEnd)) {
    throw new ConflictError(
      'This session would overlap a workout you already finished on this plan. Pick a later time.',
      'SESSION_END_BEFORE_PREVIOUS',
      'session_end_error',
      409
    );
  }
}

/**
 * Resolves the instant a session is recorded as having finished.
 *
 * The user's chosen end when there is one, and otherwise the moment the completion was asked for.
 * Normalised to a UTC instant because the naive `finished_at` column stores the UTC wall clock,
 * and the client is free to send any offset.
 *
 * @param {string | undefined} endAt - The end the client chose, as an ISO 8601 string.
 * @param {string} now - The server's current instant, as an ISO 8601 string.
 * @returns {string} The instant to store, as a UTC ISO 8601 string.
 */
export function resolveSessionFinishedAt(endAt: string | undefined, now: string): string {
  return new Date(toEpochMs(endAt ?? now)).toISOString();
}

/**
 * Moves the part of a session that was recorded after its real end back onto that end.
 *
 * Only the timestamps later than `endAt` - the *late block* - move, and they all move by the same
 * amount, so the rest intervals inside that block normally survive. The exception is a block that
 * reaches further back than the space between the chosen end and the last set that stayed: those
 * sets are held at that set's instant rather than crossing it, which costs them their spacing.
 * Recorded order is worth more than recorded spacing when the two cannot both be kept. Everything recorded before the chosen
 * end is left exactly as it was: a session logged entirely after the fact translates as a whole,
 * while a single set marked the next morning moves alone rather than dragging the sets that were
 * recorded correctly along with it. Nothing ever moves forward - the chosen end is an
 * approximation the user typed, and real tap-accurate timestamps are not worth overwriting with it.
 *
 * A moved timestamp is never allowed before one that stayed, so the recorded order is preserved -
 * though several may then share an instant; see above.
 *
 * @param {string | null} sessionDate - The session's current date, if it has one.
 * @param {SessionSetDto[]} sessionSets - All sets of the session being completed.
 * @param {string} endAt - The instant the user says training ended, as an ISO 8601 string.
 * @returns {SessionRetiming} The new session date and only the sets that moved.
 */
export function retimeSessionToEnd(
  sessionDate: string | null,
  sessionSets: SessionSetDto[],
  endAt: string
): SessionRetiming {
  const endAtMs = toEpochMs(endAt);
  const recordedSets = sessionSets.filter(set => !!set.completed_at);

  const timestamps = recordedSets.map(set => toEpochMs(set.completed_at!));
  if (sessionDate) {
    timestamps.push(toEpochMs(sessionDate));
  }

  const lastActivityMs = timestamps.length > 0 ? Math.max(...timestamps) : null;
  if (lastActivityMs === null || lastActivityMs <= endAtMs) {
    return { sessionDate, sets: [] };
  }

  // The shift is negative by construction: the block exists only because something outruns the end.
  const deltaMs = endAtMs - lastActivityMs;

  // Nothing may move ahead of what stayed, so the shifted values are floored at the latest
  // timestamp outside the block. A wholly late session has none, and nothing constrains its shift.
  const floorMs = Math.max(
    ...timestamps.filter(ms => ms <= endAtMs),
    Number.NEGATIVE_INFINITY
  );

  const shift = (isoDate: string): string => {
    const shiftedMs = Math.max(toEpochMs(isoDate) + deltaMs, floorMs);
    return new Date(shiftedMs).toISOString();
  };

  const isLate = (isoDate: string): boolean => toEpochMs(isoDate) > endAtMs;

  return {
    sessionDate: sessionDate && isLate(sessionDate) ? shift(sessionDate) : sessionDate,
    sets: recordedSets
      .filter(set => isLate(set.completed_at!))
      .map(set => ({ ...set, completed_at: shift(set.completed_at!) })),
  };
}

/**
 * Reads a timestamp the way the rest of the app does.
 *
 * The database columns are `timestamp without time zone` holding UTC, and PostgREST serialises them
 * with no offset at all; parsing such a string with `Date` alone would resolve it in the server's
 * local zone. Appending `Z` when no offset is present pins it to UTC - a value that already carries
 * one (as the client's `end_at` does) is parsed as sent.
 *
 * @param {string} isoDate - The timestamp to read.
 * @returns {number} The instant, in milliseconds since the epoch.
 */
function toEpochMs(isoDate: string): number {
  const hasOffset = isoDate.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(isoDate);
  return new Date(hasOffset ? isoDate : `${isoDate}Z`).getTime();
}
