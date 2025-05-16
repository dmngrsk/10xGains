import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '@shared/utils/api-helpers.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import type { SessionSetDto } from '@shared/models/api-types.ts';

const pathParamsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

export async function handleGetTrainingSessionSets(
  { supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams'>
): Promise<Response> {
  const parsedPathParams = pathParamsSchema.safeParse(rawPathParams);
  if (!parsedPathParams.success) {
    return createErrorResponse(400, 'Invalid session ID format.', { issues: parsedPathParams.error.issues }, 'VALIDATION_ERROR');
  }
  const { sessionId } = parsedPathParams.data;

  try {
    const { data: trainingSession, error: sessionError } = await supabaseClient
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (sessionError) {
      console.error('Error fetching training session:', sessionError);
      return createErrorResponse(500, 'Error verifying training session access.', { details: sessionError.message });
    }
    if (!trainingSession) {
      return createErrorResponse(404, `Training session with ID ${sessionId} not found or access denied.`);
    }

    const { data: sessionSets, error: setsError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('training_session_id', sessionId)
      .order('training_plan_exercise_id', { ascending: true })
      .order('set_index', { ascending: true });

    if (setsError) {
      console.error('Error fetching session sets:', setsError);
      return createErrorResponse(500, 'Failed to fetch session sets.', { details: setsError.message });
    }

    return createSuccessResponse<SessionSetDto[]>(200, sessionSets || []);

  } catch (e) {
    console.error('Unexpected error in handleGetTrainingSessionSets:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}
