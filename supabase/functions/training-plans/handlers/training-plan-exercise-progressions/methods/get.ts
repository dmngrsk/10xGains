import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanExerciseProgressionDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const paramsSchema = z.object({
  planId: z.string().uuid(),
});

export async function handleGetTrainingPlanExerciseProgressions(
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
  const { planId } = paramsValidation.data;

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

    const { data: progressions, error: progressionsError } = await supabaseClient
      .from('training_plan_exercise_progressions')
      .select('*')
      .eq('training_plan_id', planId);

    if (progressionsError) {
      console.error('Error fetching training plan exercise progressions:', progressionsError);
      return createErrorResponse(500, 'Error fetching progression data.', { details: progressionsError.message });
    }

    if (!progressions) {
      return createErrorResponse(404, 'Training plan exercise progressions not found.');
    }

    return createSuccessResponse<TrainingPlanExerciseProgressionDto[]>(200, progressions);
  } catch (e) {
    console.error('Unexpected error in handleGetTrainingPlanExerciseProgressions:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}
