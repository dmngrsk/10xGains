import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { SessionSetDto, TrainingSessionDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from '../../utils/validation.ts';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

export async function handleGetTrainingSessionById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { data: session, error } = await supabaseClient
      .from('training_sessions')
      .select('*, sets:session_sets!session_sets_training_session_id_fkey(*)')
      .eq('id', path!.sessionId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error(`Error fetching training session ${path!.sessionId} for user ${user.id}:`, error);
      if (error.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Training session not found.');
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to retrieve training session', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    if (!session) {
      const errorData = createErrorDataWithLogging(404, 'Training session not found.');
      return c.json(errorData, 404);
    }

    session.sets?.sort((a: SessionSetDto, b: SessionSetDto) =>
      a.training_plan_exercise_id.localeCompare(b.training_plan_exercise_id) ||
      a.set_index - b.set_index
    );

    const successData = createSuccessData<TrainingSessionDto>(session as TrainingSessionDto);
    return c.json(successData, 200);

  } catch (e) {
    console.error('Unexpected error in handleGetTrainingSessionById:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
