import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '@shared/utils/api-helpers.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const paramsSchema = z.object({
  planId: z.string().uuid(),
});

export async function handleDeleteTrainingPlanById(
  { supabaseClient, rawPathParams, requestInfo, user }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams' | 'requestInfo' | 'user'>
) {
  if (!rawPathParams) {
      return createErrorResponse(500, 'Internal server error: Path parameters missing.', undefined, undefined, undefined, requestInfo);
  }

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    return createErrorResponse(400, 'Invalid path parameters', paramsValidation.error.flatten());
  }
  const { planId } = paramsValidation.data;

  const { error, count } = await supabaseClient
    .from('training_plans')
    .delete({ count: 'exact' })
    .eq('id', planId)
    .eq('user_id', user!.id);

  if (error) {
    console.error('Error deleting training plan:', error);
    return createErrorResponse(500, 'Error deleting training plan', { details: error.message });
  }

  if (count === 0) {
    return createErrorResponse(404, 'Training plan not found.');
  }

  return createSuccessResponse(204, null);
}
