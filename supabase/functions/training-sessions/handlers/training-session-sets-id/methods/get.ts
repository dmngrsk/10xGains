import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '@shared/utils/api-helpers.ts';
import type { SessionSetDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const pathParamsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  setId: z.string().uuid('Invalid set ID format'),
});

export async function handleGetTrainingSessionSetById(
  { supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams'>
): Promise<Response> {
  const parsedPathParams = pathParamsSchema.safeParse(rawPathParams);
  if (!parsedPathParams.success) {
    return createErrorResponse(400, 'Invalid path parameters.', { issues: parsedPathParams.error.issues }, 'VALIDATION_ERROR');
  }
  const { sessionId, setId } = parsedPathParams.data;

  try {
    const { data: trainingSession, error: sessionError } = await supabaseClient
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (sessionError) {
      console.error('Error fetching training session for set verification:', sessionError);
      return createErrorResponse(500, 'Error verifying session access for set.', { details: sessionError.message });
    }

    if (!trainingSession) {
      return createErrorResponse(404, `Training session with ID ${sessionId} not found or access denied.`, undefined, 'NOT_FOUND');
    }

    const { data: sessionSet, error: setError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('id', setId)
      .eq('training_session_id', sessionId)
      .maybeSingle();

    if (setError) {
      console.error('Error fetching session set:', setError);
      return createErrorResponse(500, 'Failed to fetch session set.', { details: setError.message });
    }

    if (!sessionSet) {
      return createErrorResponse(404, `Session set with ID ${setId} not found in session ${sessionId}.`);
    }

    return createSuccessResponse<SessionSetDto>(200, sessionSet);

  } catch (e) {
    console.error('Unexpected error in handleGetTrainingSessionSetById:', e);
    return createErrorResponse(500, 'An unexpected error occurred while fetching the session set.', { details: (e as Error).message});
  }
}
