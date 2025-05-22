import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingSessionDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const PathParamsSchema = z.object({
  sessionId: z.string().uuid({ message: 'Invalid session ID format in path' }),
});

export async function handleGetTrainingSessionById(
  { supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams'>
) {
  const validationResult = PathParamsSchema.safeParse(rawPathParams);

  if (!validationResult.success) {
    return createErrorResponse(400, 'Invalid session ID in path', validationResult.error.flatten());
  }

  const { sessionId } = validationResult.data;
  const userId = user!.id;

  try {
    const { data: session, error } = await supabaseClient
      .from('training_sessions')
      .select('*, sets:session_sets!session_sets_training_session_id_fkey(*)')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error(`Error fetching training session ${sessionId} for user ${userId}:`, error);
      if (error.code === 'PGRST116') {
         return createErrorResponse(404, 'Training session not found.');
      }
      return createErrorResponse(500, 'Failed to retrieve training session', { details: error.message });
    }

    if (!session) {
      return createErrorResponse(404, 'Training session not found.');
    }

    session.sets?.sort((a, b) =>
      a.training_plan_exercise_id.localeCompare(b.training_plan_exercise_id) ||
      a.set_index - b.set_index
    )

    return createSuccessResponse<TrainingSessionDto>(200, session as TrainingSessionDto);

  } catch (e) {
    console.error('Unexpected error in handleGetTrainingSessionById:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}
