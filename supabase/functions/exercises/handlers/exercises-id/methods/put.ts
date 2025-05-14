import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { UpdateExerciseCommand, ExerciseDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const PathParamsSchema = z.object({
  id: z.string().uuid({ message: 'Exercise ID must be a valid UUID.' }),
});

const UpdateExerciseSchema = z.object({
  name: z.string().min(1, { message: 'Exercise name cannot be empty if provided.' }).optional(),
  description: z.string().nullable().optional(),
});

export async function handlePutExerciseById(
  { req, supabaseClient, rawPathParams }: Pick<ApiHandlerContext, 'req' | 'supabaseClient' | 'rawPathParams'>
) {
  const exerciseId = rawPathParams?.id;

  const pathValidationResult = PathParamsSchema.safeParse({ id: exerciseId });
  if (!pathValidationResult.success) {
    console.error('Path parameter validation error for PUT /exercises/{id}:', pathValidationResult.error.flatten());
    return createErrorResponse(400, 'Invalid exercise ID format', pathValidationResult.error.flatten().fieldErrors);
  }
  const validatedId = pathValidationResult.data.id;

  let body: Partial<UpdateExerciseCommand>;
  try {
    body = await req.json();
  } catch (error) {
    console.error(`Error parsing request body for PUT /exercises/${validatedId}:`, error);
    return createErrorResponse(400, 'Invalid request body: Failed to parse JSON.', { details: (error as Error).message });
  }

  const bodyValidationResult = UpdateExerciseSchema.safeParse(body);
  if (!bodyValidationResult.success) {
    console.error(`Request body validation failed for PUT /exercises/${validatedId}:`, bodyValidationResult.error.flatten());
    return createErrorResponse(400, 'Invalid request body content', bodyValidationResult.error.flatten().fieldErrors);
  }

  const validatedBody = bodyValidationResult.data;

  if (Object.keys(validatedBody).length === 0) {
    return createErrorResponse(400, 'Invalid request: No fields to update.');
  }

  try {
    const { data, error } = await supabaseClient
      .from('exercises')
      .update(validatedBody as UpdateExerciseCommand)
      .eq('id', validatedId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return createErrorResponse(404, 'Exercise not found to update.');
      }
      console.error(`Error updating exercise ${validatedId} in database:`, error);
      return createErrorResponse(500, 'Failed to update exercise in database.', { details: error.message });
    }

    if (!data) {
        return createErrorResponse(404, 'Exercise not found to update.');
    }

    return createSuccessResponse<ExerciseDto>(200, data);

  } catch (e) {
    console.error(`Unexpected error during exercise update for ID ${validatedId}:`, e);
    return createErrorResponse(500, 'An unexpected error occurred while updating the exercise.', { details: (e as Error).message });
  }
}
