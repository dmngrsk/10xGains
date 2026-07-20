import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@txg/shared';
import type { ExerciseProgressDto } from '@txg/shared';
import { aggregateExerciseProgress, resolveProgressWindowStart } from '../services/exercise-progress/exercise-progress';
import type { ExerciseProgressRow } from '../services/exercise-progress/exercise-progress';

export interface ExerciseProgressQueryOptions {
  plan_id?: string;
  exercise_ids?: string[];
  date_from?: string;
  date_to?: string;
}

export class ProgressRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Finds per-exercise progress series built from the sets of the user's completed
   * sessions, optionally narrowed by plan, exercises and date range.
   *
   * @param {ExerciseProgressQueryOptions} options - The query options for filtering.
   * @returns {Promise<ExerciseProgressDto[]>} A promise that resolves to the aggregated series.
   */
  async findExerciseProgress(options: ExerciseProgressQueryOptions): Promise<ExerciseProgressDto[]> {
    // Every set of a completed session is fetched, not just the completed ones: failed
    // sets carry the reps the user actually managed, which the chart tooltip reports.
    // The sessions embed names its foreign key explicitly, as session_sets has two.
    let supabaseQuery = this.supabase
      .from('session_sets')
      .select(`
        set_index,
        status,
        actual_weight,
        actual_reps,
        plan_exercise_id,
        session:sessions!session_sets_session_id_fkey!inner(id, session_date, plan_id),
        plan_exercise:plan_exercises!inner(exercise_id, exercise:exercises!inner(id, name))
      `)
      .eq('session.status', 'COMPLETED')
      .eq('session.user_id', this.getUserId());

    if (options.plan_id) {
      supabaseQuery = supabaseQuery.eq('session.plan_id', options.plan_id);
    }

    if (options.exercise_ids && options.exercise_ids.length > 0) {
      supabaseQuery = supabaseQuery.in('plan_exercise.exercise_id', options.exercise_ids);
    }

    // Always bounded below, defaulting when the caller gives no start date - otherwise this reads
    // every set of every completed session the account has ever recorded.
    supabaseQuery = supabaseQuery.gte('session.session_date', resolveProgressWindowStart(options.date_from));

    if (options.date_to) {
      supabaseQuery = supabaseQuery.lte('session.session_date', options.date_to);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      throw error;
    }

    return aggregateExerciseProgress((data ?? []) as unknown as ExerciseProgressRow[]);
  }

}
