import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

export async function handleGetTrainingPlanById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { data, error } = await supabaseClient
      .from('training_plans')
      .select(`
        *,
        days:training_plan_days (
          *,
          exercises:training_plan_exercises (
            *,
            sets:training_plan_exercise_sets (
              *
            )
          )
        ),
        progressions:training_plan_exercise_progressions (
          *
        )
      `)
      .eq('id', path!.planId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching training plan:', error);
      if (error.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Training plan not found', undefined, error.code, error);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch training plan', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<TrainingPlanDto>(data as TrainingPlanDto);
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleGetTrainingPlanById:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
