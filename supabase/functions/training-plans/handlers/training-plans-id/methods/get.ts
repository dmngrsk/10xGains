import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const paramsSchema = z.object({
  planId: z.string().uuid(),
});

export async function handleGetTrainingPlanById(
  { supabaseClient, rawPathParams, user }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams' | 'user'>
) {
  if (!rawPathParams) {
      return createErrorResponse(500, 'Internal server error: Path parameters missing.');
  }

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    return createErrorResponse(400, 'Invalid path parameters', paramsValidation.error.flatten());
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
    .eq('user_id', user!.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return createErrorResponse(404, 'Training plan not found.');
    }
    console.error('Error fetching training plan by ID:', error);
    return createErrorResponse(500, 'Failed to fetch training plan by ID.', { details: error.message });
  }

  if (!data) {
    return createErrorResponse(404, 'Training plan not found.');
  }

  data.days?.sort((a, b) => a.order_index - b.order_index);
  data.days?.forEach(day => {
    day.exercises?.sort((a, b) => a.order_index - b.order_index);
    day.exercises?.forEach(exercise => {
      exercise.sets?.sort((a, b) => a.set_index - b.set_index);
    });
  });

  return createSuccessResponse<TrainingPlanDto>(200, data as TrainingPlanDto);
}
