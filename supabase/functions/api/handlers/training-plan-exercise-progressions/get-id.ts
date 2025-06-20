import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseProgressionDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

export async function handleGetTrainingPlanExerciseProgression(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { data: trainingPlan, error: planError } = await supabaseClient
      .from('training_plans')
      .select('id')
      .eq('id', path!.planId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (planError) {
      console.error('Error verifying training plan:', planError);
      const errorData = createErrorDataWithLogging(500, 'Error verifying training plan.', { details: planError.message }, undefined, planError);
      return c.json(errorData, 500);
    }

    if (!trainingPlan) {
      const errorData = createErrorDataWithLogging(404, 'Training plan not found or access denied.');
      return c.json(errorData, 404);
    }

    const { data: exercise, error: exerciseError } = await supabaseClient
      .from('exercises')
      .select('id')
      .eq('id', path!.exerciseId)
      .maybeSingle();

    if (exerciseError) {
      console.error('Error verifying exercise:', exerciseError);
      const errorData = createErrorDataWithLogging(500, 'Error verifying exercise.', { details: exerciseError.message }, undefined, exerciseError);
      return c.json(errorData, 500);
    }

    if (!exercise) {
      const errorData = createErrorDataWithLogging(404, 'Exercise not found.');
      return c.json(errorData, 404);
    }

    const { data: progression, error: progressionError } = await supabaseClient
      .from('training_plan_exercise_progressions')
      .select('*')
      .eq('training_plan_id', path!.planId)
      .eq('exercise_id', path!.exerciseId)
      .maybeSingle();

    if (progressionError) {
      console.error('Error fetching training plan exercise progression:', progressionError);
      const errorData = createErrorDataWithLogging(500, 'Error fetching progression data.', { details: progressionError.message }, undefined, progressionError);
      return c.json(errorData, 500);
    }

    if (!progression) {
      const errorData = createErrorDataWithLogging(404, 'Training plan exercise progression not found.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingPlanExerciseProgressionDto>(progression);
    return c.json(successData, 200);

  } catch (e) {
    console.error('Unexpected error in handleGetTrainingPlanExerciseProgression:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
