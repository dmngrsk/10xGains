import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import type { TrainingPlanDto } from 'shared/api-types.ts';
import type { ApiHandlerContext } from 'shared/api-routing.ts';

export const listTrainingPlansQuerySchema = z.object({
  limit: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().positive().optional()
  ),
  offset: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().min(0).optional()
  ),
  sort: z.string().optional(),
});

export async function handleGetTrainingPlans(
  { supabaseClient, user, url, requestInfo }: ApiHandlerContext 
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
    if (!user) {
        return createErrorResponse(401, 'User authentication required.', undefined, 'AUTH_REQUIRED', undefined, requestInfo);
    }
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
      .eq('user_id', user.id);

    if (limit !== undefined) {
      query = query.limit(limit);
    }
    if (offset !== undefined) {
      query = query.offset(offset);
    }
    if (sort) {
      const [sortField, sortOrderInput] = sort.split(':');
      const sortOrder = sortOrderInput?.toLowerCase() === 'desc' ? 'desc' : 'asc';
      if (sortField) {
        query = query.order(sortField, { ascending: sortOrder === 'asc' });
      }
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
    return createSuccessResponse<TrainingPlanDto[]>(200, data || [], 'Training plans retrieved successfully.');
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