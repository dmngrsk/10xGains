import type { ApiHandlerContext } from 'shared/api-handler.ts';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import { z } from 'zod';
import type { UpdateExerciseCommand, ExerciseDto } from 'shared/api-types.ts';

const PathParamsSchema = z.object({
  id: z.string().uuid({ message: 'Exercise ID must be a valid UUID.' }),
});

const UpdateExerciseSchema = z.object({
  name: z.string().min(1, { message: 'Exercise name cannot be empty if provided.' }).optional(),
  description: z.string().nullable().optional(),
});

export async function handlePutExerciseById(
  { req, supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'req' | 'supabaseClient' | 'user' | 'rawPathParams'>
) {
  const exerciseId = rawPathParams?.id;

  if (!user) {
    console.warn(`PUT /exercises/${exerciseId}: Attempt to update without user context.`);
    return createErrorResponse(401, 'Unauthorized: Authentication required.');
  }

  // TODO: Consider adding admin check here, not sure if it's needed
  // if (!user.app_metadata?.roles?.includes('admin')) {
  //   return createErrorResponse(403, 'Forbidden: Administrator access required to update an exercise.');
  // }

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
    return createErrorResponse(400, 'Invalid request body: Failed to parse JSON.', (error as Error).message);
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
      return createErrorResponse(500, 'Failed to update exercise in database.', error.message);
    }

    if (!data) {
        return createErrorResponse(404, 'Exercise not found to update.');
    }

    return createSuccessResponse<ExerciseDto>(200, data);

  } catch (e) {
    console.error(`Unexpected error during exercise update for ID ${validatedId}:`, e);
    return createErrorResponse(500, 'An unexpected error occurred while updating the exercise.', (e as Error).message);
  }
}
