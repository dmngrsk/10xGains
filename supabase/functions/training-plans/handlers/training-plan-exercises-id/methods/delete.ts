import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import type { ApiHandlerContext } from 'shared/api-types.ts';

const paramsSchema = z.object({
  planId: z.string().uuid('Invalid Plan ID format'),
  dayId: z.string().uuid('Invalid Day ID format'),
  exerciseId: z.string().uuid('Invalid Training Plan Exercise ID format'),
});

export async function handleDeleteTrainingPlanExerciseById(
  { supabaseClient, user, rawPathParams, requestInfo }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'requestInfo'>
): Promise<Response> {

  if (!user) {
    return createErrorResponse(401, 'User authentication required.', undefined, 'AUTH_REQUIRED', undefined, requestInfo);
  }

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    const errorDetails = paramsValidation.error.errors.map(err => `${err.path.join('.') || 'path'}: ${err.message}`).join('; ');
    return createErrorResponse(400, `Invalid path parameters: ${errorDetails}`);
  }
  const { exerciseId } = paramsValidation.data;

  try {
    const { error: rpcError, status } = await supabaseClient.rpc(
      'delete_training_plan_exercise',
      {
        p_user_id: user.id,
        p_plan_exercise_id: exerciseId,
      }
    );

    if (rpcError) {
      if (rpcError.message.includes('not found') || rpcError.code === 'PGRST116') {
        return createErrorResponse(404, 'Training plan exercise not found or not authorized to delete.', undefined, undefined, rpcError);
      }
      return createErrorResponse(500, 'Could not delete training plan exercise.', undefined, undefined, rpcError);
    }

    if (status === 204 || (status >= 200 && status < 300 && !rpcError)) {
      return createSuccessResponse(204);
    } else if (status === 404) {
      return createErrorResponse(404, 'Training plan exercise not found or not authorized to delete.');
    }

    return createSuccessResponse(204);

  } catch (error) {
    return createErrorResponse(500, 'An unexpected error occurred.', undefined, undefined, error);
  }
}
