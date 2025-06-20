import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from '../../utils/validation.ts';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

export async function handleDeleteTrainingSessionById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { error, data } = await supabaseClient
      .from('training_sessions')
      .delete()
      .eq('id', path!.sessionId)
      .eq('user_id', user.id)
      .select();

    if (error) {
      console.error(`Error deleting training session ${path!.sessionId} for user ${user.id}:`, error);
      const errorData = createErrorDataWithLogging(500, 'Failed to delete training session', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    if (!data || data.length === 0) {
      const errorData = createErrorDataWithLogging(404, 'Training session not found or not authorized to delete.');
      return c.json(errorData, 404);
    }

    return c.body(null, 204);

  } catch (error) {
    console.error('Unexpected error in handleDeleteTrainingSessionById:', error);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
