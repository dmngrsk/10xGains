import { z } from 'zod';
import { createErrorResponse, createSuccessResponse, stripUndefinedValues } from 'shared/api-helpers.ts';
import type { ApiHandlerContext } from 'shared/api-handler.ts';
import type { TrainingPlanExerciseProgressionDto, UpdateTrainingPlanExerciseProgressionCommand } from 'shared/api-types.ts';

const updateProgressionBodySchema = z.object({
  weight_increment: z.number().positive().optional(),
  failure_count_for_deload: z.number().int().positive().optional(),
  current_weight: z.number().positive().optional(),
  consecutive_failures: z.number().int().min(0).optional(),
  deload_percentage: z.number().positive().optional().max(100),
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
  { supabaseClient, rawPathParams, req, requestInfo, user }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams' | 'req' | 'requestInfo' | 'user'>
) {
  if (!rawPathParams) {
    return createErrorResponse(500, 'Internal server error: Path parameters missing.', undefined, undefined, undefined, requestInfo);
  }
  if (!user) {
    return createErrorResponse(401, 'Unauthorized: User not authenticated.', undefined, undefined, undefined, requestInfo);
  }

  const pathParamsValidation = pathParamsSchema.safeParse(rawPathParams);
  if (!pathParamsValidation.success) {
    return createErrorResponse(
      400,
      'Invalid path parameters.',
      pathParamsValidation.error.flatten(),
      undefined,
      undefined,
      requestInfo
    );
  }
  const { planId, exerciseId } = pathParamsValidation.data;

  let requestBody;
  try {
    requestBody = await req.json();
  } catch (error) {
    return createErrorResponse(400, 'Invalid JSON in request body.', { details: error.message }, undefined, error, requestInfo);
  }

  const bodyValidation = updateProgressionBodySchema.safeParse(requestBody);
  if (!bodyValidation.success) {
    return createErrorResponse(
      400,
      'Invalid request body.',
      bodyValidation.error.flatten(),
      undefined,
      undefined,
      requestInfo
    );
  }
  const validatedBody = bodyValidation.data as UpdateTrainingPlanExerciseProgressionCommand;

  try {
    const { data: existingProgressionFull, error: fetchError } = await supabaseClient
      .from('training_plan_exercise_progressions')
      .select('*')
      .eq('training_plan_id', planId)
      .eq('exercise_id', exerciseId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing progression:', fetchError);
      return createErrorResponse(500, 'Error checking for existing progression.', { details: fetchError.message }, undefined, fetchError, requestInfo);
    }

    let savedProgression: TrainingPlanExerciseProgressionDto | null = null;
    let statusCode = 200;

    const changesToApply = stripUndefinedValues(validatedBody);

    if (existingProgressionFull) {
      statusCode = 200; // UPDATE path
      const updatedRecord = {
        ...existingProgressionFull,
        ...changesToApply,
        last_updated: new Date().toISOString(),
      };

      const { data, error } = await supabaseClient
        .from('training_plan_exercise_progressions')
        .update(updatedRecord)
        .eq('id', existingProgressionFull.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating progression:', error);
        return createErrorResponse(500, 'Failed to update progression data.', { details: error.message }, undefined, error, requestInfo);
      }
      savedProgression = data;
    } else {
      statusCode = 201; // CREATE path
      if (
        validatedBody.weight_increment === undefined ||
        validatedBody.failure_count_for_deload === undefined ||
        validatedBody.current_weight === undefined
      ) {
        return createErrorResponse(
          400,
          'Missing required fields for creating a new progression: weight_increment, failure_count_for_deload, and current_weight are required.',
          undefined, undefined, undefined, requestInfo
        );
      }

      const insertData = {
        training_plan_id: planId,
        exercise_id: exerciseId,
        ...changesToApply,
        last_updated: new Date().toISOString(),
      };

      const { data, error } = await supabaseClient
        .from('training_plan_exercise_progressions')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating progression:', error);
        return createErrorResponse(500, 'Failed to create progression data.', { details: error.message }, undefined, error, requestInfo);
      }
      savedProgression = data;
    }

    if (!savedProgression) {
      console.error('Save operation did not return the expected record.');
      return createErrorResponse(500, 'Failed to retrieve progression data after save.', undefined, undefined, undefined, requestInfo);
    }

    return createSuccessResponse<TrainingPlanExerciseProgressionDto>(statusCode, savedProgression, null);

  } catch (e) {
    console.error('Unexpected error in handleUpsertTrainingPlanExerciseProgression:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: e.message }, undefined, e, requestInfo);
  }
}
