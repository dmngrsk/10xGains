import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanDayDto, TrainingPlanExerciseDto, TrainingPlanExerciseSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

export async function handleGetTrainingPlanDayById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { data: plan, error: planError } = await supabaseClient
      .from('training_plans')
      .select('id')
      .eq('id', path!.planId)
      .eq('user_id', user.id)
      .single();

    if (planError || !plan) {
      const errorData = createErrorDataWithLogging(404, 'Training plan not found or user does not have access.', { details: planError?.message }, undefined, planError);
      return c.json(errorData, 404);
    }

    const { data, error } = await supabaseClient
      .from('training_plan_days')
      .select(`
        *,
        exercises:training_plan_exercises(
          *,
          sets:training_plan_exercise_sets(
            *
          )
        )
      `)
      .eq('id', path!.dayId)
      .eq('training_plan_id', path!.planId)
      .single();

    if (error || !data) {
      if (error && error.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Training plan day not found.', { details: error.message }, undefined, error);
        return c.json(errorData, 404);
      }
      console.error('Error fetching training plan day detail:', error);
      const errorData = createErrorDataWithLogging(500, 'Could not fetch training plan day.', { details: error?.message }, undefined, error);
      return c.json(errorData, 500);
    }

    data.exercises?.sort((a: TrainingPlanExerciseDto, b: TrainingPlanExerciseDto) => a.order_index - b.order_index);
    data.exercises?.forEach((exercise: TrainingPlanExerciseDto) => {
      exercise.sets?.sort((a: TrainingPlanExerciseSetDto, b: TrainingPlanExerciseSetDto) => a.set_index - b.set_index);
    });

    const successData = createSuccessData<TrainingPlanDayDto>(data as TrainingPlanDayDto);
    return c.json(successData, 200);

  } catch (error) {
    console.error('Unexpected error in handleGetTrainingPlanDayById:', error);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
