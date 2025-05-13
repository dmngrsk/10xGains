import { createErrorResponse, createSuccessResponse } from '@shared/api-helpers.ts';
import { z } from 'zod';
import type { ApiHandlerContext } from '@shared/api-handler.ts';
import type { UpdateTrainingPlanCommand, TrainingPlanDto } from '@shared/api-types.ts';

const paramsSchema = z.object({
  planId: z.string().uuid(),
});

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
});

export async function handlePutTrainingPlanById(
  { supabaseClient, req, rawPathParams, user }: Pick<ApiHandlerContext, 'supabaseClient' | 'req' | 'rawPathParams' | 'user'>
) {
  if (!rawPathParams) {
      return createErrorResponse(500, 'Internal server error: Path parameters missing.');
  }

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    return createErrorResponse(400, 'Invalid path parameters', paramsValidation.error.flatten());
  }
  const { planId } = paramsValidation.data;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    console.error('Error parsing JSON body:', e);
    return createErrorResponse(400, 'Invalid JSON body', { details: (e as Error).message });
  }

  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    return createErrorResponse(400, 'Invalid request body', bodyValidation.error.flatten());
  }
  const validatedCommand = bodyValidation.data as UpdateTrainingPlanCommand;

  const { data, error } = await supabaseClient
    .from('training_plans')
    .update({
      name: validatedCommand.name,
      description: validatedCommand.description,
    })
    .eq('id', planId)
    .eq('user_id', user!.id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return createErrorResponse(404, 'Training plan not found.');
    }
    console.error('Error updating training plan:', error);
    return createErrorResponse(500, 'Failed to update training plan.', { details: error.message });
  }

  if (!data) {
    return createErrorResponse(404, 'Training plan not found or update failed (no data returned).');
  }

  return createSuccessResponse<TrainingPlanDto>(200, data as TrainingPlanDto);
}
