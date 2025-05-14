import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanDayDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

export async function handleGetTrainingPlanDays(
  { supabaseClient, user, rawPathParams, url }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'url'>
) {
  const planIdValidation = z.string().uuid().safeParse(rawPathParams?.planId);
  if (!planIdValidation.success) {
    const errorMessages = planIdValidation.error.errors.map(e => e.message).join(', ');
    return createErrorResponse(400, `Invalid planId: ${errorMessages}`);
  }
  const planId = planIdValidation.data;

  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');

  const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
  const offset = offsetParam ? parseInt(offsetParam, 10) : DEFAULT_OFFSET;

  if (isNaN(limit) || limit <= 0 || limit > MAX_LIMIT) {
    return createErrorResponse(400, `Invalid limit parameter. Must be a positive integer between 1 and ${MAX_LIMIT}.`);
  }
  if (isNaN(offset) || offset < 0) {
    return createErrorResponse(400, 'Invalid offset parameter. Must be a non-negative integer.');
  }

  try {
    const { data: plan, error: planError } = await supabaseClient
      .from('training_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', user!.id)
      .single();

    if (planError || !plan) {
      return createErrorResponse(404, 'Training plan not found or user does not have access.', { details: planError?.message });
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
      .eq('training_plan_id', planId)
      .order('order_index', { ascending: true })
      .range(offset, offset + limit - 1);

    if (daysError) {
      console.error('Error fetching training plan days:', daysError);
      return createErrorResponse(500, 'Could not fetch training plan days.', { details: daysError.message });
    }

    days?.forEach(day => {
      day.exercises?.sort((a, b) => a.order_index - b.order_index);
      day.exercises?.forEach(exercise => {
        exercise.sets?.sort((a, b) => a.set_index - b.set_index);
      });
    });

    return createSuccessResponse<TrainingPlanDayDto[]>(200, days ?? []);

  } catch (error) {
    console.error('Unexpected error in handleGetTrainingPlanDays:', error);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (error as Error).message });
  }
}
