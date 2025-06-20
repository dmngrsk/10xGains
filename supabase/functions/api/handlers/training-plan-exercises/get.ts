import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseDto, TrainingPlanExerciseSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid(),
  dayId: z.string().uuid(),
});

export async function handleGetTrainingPlanExercises(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');

  try {
    const { data, error } = await supabaseClient
      .from('training_plan_exercises')
      .select('*, sets:training_plan_exercise_sets(*)')
      .eq('training_plan_day_id', path!.dayId)
      .order('order_index', { ascending: true });

    if (error) {
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch training plan exercises', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    data?.forEach((exercise: TrainingPlanExerciseDto) => {
      exercise.sets?.sort((a: TrainingPlanExerciseSetDto, b: TrainingPlanExerciseSetDto) => a.set_index - b.set_index);
    });

    const successData = createSuccessData<TrainingPlanExerciseDto[]>(data ?? []);
    return c.json(successData, 200);
  } catch (error) {
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
