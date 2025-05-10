import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import type { ApiHandlerContext } from 'shared/api-handler.ts';
import type { TrainingPlanExerciseSetDto } from 'shared/api-types.ts';

const pathParamsSchema = z.object({
  planId: z.string().uuid({ message: 'Invalid Plan ID format' }),
  dayId: z.string().uuid({ message: 'Invalid Day ID format' }),
  exerciseId: z.string().uuid({ message: 'Invalid Exercise ID format' }),
});

export async function handleGetTrainingPlanExerciseSets(
  { supabaseClient, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams'>
) {
  const pathParamsParsed = pathParamsSchema.safeParse(rawPathParams);

  if (!pathParamsParsed.success) {
    return createErrorResponse(400, 'Invalid path parameters', pathParamsParsed.error.flatten());
  }

  const { exerciseId: trainingPlanExerciseIdFromPath } = pathParamsParsed.data;

  try {
    const { data: sets, error: setsError } = await supabaseClient
      .from('training_plan_exercise_sets')
      .select('*')
      .eq('training_plan_exercise_id', trainingPlanExerciseIdFromPath)
      .order('set_index', { ascending: true });

    if (setsError) {
      console.error('Error fetching exercise sets:', setsError);
      return createErrorResponse(500, 'Failed to fetch exercise sets', { details: setsError.message });
    }

    return createSuccessResponse<TrainingPlanExerciseSetDto[]>(200, sets ?? []);

  } catch (error) {
    console.error('Error during GET all sets processing:', error);
    return createErrorResponse(500, 'Internal server error during all sets retrieval.', { details: error.message });
  }
}
