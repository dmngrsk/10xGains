import { z } from 'zod';
import type { ApiHandlerContext } from '@shared/api-handler.ts';
import { createErrorResponse, createSuccessResponse } from '@shared/api-helpers.ts';

const pathParamsSchema = z.object({
  planId: z.string().uuid({ message: 'Invalid Plan ID format' }),
  dayId: z.string().uuid({ message: 'Invalid Day ID format' }),
  exerciseId: z.string().uuid({ message: 'Invalid Exercise ID format' }),
  setId: z.string().uuid({ message: 'Invalid Set ID format' }),
});

export async function handleDeleteTrainingPlanExerciseSet(
  { supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams'>
) {
  const pathParamsParsed = pathParamsSchema.safeParse(rawPathParams);

  if (!pathParamsParsed.success) {
    return createErrorResponse(400, 'Invalid path parameters', pathParamsParsed.error.flatten());
  }
  const { setId } = pathParamsParsed.data;

  try {
    const rpcCommand = {
      p_user_id: user!.id,
      p_set_id: setId
    };

    // @ts-expect-error Parametrized RPC call, not correctly typed in SupabaseClient.d.ts
    const { error: rpcError } = await supabaseClient.rpc('delete_training_plan_exercise_set', rpcCommand);

    if (rpcError) {
      console.error('RPC error delete_training_plan_exercise_set:', rpcError);
      if (rpcError.message.includes('not found or user does not have access')) {
        return createErrorResponse(404, 'Exercise set not found or access denied.', { details: rpcError.message });
      }
      return createErrorResponse(500, 'Failed to delete exercise set via RPC.', { details: rpcError.message });
    }

    return createSuccessResponse(204, null);

  } catch (error) {
    console.error('Error during DELETE set processing (outside RPC call itself):', error);
    return createErrorResponse(500, 'Internal server error during set deletion.', { details: (error as Error).message });
  }
}
