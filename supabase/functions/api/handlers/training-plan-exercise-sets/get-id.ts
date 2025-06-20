import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
  setId: z.string().uuid('Invalid setId format'),
});

export async function handleGetTrainingPlanExerciseSetById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');

  try {
    const { data, error } = await supabaseClient
      .from('training_plan_exercise_sets')
      .select('*')
      .eq('id', path!.setId)
      .eq('training_plan_exercise_id', path!.exerciseId)
      .single();

    if (error || !data) {
      if (error && error.code === 'PGRST116' || !data) {
        const errorData = createErrorDataWithLogging(404, `Exercise set with ID ${path!.setId} not found for exercise ${path!.exerciseId}.`, undefined, error?.code, error);
        return c.json(errorData, 404);
      }
      console.error(`Error fetching exercise set with ID ${path!.setId}:`, error);
      const errorData = createErrorDataWithLogging(500, `Failed to fetch exercise set with ID ${path!.setId}.`, { details: (error as Error).message }, undefined, error);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<TrainingPlanExerciseSetDto>(data as TrainingPlanExerciseSetDto);
    return c.json(successData, 200);

  } catch (error) {
    console.error('Error during GET set by ID processing:', error);
    const errorData = createErrorDataWithLogging(500, 'Internal server error during set retrieval.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
