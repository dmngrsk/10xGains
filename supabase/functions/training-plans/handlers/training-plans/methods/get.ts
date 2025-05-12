import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import type { TrainingPlanDto } from 'shared/api-types.ts';
import type { ApiHandlerContext } from 'shared/api-handler.ts';

const DEFAULT_PLANS_PAGE_LIMIT = 20;
const MAX_PLANS_PAGE_LIMIT = 100;
const DEFAULT_PLANS_OFFSET = 0;
const DEFAULT_PLANS_SORT_COLUMN = 'created_at';
const DEFAULT_PLANS_SORT_DIRECTION = 'desc';

export const listTrainingPlansQuerySchema = z.object({
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

export async function handleGetTrainingPlans(
  { supabaseClient, user, url, requestInfo }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'url' | 'requestInfo'>
): Promise<Response> {
  if (!user) {
    return createErrorResponse(401, 'User authentication required.', undefined, 'AUTH_REQUIRED', undefined, requestInfo);
  }

  const queryParams = Object.fromEntries(url.searchParams);
  const validationResult = listTrainingPlansQuerySchema.safeParse(queryParams);

  if (!validationResult.success) {
    return createErrorResponse(
      400,
      'Invalid query parameters',
      validationResult.error.flatten(),
      undefined,
      undefined,
      requestInfo
    );
  }

  const { limit, offset, sort } = validationResult.data;

  try {
    let query = supabaseClient
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
        )
      `)
      .eq('user_id', user.id)
      .range(offset, offset + limit - 1);

    const [sortField, sortOrderInput] = sort.split(':');
    const sortOrder = sortOrderInput?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    if (sortField) {
      query = query.order(sortField, { ascending: sortOrder === 'asc' });
    }

    const { data, error: dbError } = await query;

    if (dbError) {
      return createErrorResponse(
        500,
        'Failed to retrieve training plans',
        { details: dbError.message },
        'DB_ERROR',
        dbError,
        requestInfo
      );
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

    return createSuccessResponse<TrainingPlanDto[]>(200, data ?? []);
  } catch (e) {
    return createErrorResponse(
      500,
      'An unexpected error occurred while fetching training plans',
      { details: (e instanceof Error ? e.message : String(e)) },
      undefined,
      e,
      requestInfo
    );
  }
}
