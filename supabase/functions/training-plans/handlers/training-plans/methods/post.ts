import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { CreateTrainingPlanCommand, TrainingPlanDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

export const createTrainingPlanBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
});

export async function handleCreateTrainingPlan(
  { supabaseClient, user, req }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'req'>
): Promise<Response> {

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return createErrorResponse(400, 'Invalid JSON body', { details: (e as Error).message });
  }

  const validationResult = createTrainingPlanBodySchema.safeParse(body);
  if (!validationResult.success) {
    return createErrorResponse(400, 'Invalid request body', validationResult.error.flatten());
  }

  const validatedData = validationResult.data as CreateTrainingPlanCommand;
  const newPlanData = {
    name: validatedData.name,
    description: validatedData.description ?? null,
    user_id: user!.id,
  };

  try {
    const { data, error: dbError } = await supabaseClient
      .from('training_plans')
      .insert(newPlanData)
      .select()
      .single();

    if (dbError) {
      return createErrorResponse(500, 'Failed to create training plan', { details: dbError.message });
    }

      return createSuccessResponse<TrainingPlanDto>(201, data as TrainingPlanDto);
  } catch (e) {
    return createErrorResponse(500, 'An unexpected error occurred while creating training plan', { details: (e as Error).message });
  }
}
