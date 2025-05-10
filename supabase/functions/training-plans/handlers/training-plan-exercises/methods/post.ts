import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import type { ApiHandlerContext } from 'shared/api-types.ts';
import type { TrainingPlanExerciseDto } from 'shared/api-types.ts';

const paramsSchema = z.object({
  planId: z.string().uuid('Invalid Plan ID format'),
  dayId: z.string().uuid('Invalid Day ID format'),
});

const bodySchema = z.object({
  exercise_id: z.string().uuid('Invalid Exercise ID format'),
  order_index: z.number().int().min(1, 'Order index must be a positive integer').optional(),
});

export async function handlePostTrainingPlanExercise(
  { supabaseClient, user, rawPathParams, req, requestInfo }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'req' | 'requestInfo'>
): Promise<Response> {

  if (!user) {
    return createErrorResponse(401, 'User authentication required.', undefined, 'AUTH_REQUIRED', undefined, requestInfo);
  }

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    const errorDetails = paramsValidation.error.errors.map(err => `${err.path.join('.') || 'path'}: ${err.message}`).join('; ');
    return createErrorResponse(400, `Invalid path parameters: ${errorDetails}`);
  }
  const { dayId } = paramsValidation.data;

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

  const { exercise_id, order_index } = commandBody;

  try {
    const { data: newTrainingPlanExercise, error: rpcError } = await supabaseClient.rpc(
      'create_training_plan_exercise',
      {
        p_user_id: user.id,
        p_day_id: dayId,
        p_exercise_id: exercise_id,
        p_target_order_index: order_index,
      }
    ).single();

    if (rpcError) {
      if (rpcError.message.includes('Training plan day not found') || rpcError.message.includes('Training plan not found')) {
        return createErrorResponse(404, rpcError.message, undefined, undefined, rpcError);
      }
      if (rpcError.message.includes('Exercise not found')) {
        return createErrorResponse(400, rpcError.message, undefined, undefined, rpcError);
      }
      return createErrorResponse(500, 'Could not add exercise to training plan day.', undefined, undefined, rpcError);
    }

    if (!newTrainingPlanExercise) {
      return createErrorResponse(500, 'Failed to add exercise, no data returned from RPC.');
    }

    return createSuccessResponse(201, newTrainingPlanExercise as TrainingPlanExerciseDto);
  } catch (error) {
    return createErrorResponse(500, 'An unexpected error occurred.', undefined, undefined, error);
  }
}
