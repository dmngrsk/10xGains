import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseProgressionDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

export async function handleGetTrainingPlanExerciseProgressions(c: Context<AppContext>) {
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

    const { data: progressions, error: progressionsError } = await supabaseClient
      .from('training_plan_exercise_progressions')
      .select('*')
      .eq('training_plan_id', path!.planId);

    if (progressionsError) {
      console.error('Error fetching training plan exercise progressions:', progressionsError);
      const errorData = createErrorDataWithLogging(500, 'Error fetching progression data.', { details: progressionsError.message }, undefined, progressionsError);
      return c.json(errorData, 500);
    }

    if (!progressions) {
      const errorData = createErrorDataWithLogging(404, 'Training plan exercise progressions not found.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingPlanExerciseProgressionDto[]>(progressions);
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleGetTrainingPlanExerciseProgressions:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
