import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanExerciseSetDto, UpdateTrainingPlanExerciseSetCommand } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const pathParamsSchema = z.object({
  planId: z.string().uuid({ message: 'Invalid Plan ID format' }),
  dayId: z.string().uuid({ message: 'Invalid Day ID format' }),
  exerciseId: z.string().uuid({ message: 'Invalid Exercise ID format' }),
  setId: z.string().uuid({ message: 'Invalid Set ID format' }),
});

const requestBodySchema = z.object({
  set_index: z.number().int().nonnegative().optional(),
  expected_reps: z.number().int().positive().optional(),
  expected_weight: z.number().positive().optional(),
}).refine(
  (data) => data.set_index !== undefined || data.expected_reps !== undefined || data.expected_weight !== undefined,
  { message: 'At least one field (set_index, expected_reps, or expected_weight) must be provided for update.' }
);

export async function handleUpdateTrainingPlanExerciseSet(
  { supabaseClient, user, rawPathParams, req }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'req'>
) {
  const pathParamsParsed = pathParamsSchema.safeParse(rawPathParams);

  if (!pathParamsParsed.success) {
    return createErrorResponse(400, 'Invalid path parameters', pathParamsParsed.error.flatten());
  }
  const { setId } = pathParamsParsed.data;

  let body;
  try {
    body = await req.json() as UpdateTrainingPlanExerciseSetCommand;
  } catch (error) {
    return createErrorResponse(400, 'Invalid JSON body', { details: (error as Error).message });
  }

  const bodyParsed = requestBodySchema.safeParse(body);

  if (!bodyParsed.success) {
    return createErrorResponse(400, 'Invalid request body', bodyParsed.error.flatten());
  }
  const validatedBody = bodyParsed.data;

  try {
    const rpcCommand = {
      p_user_id: user!.id,
      p_set_id: setId,
      p_expected_reps: validatedBody.expected_reps === undefined ? null : validatedBody.expected_reps,
      p_expected_weight: validatedBody.expected_weight === undefined ? null : validatedBody.expected_weight,
      p_target_set_index: validatedBody.set_index === undefined ? null : validatedBody.set_index
    };

    // @ts-expect-error Parametrized RPC call, not correctly typed in SupabaseClient.d.ts
    const { data: updatedSetResult, error: rpcError } = await supabaseClient.rpc('update_training_plan_exercise_set', rpcCommand).single();

    if (rpcError) {
      console.error('RPC error update_training_plan_exercise_set:', rpcError);
      if (rpcError.message.includes('not found or user does not have access')) {
        return createErrorResponse(404, 'Failed to update exercise set: Resource not found or access denied.', { details: rpcError.message });
      }
      return createErrorResponse(500, 'Failed to update exercise set via RPC.', { details: rpcError.message });
    }

    if (!updatedSetResult) {
      console.error('RPC update_training_plan_exercise_set did not return the updated set or returned an empty array.', updatedSetResult);
      return createErrorResponse(500, 'RPC update_training_plan_exercise_set did not return the updated set as expected.');
    }

    const updatedSet = updatedSetResult as TrainingPlanExerciseSetDto;

    return createSuccessResponse<TrainingPlanExerciseSetDto>(200, updatedSet);

  } catch (error) {
    console.error('Error during PUT set processing (outside RPC call itself):', error);
    return createErrorResponse(500, 'Internal server error during set update.', { details: (error as Error).message });
  }
}
