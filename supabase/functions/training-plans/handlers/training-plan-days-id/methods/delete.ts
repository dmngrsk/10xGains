import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

export async function handleDeleteTrainingPlanDayById(
  { supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams'>
) {
  const paramsValidation = z.object({
    planId: z.string().uuid({ message: 'Invalid planId format.' }),
    dayId: z.string().uuid({ message: 'Invalid dayId format.' }),
  }).safeParse(rawPathParams);

  if (!paramsValidation.success) {
    const errorDetails = paramsValidation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
    return createErrorResponse(400, `Invalid path parameters: ${errorDetails}`);
  }
  const { dayId } = paramsValidation.data;

  const rpcCommand = {
    p_user_id: user!.id,
    p_day_id: dayId,
  };

  try {
    // @ts-expect-error Parametrized RPC call, not correctly typed in SupabaseClient.d.ts
    const { error: rpcError } = await supabaseClient.rpc('delete_training_plan_day', rpcCommand);

    if (rpcError) {
      console.error('RPC error deleting training plan day:', rpcError);
      if (rpcError.message.includes('training plan day not found')) {
        return createErrorResponse(404, 'Training plan day not found or no access.', { details: rpcError.message });
      }
      return createErrorResponse(500, 'Could not delete training plan day.', { details: rpcError.message });
    }

    return createSuccessResponse(204, null);

  } catch (error) {
    console.error('Unexpected error in handleDeleteTrainingPlanDay:', error);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (error as Error).message });
  }
}
