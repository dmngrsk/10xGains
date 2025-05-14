import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanExerciseDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const paramsSchema = z.object({
  planId: z.string().uuid(),
  dayId: z.string().uuid(),
});

export async function handleGetTrainingPlanExercises(
  { supabaseClient, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams'>
): Promise<Response> {

  const validationResult = paramsSchema.safeParse(rawPathParams);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.errors.map(err => `${err.path.join('.') || 'path'}: ${err.message}`).join('; ');
    return createErrorResponse(400, `Invalid path parameters: ${errorDetails}`);
  }
  const { dayId } = validationResult.data;

  try {
    const { data, error } = await supabaseClient
      .from('training_plan_exercises')
      .select('*, sets:training_plan_exercise_sets(*)')
      .eq('training_plan_day_id', dayId)
      .order('order_index', { ascending: true });

    if (error) {
      return createErrorResponse(500, 'Failed to fetch training plan exercises', { details: error.message });
    }

    data?.forEach(exercise => {
      exercise.sets?.sort((a, b) => a.set_index - b.set_index);
    });

    return createSuccessResponse<TrainingPlanExerciseDto[]>(200, data ?? []);
  } catch (error) {
    return createErrorResponse(500, 'An unexpected error occurred', { details: (error as Error).message });
  }
}
