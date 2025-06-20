import type { Context } from 'hono';
import { z } from 'zod';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateQueryParams } from "../../utils/validation.ts";

const DEFAULT_PLANS_PAGE_LIMIT = 20;
const MAX_PLANS_PAGE_LIMIT = 100;
const DEFAULT_PLANS_OFFSET = 0;
const DEFAULT_PLANS_SORT_COLUMN = 'created_at';
const DEFAULT_PLANS_SORT_DIRECTION = 'desc';

export const QUERY_SCHEMA = z.object({
  limit: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().positive().max(MAX_PLANS_PAGE_LIMIT).optional().default(DEFAULT_PLANS_PAGE_LIMIT)
  ),
  offset: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().min(0).optional().default(DEFAULT_PLANS_OFFSET)
  ),
  sort: z.string().optional().default(`${DEFAULT_PLANS_SORT_COLUMN}:${DEFAULT_PLANS_SORT_DIRECTION}`),
});

export async function handleGetTrainingPlans(c: Context<AppContext>) {
  const { query, error: queryError } = await validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const [sortColumn, sortDirection] = query!.sort.split(':');
    const { data, count, error: dbError } = await supabaseClient
      .from('training_plans')
      .select(`
        *,
        days:training_plan_days (
          *,
          exercises:training_plan_exercises (
            *,
            sets:training_plan_exercise_sets (
              *
            )
          )
        ),
        progressions:training_plan_exercise_progressions (
          *
        )
      `, { count: 'exact' })
      .eq('user_id', user!.id)
      .range(query!.offset, query!.offset + query!.limit - 1)
      .order(sortColumn, { ascending: sortDirection === 'asc' });

    if (dbError) {
      const errorData = createErrorDataWithLogging(500, 'Failed to retrieve training plans', { details: dbError.message }, undefined, dbError);
      return c.json(errorData, 500);
    }

    data?.forEach(plan => {
      plan.days?.sort((a, b) => a.order_index - b.order_index);
      plan.days?.forEach(day => {
        day.exercises?.sort((a, b) => a.order_index - b.order_index);
        day.exercises?.forEach(exercise => {
          exercise.sets?.sort((a, b) => a.set_index - b.set_index);
        });
      });
    });

    const successData = createSuccessData<TrainingPlanDto[]>(data as TrainingPlanDto[], { totalCount: count ?? undefined });
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleGetTrainingPlans:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
