import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import { z } from 'zod';
import type { ApiHandlerContext } from 'shared/api-routing.ts';
import type { TrainingPlanDto } from 'shared/api-types.ts';

const paramsSchema = z.object({
  planId: z.string().uuid(),
});

export async function handleGetTrainingPlanById(
  { supabaseClient, rawPathParams, requestInfo, user }: ApiHandlerContext 
) {
  if (!rawPathParams) {
      return createErrorResponse(500, 'Internal server error: Path parameters missing.', undefined, undefined, undefined, requestInfo);
  }

  if (!user) {
    return createErrorResponse(401, 'Unauthorized: User not authenticated.', undefined, undefined, undefined, requestInfo);
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

  const { data, error } = await supabaseClient
    .from('training_plans')
    .select(`
      *,
      days:training_plan_days (
        *,
        exercises:training_plan_exercises (
          *,
          sets:training_plan_exercise_sets (
            *
          )
        )
      )
    `)
    .eq('id', planId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return createErrorResponse(404, 'Training plan not found.', undefined, undefined, undefined, requestInfo);
    }
    console.error('Error fetching training plan by ID:', error);
    return createErrorResponse(500, 'Failed to fetch training plan by ID.', { details: error.message }, undefined, error, requestInfo);
  }

  if (!data) {
    return createErrorResponse(404, 'Training plan not found.', undefined, undefined, undefined, requestInfo);
  }

  return createSuccessResponse<TrainingPlanDto>(200, data as TrainingPlanDto, 'Training plan retrieved successfully.');
} 