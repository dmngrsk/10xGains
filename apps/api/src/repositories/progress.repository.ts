import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@txg/shared';
import type { ExerciseProgressDto } from '@txg/shared';
import { aggregateExerciseProgress } from '../services/exercise-progress/exercise-progress';
import type { ExerciseProgressRow } from '../services/exercise-progress/exercise-progress';

export interface ExerciseProgressQueryOptions {
  plan_id?: string;
  exercise_ids?: string[];
  date_from?: string;
  date_to?: string;
}

/**
 * How many set rows one progress page requests.
 *
 * PostgREST caps every response at `max_rows` (1000, see `supabase/config.toml`) and reports the
 * true total only in a header, so a query matching more rows is silently truncated. Matching the
 * page size to that cap means a full page is the signal that more rows remain.
 */
const PROGRESS_PAGE_SIZE = 1000;

/**
 * The ceiling on how many pages one progress query may walk.
 *
 * At ~39 sets/week for a consistent lifter this covers well over a decade of training, so it is
 * not reachable by ordinary use. It exists so a pathological account cannot spin the request
 * indefinitely - and it throws rather than returning what it has, because silently returning a
 * partial series is the exact defect this pagination removes.
 */
const MAX_PROGRESS_PAGES = 25;

export class ProgressRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Finds per-exercise progress series built from the sets of the user's completed
   * sessions, optionally narrowed by plan, exercises and date range.
   *
   * Reads the matching sets a page at a time, because a consistent lifter crosses PostgREST's
   * 1000-row cap at roughly six months of history and the truncation is otherwise invisible.
   * Omitting `date_from` means all history, so this walks as many pages as the account needs.
   *
   * @param {ExerciseProgressQueryOptions} options - The query options for filtering.
   * @returns {Promise<ExerciseProgressDto[]>} A promise that resolves to the aggregated series.
   */
  async findExerciseProgress(options: ExerciseProgressQueryOptions): Promise<ExerciseProgressDto[]> {
    const rows: ExerciseProgressRow[] = [];

    for (let page = 0; page < MAX_PROGRESS_PAGES; page++) {
      const pageRows = await this.findExerciseProgressPage(options, page);
      rows.push(...pageRows);

      if (pageRows.length < PROGRESS_PAGE_SIZE) {
        return aggregateExerciseProgress(rows);
      }
    }

    throw new Error(
      `Exercise progress query exceeded ${MAX_PROGRESS_PAGES} pages of ${PROGRESS_PAGE_SIZE} sets. ` +
      'Narrow the date range.'
    );
  }

  /**
   * Reads a single page of the progress query.
   *
   * Ordered by `id` so page boundaries are stable: without a total order PostgREST returns rows
   * in planner order, and the same row can appear on two pages or on none.
   *
   * @param {ExerciseProgressQueryOptions} options - The query options for filtering.
   * @param {number} page - The zero-based page index to read.
   * @returns {Promise<ExerciseProgressRow[]>} A promise that resolves to the page's set rows.
   */
  private async findExerciseProgressPage(
    options: ExerciseProgressQueryOptions,
    page: number
  ): Promise<ExerciseProgressRow[]> {
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

    if (options.date_from) {
      supabaseQuery = supabaseQuery.gte('session.session_date', options.date_from);
    }

    if (options.date_to) {
      supabaseQuery = supabaseQuery.lte('session.session_date', options.date_to);
    }

    const offset = page * PROGRESS_PAGE_SIZE;
    supabaseQuery = supabaseQuery
      .order('id', { ascending: true })
      .range(offset, offset + PROGRESS_PAGE_SIZE - 1);

    const { data, error } = await supabaseQuery;

    if (error) {
      throw error;
    }

    return (data ?? []) as unknown as ExerciseProgressRow[];
  }

}
