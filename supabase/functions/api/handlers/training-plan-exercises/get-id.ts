import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseDto, TrainingPlanExerciseSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

export async function handleGetTrainingPlanExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');

  try {
    const { data, error } = await supabaseClient
      .from('training_plan_exercises')
      .select('*, sets:training_plan_exercise_sets(*)')
      .eq('id', path!.exerciseId)
      .eq('training_plan_day_id', path!.dayId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Training plan exercise not found.', undefined, error.code, error);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch training plan exercise.', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    if (!data) {
      const errorData = createErrorDataWithLogging(404, 'Training plan exercise not found.');
      return c.json(errorData, 404);
    }

    data.sets?.sort((a: TrainingPlanExerciseSetDto, b: TrainingPlanExerciseSetDto) => a.set_index - b.set_index);

    const successData = createSuccessData(data as TrainingPlanExerciseDto);
    return c.json(successData, 200);
  } catch (error) {
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
