import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/api-helpers.ts';
import type { ApiHandlerContext } from '@shared/api-handler.ts';
import type { TrainingPlanExerciseDto } from '@shared/api-types.ts';

const paramsSchema = z.object({
  planId: z.string().uuid('Invalid Plan ID format'),
  dayId: z.string().uuid('Invalid Day ID format'),
  exerciseId: z.string().uuid('Invalid Training Plan Exercise ID format'),
});

const bodySchema = z.object({
  order_index: z.number().int().min(1, 'Order index must be a positive integer'),
});

export async function handlePutTrainingPlanExerciseById(
  { supabaseClient, rawPathParams, req, user }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams' | 'req' | 'user'>
): Promise<Response> {

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    const errorDetails = paramsValidation.error.errors.map(err => `${err.path.join('.') || 'path'}: ${err.message}`).join('; ');
    return createErrorResponse(400, `Invalid path parameters: ${errorDetails}`);
  }
  const { exerciseId } = paramsValidation.data;

  let commandBody;
  try {
    const body = await req.json();
    const bodyValidation = bodySchema.safeParse(body);
    if (!bodyValidation.success) {
      const errorDetails = bodyValidation.error.errors.map(err => `${err.path.join('.') || 'body'}: ${err.message}`).join('; ');
      return createErrorResponse(400, `Invalid request body: ${errorDetails}`);
    }
    commandBody = bodyValidation.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(400, 'Invalid JSON format in request body.');
    }
    return createErrorResponse(500, 'Failed to process request body.', undefined, undefined, error);
  }

  const { order_index: newOrderIndex } = commandBody;

  const rpcCommand = {
    p_user_id: user!.id,
    p_plan_exercise_id: exerciseId,
    p_target_order_index: newOrderIndex,
  };

  try {
    // @ts-expect-error Parametrized RPC call, not correctly typed in SupabaseClient.d.ts
    const { data: updatedExercise, error: rpcError } = await supabaseClient.rpc('update_training_plan_exercise_order', rpcCommand).single();

    if (rpcError) {
      if (rpcError.message.includes('not found') || rpcError.code === 'PGRST116') {
        return createErrorResponse(404, 'Training plan exercise not found or not authorized.');
      }
      return createErrorResponse(500, 'Could not update training plan exercise.', { details: rpcError.message });
    }

    if (!updatedExercise) {
      return createErrorResponse(404, 'Failed to update training plan exercise, record not found or no change made.');
    }

    return createSuccessResponse(200, updatedExercise as TrainingPlanExerciseDto);
  } catch (error) {
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (error as Error).message });
  }
}
