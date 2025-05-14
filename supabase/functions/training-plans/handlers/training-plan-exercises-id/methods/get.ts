import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanExerciseDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const paramsSchema = z.object({
  planId: z.string().uuid('Invalid Plan ID format'),
  dayId: z.string().uuid('Invalid Day ID format'),
  exerciseId: z.string().uuid('Invalid Training Plan Exercise ID format'),
});

export async function handleGetTrainingPlanExerciseById(
  { supabaseClient, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams'>
): Promise<Response> {

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    const errorDetails = paramsValidation.error.errors.map(err => `${err.path.join('.') || 'path'}: ${err.message}`).join('; ');
    return createErrorResponse(400, `Invalid path parameters: ${errorDetails}`);
  }
  const { dayId, exerciseId } = paramsValidation.data;

  try {
    const { data: data, error: dbError } = await supabaseClient
      .from('training_plan_exercises')
      .select('*, sets:training_plan_exercise_sets(*)')
      .eq('id', exerciseId)
      .eq('training_plan_day_id', dayId)
      .single();

    if (dbError) {
      if (dbError.code === 'PGRST116') {
        return createErrorResponse(404, 'Training plan exercise not found.');
      }
      return createErrorResponse(500, 'Failed to fetch training plan exercise.', { details: dbError.message });
    }

    if (!data) {
      return createErrorResponse(404, 'Training plan exercise not found.');
    }

    data.sets?.sort((a, b) => a.set_index - b.set_index);

    return createSuccessResponse(200, data as TrainingPlanExerciseDto);
  } catch (error) {
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (error as Error).message });
  }
}
