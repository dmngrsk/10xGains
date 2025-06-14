import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanExerciseSetDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const pathParamsSchema = z.object({
  planId: z.string().uuid({ message: 'Invalid Plan ID format' }),
  dayId: z.string().uuid({ message: 'Invalid Day ID format' }),
  exerciseId: z.string().uuid({ message: 'Invalid Exercise ID format' }),
  setId: z.string().uuid({ message: 'Invalid Set ID format' }),
});

export async function handleGetTrainingPlanExerciseSetById(
  { supabaseClient, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams'>
) {
  const pathParamsParsed = pathParamsSchema.safeParse(rawPathParams);

  if (!pathParamsParsed.success) {
    return createErrorResponse(400, 'Invalid path parameters', pathParamsParsed.error.flatten());
  }
  const { exerciseId, setId } = pathParamsParsed.data;

  try {
    const { data, error } = await supabaseClient
      .from('training_plan_exercise_sets')
      .select('*')
      .eq('id', setId)
      .eq('training_plan_exercise_id', exerciseId)
      .single();

    if (error || !data) {
      if (error && error.code === 'PGRST116' || !data) {
        return createErrorResponse(404, `Exercise set with ID ${setId} not found for exercise ${exerciseId}.`);
      }
      console.error(`Error fetching exercise set with ID ${setId}:`, error);
      return createErrorResponse(500, `Failed to fetch exercise set with ID ${setId}.`, { details: (error as Error).message });
    }

    return createSuccessResponse<TrainingPlanExerciseSetDto>(200, data as TrainingPlanExerciseSetDto);

  } catch (error) {
    console.error('Error during GET set by ID processing:', error);
    return createErrorResponse(500, 'Internal server error during set retrieval.', { details: (error as Error).message });
  }
}
