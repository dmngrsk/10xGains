import { createSuccessResponse, createErrorResponse } from 'shared/api-helpers.ts';
import { z } from 'zod';
import type { ApiHandlerContext } from 'shared/api-routing.ts';

const paramsSchema = z.object({
  planId: z.string().uuid(),
});

export async function handleDeleteTrainingPlanById(
  { supabaseClient, rawPathParams, requestInfo, user }: ApiHandlerContext
) {
  if (!rawPathParams) {
      return createErrorResponse(500, 'Internal server error: Path parameters missing.', undefined, undefined, undefined, requestInfo);
  }

  if (!user) {
      return createErrorResponse(401, 'User authentication required.', undefined, 'AUTH_REQUIRED', undefined, requestInfo);
  }

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    return createErrorResponse(
      400,
      'Invalid path parameters',
      paramsValidation.error.flatten(),
      undefined,
      undefined,
      requestInfo
    );
  }
  const { planId } = paramsValidation.data;

  const { error, count } = await supabaseClient
    .from('training_plans')
    .delete({ count: 'exact' })
    .eq('id', planId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting training plan:', error);
    return createErrorResponse(500, 'Error deleting training plan', { details: error.message }, undefined, error, requestInfo);
  }

  if (count === 0) {
    return createErrorResponse(404, 'Training plan not found.', undefined, undefined, undefined, requestInfo);
  }

  return createSuccessResponse(204, null);
}