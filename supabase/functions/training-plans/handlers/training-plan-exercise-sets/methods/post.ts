import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import type { ApiHandlerContext } from 'shared/api-handler.ts';
import type { TrainingPlanExerciseSetDto, CreateTrainingPlanExerciseSetCommand } from 'shared/api-types.ts';

const pathParamsSchema = z.object({
  planId: z.string().uuid({ message: 'Invalid Plan ID format' }),
  dayId: z.string().uuid({ message: 'Invalid Day ID format' }),
  exerciseId: z.string().uuid({ message: 'Invalid Exercise ID format' }),
});

const requestBodySchema = z.object({
  expected_reps: z.number().int({ message: 'Expected reps must be an integer.'}).positive({ message: 'Expected reps must be positive.'}),
  expected_weight: z.number().positive({ message: 'Expected weight must be positive.'}),
  set_index: z.number().int({ message: 'Set index must be an integer.'}).positive({ message: 'Set index must be positive.'}).optional(),
});

export async function handleCreateTrainingPlanExerciseSet(
  { supabaseClient, user, rawPathParams, req }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'req'>
) {
  const pathParamsParsed = pathParamsSchema.safeParse(rawPathParams);

  if (!pathParamsParsed.success) {
    return createErrorResponse(400, 'Invalid path parameters', pathParamsParsed.error.flatten());
  }
  const { exerciseId } = pathParamsParsed.data;

  let body;
  try {
    body = await req.json() as CreateTrainingPlanExerciseSetCommand;
  } catch (error) {
    return createErrorResponse(400, 'Invalid JSON body', { details: error.message });
  }

  const bodyParsed = requestBodySchema.safeParse(body);

  if (!bodyParsed.success) {
    return createErrorResponse(400, 'Invalid request body', bodyParsed.error.flatten());
  }
  const validatedBody = bodyParsed.data;

  try {
    const { data: newSetResult, error: rpcError } = await supabaseClient.rpc('create_training_plan_exercise_set', {
      p_user_id: user.id,
      p_training_plan_exercise_id: exerciseId,
      p_expected_reps: validatedBody.expected_reps,
      p_expected_weight: validatedBody.expected_weight,
      p_target_set_index: validatedBody.set_index === undefined ? null : validatedBody.set_index
    });

    if (rpcError) {
      console.error('RPC error create_training_plan_exercise_set:', rpcError);
      if (rpcError.message.includes('not found or user does not have access')) {
        return createErrorResponse(404, 'Failed to create exercise set: Resource not found or access denied.', { details: rpcError.message });
      }
      return createErrorResponse(500, 'Failed to create exercise set via RPC.', { details: rpcError.message });
    }

    if (!newSetResult || newSetResult.length === 0) {
      console.error('RPC create_training_plan_exercise_set did not return the new set or returned an empty array.', newSetResult);
      return createErrorResponse(500, 'RPC create_training_plan_exercise_set did not return the new set as expected.');
    }

    const createdSet = newSetResult[0] as TrainingPlanExerciseSetDto;

    return createSuccessResponse<TrainingPlanExerciseSetDto>(201, createdSet);

  } catch (error) {
    console.error('Error during POST set processing (outside RPC call itself):', error);
    return createErrorResponse(500, 'Internal server error during set creation.', { details: error.message });
  }
}
