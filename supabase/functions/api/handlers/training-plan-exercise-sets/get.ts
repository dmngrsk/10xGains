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
});

export async function handleGetTrainingPlanExerciseSets(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');

  try {
    const { data: sets, error: setsError } = await supabaseClient
      .from('training_plan_exercise_sets')
      .select('*')
      .eq('training_plan_exercise_id', path!.exerciseId)
      .order('set_index', { ascending: true });

    if (setsError) {
      console.error('Error fetching exercise sets:', setsError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch exercise sets', { details: setsError.message }, undefined, setsError);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<TrainingPlanExerciseSetDto[]>(sets ?? []);
    return c.json(successData, 200);

  } catch (error) {
    console.error('Error during GET all sets processing:', error);
    const errorData = createErrorDataWithLogging(500, 'Internal server error during all sets retrieval.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
