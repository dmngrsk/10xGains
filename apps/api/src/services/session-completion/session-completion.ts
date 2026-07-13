import type { PlanExerciseDto, PlanExerciseProgressionDto, SessionDto, SessionSetDto } from '@txg/shared';

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

interface ProgressionJoin {
  progression: PlanExerciseProgressionDto | PlanExerciseProgressionDto[] | null;
}

type PlanExerciseWithProgressionRow = PlanExerciseDto & {
  global_exercises: ProgressionJoin | ProgressionJoin[] | null;
};

/** A plan day joined with its exercises and their progression rules. */
export interface PlanDayWithProgressionsRow {
  exercises: PlanExerciseWithProgressionRow | PlanExerciseWithProgressionRow[] | null;
}

/**
 * Asserts that a session is in a state that can be completed.
 *
 * @param {Pick<SessionDto, 'status' | 'plan_id'>} session - The session to check.
 * @throws {Error} If the session is not IN_PROGRESS, or carries no plan to progress.
 */
export function assertSessionCompletable(session: Pick<SessionDto, 'status' | 'plan_id'>): void {
  if (session.status !== 'IN_PROGRESS') {
    throw new Error(`Session cannot be completed. Current status: ${session.status}. Expected: IN_PROGRESS.`);
  }

  if (!session.plan_id) {
    throw new Error('Plan ID missing from the session. Cannot calculate progressions.');
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
 * Flattens the plan days into the exercises and progression rules that
 * `resolveExerciseProgressions` needs, de-duplicating entries that the join repeats
 * because the same exercise can appear on several days of a plan.
 *
 * @param {PlanDayWithProgressionsRow[]} rows - The joined plan day rows.
 * @returns The plan's exercises and their progression rules, each unique by id.
 */
export function extractPlanProgressionContext(rows: PlanDayWithProgressionsRow[]): { planExercises: PlanExerciseDto[]; planExerciseProgressions: PlanExerciseProgressionDto[] } {
  const exerciseRows = rows.flatMap(row => toArray(row.exercises));

  const planExercises = [...new Map(
    exerciseRows.map(({ global_exercises: _globalExercises, ...planExercise }) => [planExercise.id, planExercise as PlanExerciseDto])
  ).values()];

  const planExerciseProgressions = [...new Map(
    exerciseRows
      .flatMap(planExercise => toArray(planExercise.global_exercises))
      .flatMap(globalExercise => toArray(globalExercise.progression))
      .map(progression => [progression.id, progression])
  ).values()];

  return { planExercises, planExerciseProgressions };
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
