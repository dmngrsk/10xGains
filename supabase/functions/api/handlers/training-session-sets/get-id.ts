import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, createErrorDataWithLogging } from '../../utils/api-helpers.ts';
import type { SessionSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
  setId: z.string().uuid('Invalid setId format'),
});

export async function handleGetTrainingSessionSetById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { data: trainingSession, error: sessionError } = await supabaseClient
      .from('training_sessions')
      .select('id')
      .eq('id', path!.sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionError) {
      console.error('Error fetching training session for set verification:', sessionError);
      const errorData = createErrorDataWithLogging(500, 'Error verifying session access for set.', { details: sessionError.message }, undefined, sessionError);
      return c.json(errorData, 500);
    }

    if (!trainingSession) {
      const errorData = createErrorDataWithLogging(404, `Training session with ID ${path!.sessionId} not found or access denied.`, undefined, 'NOT_FOUND');
      return c.json(errorData, 404);
    }

    const { data: sessionSet, error: setError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('id', path!.setId)
      .eq('training_session_id', path!.sessionId)
      .maybeSingle();

    if (setError) {
      console.error('Error fetching session set:', setError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch session set.', { details: setError.message }, undefined, setError);
      return c.json(errorData, 500);
    }

    if (!sessionSet) {
      const errorData = createErrorDataWithLogging(404, `Session set with ID ${path!.setId} not found in session ${path!.sessionId}.`);
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<SessionSetDto>(sessionSet);
    return c.json(successData, 200);

  } catch (e) {
    console.error('Unexpected error in handleGetTrainingSessionSetById:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred while fetching the session set.', { details: (e as Error).message}, undefined, e);
    return c.json(errorData, 500);
  }
}
