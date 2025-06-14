import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingSessionDto, UpdateTrainingSessionCommand } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const PathParamsSchema = z.object({
  sessionId: z.string().uuid({ message: 'Invalid session ID format in path' }),
});

const UpdateTrainingSessionCommandSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
    errorMap: () => ({ message: 'Invalid status value. Must be one of PENDING, IN_PROGRESS, COMPLETED, CANCELLED.' })
  }),
  session_date: z.string().datetime({ message: 'Invalid session date format' }).optional().nullable()
});

export async function handlePutTrainingSessionById(
  { supabaseClient, user, req, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'req' | 'rawPathParams'>
) {
  const pathValidationResult = PathParamsSchema.safeParse(rawPathParams);
  if (!pathValidationResult.success) {
    return createErrorResponse(400, 'Invalid session ID in path', pathValidationResult.error.flatten());
  }
  const { sessionId } = pathValidationResult.data;

  let command: UpdateTrainingSessionCommand;
  try {
    const body = await req.json();
    command = UpdateTrainingSessionCommandSchema.parse(body);
  } catch (error) {
    const validationErrors = error instanceof z.ZodError ? error.flatten() : undefined;
    return createErrorResponse(400, 'Invalid request body', validationErrors);
  }

  const userId = user!.id;

  try {
    const { data: updatedSession, error } = await supabaseClient
      .from('training_sessions')
      .update({ status: command.status, session_date: command.session_date })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating training session ${sessionId} for user ${userId}:`, error);
      if (error.code === 'PGRST116') {
        return createErrorResponse(404, 'Training session not found or not authorized to update.');
      }
      return createErrorResponse(500, 'Failed to update training session', { details: error.message });
    }

    if (!updatedSession) {
      return createErrorResponse(404, 'Training session not found or not authorized to update.');
    }

    return createSuccessResponse<TrainingSessionDto>(200, updatedSession);

  } catch (error) {
    console.error('Unexpected error in handlePutTrainingSessionById:', error);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (error as Error).message });
  }
}
