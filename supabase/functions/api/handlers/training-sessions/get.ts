import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { SessionSetDto, TrainingSessionDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateQueryParams } from '../../utils/validation.ts';

const QUERY_SCHEMA = z.object({
  limit: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().nonnegative().optional()
  ),
  offset: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().nonnegative().optional()
  ),
  order: z.string().regex(/^(session_date)\.(asc|desc)$/).default('session_date.desc').optional(),
  status: z.preprocess(
    (val) => (typeof val === 'string' ? val.split(',').map(s => s.trim()) : undefined),
    z.array(z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])).optional()
  ),
  date_from: z.preprocess(
    (val) => (val ? new Date(String(val)).toISOString() : undefined),
    z.string().datetime().optional()
  ),
  date_to: z.preprocess(
    (val) => (val ? new Date(String(val)).toISOString() : undefined),
    z.string().datetime().optional()
  ),
  plan_id: z.string().uuid().optional(),
});

export async function handleGetTrainingSessions(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    let supabaseQuery = supabaseClient
      .from('training_sessions')
      .select('*, sets:session_sets!session_sets_training_session_id_fkey(*)', { count: 'exact' })
      .eq('user_id', user.id);

    if (query!.status && query!.status.length > 0) {
      supabaseQuery = supabaseQuery.in('status', query!.status);
    }

    if (query!.date_from) {
      supabaseQuery = supabaseQuery.gte('session_date', query!.date_from);
    }

    if (query!.date_to) {
      supabaseQuery = supabaseQuery.lte('session_date', query!.date_to);
    }

    if (query!.order) {
      const [field, direction] = query!.order.split('.');
      supabaseQuery = supabaseQuery.order(field, { ascending: direction === 'asc' });
    } else {
      supabaseQuery = supabaseQuery.order('session_date', { ascending: false });
    }

    if (query!.plan_id) {
      supabaseQuery = supabaseQuery.eq('training_plan_id', query!.plan_id);
    }

    if (query!.limit !== undefined && query!.offset !== undefined) {
      supabaseQuery = supabaseQuery.range(query!.offset, query!.offset + query!.limit - 1);
    } else if (query!.limit !== undefined) {
      supabaseQuery = supabaseQuery.limit(query!.limit);
    }

    const { data, count, error } = await supabaseQuery;

    if (error) {
      console.error('Error fetching training sessions:', error);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch training sessions', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    data?.forEach((session: TrainingSessionDto) =>
      session.sets?.sort((a: SessionSetDto, b: SessionSetDto) =>
        a.training_plan_exercise_id.localeCompare(b.training_plan_exercise_id) ||
        a.set_index - b.set_index
      )
    );

    const successData = createSuccessData<TrainingSessionDto[]>(data || [], { totalCount: count! });
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleGetTrainingSessions:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
