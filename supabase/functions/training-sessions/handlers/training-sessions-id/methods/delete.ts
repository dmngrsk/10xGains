import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const PathParamsSchema = z.object({
  sessionId: z.string().uuid({ message: 'Invalid session ID format in path' }),
});

export async function handleDeleteTrainingSessionById(
  { supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams'>
) {
  const pathValidationResult = PathParamsSchema.safeParse(rawPathParams);
  if (!pathValidationResult.success) {
    return createErrorResponse(400, 'Invalid session ID in path', pathValidationResult.error.flatten());
  }
  const { sessionId } = pathValidationResult.data;
  const userId = user!.id;

  try {
    const { error, data } = await supabaseClient
      .from('training_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error(`Error deleting training session ${sessionId} for user ${userId}:`, error);
      return createErrorResponse(500, 'Failed to delete training session', { details: error.message });
    }

    if (!data) {
      return createErrorResponse(404, 'Training session not found or not authorized to delete.');
    }

    return createSuccessResponse(204, null);

  } catch (e: any) {
    console.error('Unexpected error in handleDeleteTrainingSessionById:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: e.message });
  }
}
