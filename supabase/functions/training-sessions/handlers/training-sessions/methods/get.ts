import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingSessionDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const GetTrainingSessionsQuerySchema = z.object({
  limit: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().positive().optional()
  ),
  offset: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().nonnegative().optional()
  ),
  order: z.string().regex(/^(session_date)\.(asc|desc)$/).default('session_date.desc').optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  date_from: z.preprocess(
    (val) => (val ? new Date(String(val)).toISOString() : undefined),
    z.string().datetime().optional()
  ),
  date_to: z.preprocess(
    (val) => (val ? new Date(String(val)).toISOString() : undefined),
    z.string().datetime().optional()
  ),
});

export async function handleGetTrainingSessions(
  { supabaseClient, user, url }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'url'>
) {
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const validationResult = GetTrainingSessionsQuerySchema.safeParse(queryParams);

  if (!validationResult.success) {
    return createErrorResponse(400, 'Invalid query parameters', validationResult.error.flatten());
  }

  const { limit, offset, order, status, date_from, date_to } = validationResult.data;

  try {
    let query = supabaseClient
      .from('training_sessions')
      .select('*, sets:session_sets!session_sets_training_session_id_fkey(*)')
      .eq('user_id', user!.id);

    if (status) {
      query = query.eq('status', status);
    }
    if (date_from) {
      query = query.gte('session_date', date_from);
    }
    if (date_to) {
      query = query.lte('session_date', date_to);
    }

    if (order) {
      const [field, direction] = order.split('.');
      query = query.order(field, { ascending: direction === 'asc' });
    } else {
      query = query.order('session_date', { ascending: false });
    }

    if (limit !== undefined && offset !== undefined) {
      query = query.range(offset, offset + limit - 1);
    } else if (limit !== undefined) {
      query = query.limit(limit);
    }

    const { data, error } = await query.returns<TrainingSessionDto[]>();

    if (error) {
      console.error('Error fetching training sessions:', error);
      return createErrorResponse(500, 'Failed to fetch training sessions', { details: error.message });
    }

    data?.forEach(session =>
      session.sets?.sort((a, b) =>
        a.training_plan_exercise_id.localeCompare(b.training_plan_exercise_id) ||
        a.set_index - b.set_index
      )
    );

    return createSuccessResponse<TrainingSessionDto[]>(200, data || []);
  } catch (e) {
    console.error('Unexpected error in handleGetTrainingSessions:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}
