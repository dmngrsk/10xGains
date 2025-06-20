import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanDayDto, TrainingPlanExerciseDto, TrainingPlanExerciseSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams, validateQueryParams } from "../../utils/validation.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

const QUERY_SCHEMA = z.object({
  limit: z.preprocess(
    (val: unknown) => (val ? parseInt(String(val), 10) : DEFAULT_LIMIT),
    z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
  ),
  offset: z.preprocess(
    (val: unknown) => (val ? parseInt(String(val), 10) : DEFAULT_OFFSET),
    z.number().int().min(0).default(DEFAULT_OFFSET)
  )
});

export async function handleGetTrainingPlanDays(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

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

    const { data: days, error: daysError } = await supabaseClient
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
      .eq('training_plan_id', path!.planId)
      .order('order_index', { ascending: true })
      .range(query!.offset, query!.offset + query!.limit - 1);

    if (daysError) {
      console.error('Error fetching training plan days:', daysError);
      const errorData = createErrorDataWithLogging(500, 'Could not fetch training plan days.', { details: daysError.message }, undefined, daysError);
      return c.json(errorData, 500);
    }

    days?.forEach((day: TrainingPlanDayDto) => {
      day.exercises?.sort((a: TrainingPlanExerciseDto, b: TrainingPlanExerciseDto) => a.order_index - b.order_index);
      day.exercises?.forEach((exercise: TrainingPlanExerciseDto) => {
        exercise.sets?.sort((a: TrainingPlanExerciseSetDto, b: TrainingPlanExerciseSetDto) => a.set_index - b.set_index);
      });
    });

    const successData = createSuccessData<TrainingPlanDayDto[]>(days ?? []);
    return c.json(successData, 200);

  } catch (error) {
    console.error('Unexpected error in handleGetTrainingPlanDays:', error);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
