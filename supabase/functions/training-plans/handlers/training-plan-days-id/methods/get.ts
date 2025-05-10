import { z } from 'zod';
import type { ApiHandlerContext } from 'shared/api-handler.ts';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import type { TrainingPlanDayDto } from 'shared/api-types.ts';

export async function handleGetTrainingPlanDayById(
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
  const { planId, dayId } = paramsValidation.data;

  try {
    const { data: plan, error: planError } = await supabaseClient
      .from('training_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single();

    if (planError || !plan) {
      return createErrorResponse(404, 'Training plan not found or user does not have access.', undefined, undefined, planError);
    }

    const { data: day, error: dayError } = await supabaseClient
      .from('training_plan_days')
      .select(`
        *,
        exercises:training_plan_exercises(
          *,
          sets:training_plan_exercise_sets(
            *
          )
        )
      `)
      .eq('id', dayId)
      .eq('training_plan_id', planId)
      .single();

    if (dayError || !day) {
      if (dayError && dayError.code === 'PGRST116' || !day) {
        return createErrorResponse(404, 'Training plan day not found.', undefined, undefined, dayError);
      }
      console.error('Error fetching training plan day detail:', dayError);
      return createErrorResponse(500, 'Could not fetch training plan day.', undefined, undefined, dayError);
    }

    return createSuccessResponse<TrainingPlanDayDto>(200, day);

  } catch (error) {
    console.error('Unexpected error in handleGetTrainingPlanDayById:', error);
    return createErrorResponse(500, 'An unexpected error occurred.', undefined, undefined, error);
  }
}
