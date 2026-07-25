import type { ExerciseProgressDto, ExerciseProgressPointDto, SessionSetDto } from '@txg/shared';

/**
 * A single set of a completed session, joined with its session and exercise identity.
 * This is the raw input the progress query produces, before aggregation.
 */
export interface ExerciseProgressRow {
  set_index: number;
  status: SessionSetDto['status'];
  actual_weight: number;
  actual_reps: number | null;
  plan_exercise_id: string;
  session: {
    id: string;
    session_date: string | null;
    plan_id: string;
  };
  plan_exercise: {
    exercise_id: string;
    exercise: {
      id: string;
      name: string;
    };
  };
}

/**
 * Aggregates the sets of completed sessions into per-exercise progress series.
 *
 * For every (exercise, session) pair one point is produced, carrying:
 * - top_weight: the highest actual_weight among the COMPLETED sets, ties broken by the
 *   higher actual_reps. A pair without any completed set yields no point at all.
 * - reps: the actual reps of every set in set order, so failed sets are visible too;
 *   a set with no recorded reps counts as 0.
 *
 * Rows without a session date are skipped, as they cannot be plotted. Series are sorted
 * by exercise name, points by session date ascending.
 *
 * @param {ExerciseProgressRow[]} rows - The joined set rows of completed sessions.
 * @returns {ExerciseProgressDto[]} The aggregated progress series.
 */
export function aggregateExerciseProgress(rows: ExerciseProgressRow[]): ExerciseProgressDto[] {
  const series = new Map<string, { exerciseName: string; sessions: Map<string, ExerciseProgressRow[]> }>();

  for (const row of rows) {
    if (!row.session.session_date) {
      continue;
    }

    const exerciseId = row.plan_exercise.exercise_id;
    let entry = series.get(exerciseId);
    if (!entry) {
      entry = { exerciseName: row.plan_exercise.exercise.name, sessions: new Map() };
      series.set(exerciseId, entry);
    }

    const sessionRows = entry.sessions.get(row.session.id) ?? [];
    sessionRows.push(row);
    entry.sessions.set(row.session.id, sessionRows);
  }

  return [...series.entries()]
    .map(([exerciseId, entry]) => ({
      exercise_id: exerciseId,
      exercise_name: entry.exerciseName,
      points: [...entry.sessions.values()]
        .map(toPoint)
        .filter((point): point is ExerciseProgressPointDto => point !== null)
        .sort((a, b) => a.session_date.localeCompare(b.session_date)),
    }))
    .filter(s => s.points.length > 0)
    .sort((a, b) => a.exercise_name.localeCompare(b.exercise_name) || a.exercise_id.localeCompare(b.exercise_id));
}

/**
 * Builds the data point for a single exercise within a single session,
 * or null when the exercise has no completed set in that session.
 */
function toPoint(sessionRows: ExerciseProgressRow[]): ExerciseProgressPointDto | null {
  const topSet = sessionRows
    .filter(row => row.status === 'COMPLETED')
    .reduce<ExerciseProgressRow | null>((top, row) => (top && !isHigherSet(row, top) ? top : row), null);

  if (!topSet) {
    return null;
  }

  const reps = [...sessionRows]
    .sort((a, b) => a.plan_exercise_id.localeCompare(b.plan_exercise_id) || a.set_index - b.set_index)
    .map(row => row.actual_reps ?? 0);

  return {
    session_id: topSet.session.id,
    session_date: topSet.session.session_date!,
    plan_id: topSet.session.plan_id,
    top_weight: topSet.actual_weight,
    reps,
  };
}

function isHigherSet(candidate: ExerciseProgressRow, current: ExerciseProgressRow): boolean {
  if (candidate.actual_weight !== current.actual_weight) {
    return candidate.actual_weight > current.actual_weight;
  }
  return (candidate.actual_reps ?? -1) > (current.actual_reps ?? -1);
}
