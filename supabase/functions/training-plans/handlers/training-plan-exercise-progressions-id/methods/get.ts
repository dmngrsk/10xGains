import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanExerciseProgressionDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const paramsSchema = z.object({
  planId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export async function handleGetTrainingPlanExerciseProgression(
  { supabaseClient, rawPathParams, requestInfo, user }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams' | 'requestInfo' | 'user'>
) {
  if (!rawPathParams) {
    return createErrorResponse(500, 'Internal server error: Path parameters missing.');
  }

  const paramsValidation = paramsSchema.safeParse(rawPathParams);
  if (!paramsValidation.success) {
    return createErrorResponse(
      400,
      'Invalid path parameters.',
      paramsValidation.error.flatten(),
      undefined,
      undefined,
      requestInfo
    );
  }
  const { planId, exerciseId } = paramsValidation.data;

  try {
    const { data: trainingPlan, error: planError } = await supabaseClient
      .from('training_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (planError) {
      console.error('Error verifying training plan:', planError);
      return createErrorResponse(500, 'Error verifying training plan.', { details: planError.message });
    }

    if (!trainingPlan) {
      return createErrorResponse(404, 'Training plan not found or access denied.');
    }

    const { data: exercise, error: exerciseError } = await supabaseClient
      .from('exercises')
      .select('id')
      .eq('id', exerciseId)
      .maybeSingle();

    if (exerciseError) {
      console.error('Error verifying exercise:', exerciseError);
      return createErrorResponse(500, 'Error verifying exercise.', { details: exerciseError.message });
    }

    if (!exercise) {
      return createErrorResponse(404, 'Exercise not found.');
    }

    const { data: progression, error: progressionError } = await supabaseClient
      .from('training_plan_exercise_progressions')
      .select('*')
      .eq('training_plan_id', planId)
      .eq('exercise_id', exerciseId)
      .maybeSingle();

    if (progressionError) {
      console.error('Error fetching training plan exercise progression:', progressionError);
      return createErrorResponse(500, 'Error fetching progression data.', { details: progressionError.message });
    }

    if (!progression) {
      return createErrorResponse(404, 'Training plan exercise progression not found.');
    }

    return createSuccessResponse<TrainingPlanExerciseProgressionDto>(200, progression);

  } catch (e) {
    console.error('Unexpected error in handleGetTrainingPlanExerciseProgression:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}
