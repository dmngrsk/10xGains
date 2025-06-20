import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, createErrorDataWithLogging } from '../../utils/api-helpers.ts';
import type { SessionSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});


export async function handleGetTrainingSessionSets(c: Context<AppContext>) {
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
      console.error('Error fetching training session:', sessionError);
      const errorData = createErrorDataWithLogging(500, 'Error verifying training session access.', { details: sessionError.message }, undefined, sessionError);
      return c.json(errorData, 500);
    }
    if (!trainingSession) {
      const errorData = createErrorDataWithLogging(404, `Training session with ID ${path!.sessionId} not found or access denied.`);
      return c.json(errorData, 404);
    }

    const { data: sessionSets, error: setsError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('training_session_id', path!.sessionId)
      .order('training_plan_exercise_id', { ascending: true })
      .order('set_index', { ascending: true });

    if (setsError) {
      console.error('Error fetching session sets:', setsError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch session sets.', { details: setsError.message }, undefined, setsError);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<SessionSetDto[]>(sessionSets || []);
    return c.json(successData, 200);

  } catch (e) {
    console.error('Unexpected error in handleGetTrainingSessionSets:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
