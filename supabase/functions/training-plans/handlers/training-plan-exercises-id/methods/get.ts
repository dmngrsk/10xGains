import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import type { ApiHandlerContext } from 'shared/api-types.ts';
import type { TrainingPlanExerciseDto } from 'shared/api-types.ts';

const paramsSchema = z.object({
  planId: z.string().uuid('Invalid Plan ID format'),
  dayId: z.string().uuid('Invalid Day ID format'),
  exerciseId: z.string().uuid('Invalid Training Plan Exercise ID format'),
});

export async function handleGetTrainingPlanExerciseById(
  { supabaseClient, user, rawPathParams, requestInfo }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'requestInfo'>
): Promise<Response> {

  if (!user) {
    return createErrorResponse(401, 'User authentication required.', undefined, 'AUTH_REQUIRED', undefined, requestInfo);
  }

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    const errorDetails = paramsValidation.error.errors.map(err => `${err.path.join('.') || 'path'}: ${err.message}`).join('; ');
    return createErrorResponse(400, `Invalid path parameters: ${errorDetails}`);
  }
  const { dayId, exerciseId } = paramsValidation.data;

  try {
    const { data: trainingPlanExercise, error: dbError } = await supabaseClient
      .from('training_plan_exercises')
      .select('*, sets:training_plan_exercise_sets(*)')
      .eq('id', exerciseId)
      .eq('training_plan_day_id', dayId)
      .single();

    if (dbError) {
      if (dbError.code === 'PGRST116') {
        return createErrorResponse(404, 'Training plan exercise not found.');
      }
      return createErrorResponse(500, 'Failed to fetch training plan exercise.', undefined, undefined, dbError);
    }

    if (!trainingPlanExercise) {
      return createErrorResponse(404, 'Training plan exercise not found.');
    }

    return createSuccessResponse(200, trainingPlanExercise as TrainingPlanExerciseDto);
  } catch (error) {
    return createErrorResponse(500, 'An unexpected error occurred.', undefined, undefined, error);
  }
}
