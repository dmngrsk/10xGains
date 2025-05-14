import { z } from 'zod';
import { createErrorResponse, createSuccessResponse, stripUndefinedValues } from '@shared/utils/api-helpers.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import type { TrainingPlanExerciseProgressionDto, UpsertTrainingPlanExerciseProgressionCommand } from '@shared/models/api-types.ts';

const updateProgressionBodySchema = z.object({
  weight_increment: z.number().positive().optional(),
  failure_count_for_deload: z.number().int().positive().optional(),
  current_weight: z.number().positive().optional(),
  consecutive_failures: z.number().int().min(0).optional(),
  deload_percentage: z.number().max(100).positive().optional(),
  deload_strategy: z.enum(['PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM']).optional(),
  reference_set_index: z.number().int().min(0).nullable().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update."
});

const pathParamsSchema = z.object({
  planId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export async function handleUpsertTrainingPlanExerciseProgression(
  { supabaseClient, rawPathParams, req }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams' | 'req'>
) {
  if (!rawPathParams) {
    return createErrorResponse(500, 'Internal server error: Path parameters missing.');
  }

  const pathParamsValidation = pathParamsSchema.safeParse(rawPathParams);
  if (!pathParamsValidation.success) {
    return createErrorResponse(400, 'Invalid path parameters.', pathParamsValidation.error.flatten());
  }
  const { planId, exerciseId } = pathParamsValidation.data;

  let requestBody;
  try {
    requestBody = await req.json();
  } catch (error) {
    return createErrorResponse(400, 'Invalid JSON in request body.', { details: (error as Error).message });
  }

  const bodyValidation = updateProgressionBodySchema.safeParse(requestBody);
  if (!bodyValidation.success) {
    return createErrorResponse(400, 'Invalid request body.', bodyValidation.error.flatten());
  }

  const validatedData = bodyValidation.data as UpsertTrainingPlanExerciseProgressionCommand;

  const { data: existingProgression, error } = await supabaseClient
    .from('training_plan_exercise_progressions')
    .select('*')
    .eq('training_plan_id', planId)
    .eq('exercise_id', exerciseId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching exercise progression for update:', error);
    return createErrorResponse(500, 'Failed to fetch exercise progression details for update.', { details: error.message });
  }

  const dataToUpsert: Partial<TrainingPlanExerciseProgressionDto> = {
    ...(existingProgression || {}),
    ...stripUndefinedValues(validatedData),
    training_plan_id: planId,
    exercise_id: exerciseId,
  };

  try {
    const { data, error } = await supabaseClient
      .from('training_plan_exercise_progressions')
      .upsert(dataToUpsert, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating exercise progression:', error);
      return createErrorResponse(500, 'Failed to create or update exercise progression.');
    }

    return createSuccessResponse<TrainingPlanExerciseProgressionDto>(200, data as TrainingPlanExerciseProgressionDto);
  } catch (e) {
    console.error('Unexpected error in handleUpsertTrainingPlanExerciseProgression:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}
