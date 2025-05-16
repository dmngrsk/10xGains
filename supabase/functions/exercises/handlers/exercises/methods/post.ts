import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { CreateExerciseCommand, ExerciseDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const CreateExerciseSchema = z.object({
  name: z.string().min(1, { message: 'Exercise name cannot be empty.' }),
  description: z.string().nullable().optional(),
});

export async function handleCreateExercise(
  { req, supabaseClient }: Pick<ApiHandlerContext, 'req' | 'supabaseClient'>
) {
  let body: CreateExerciseCommand;
  try {
    body = await req.json();
  } catch (error) {
    console.error('Error parsing request body for POST /exercises:', error);
    return createErrorResponse(400, 'Invalid request body: Failed to parse JSON.', { details: (error as Error).message });
  }

  const validationResult = CreateExerciseSchema.safeParse(body);
  if (!validationResult.success) {
    console.error('POST /exercises: Request body validation failed:', validationResult.error.flatten());
    return createErrorResponse(400, 'Invalid request body', validationResult.error.flatten().fieldErrors);
  }

  const validatedBody = validationResult.data;

  try {
    const { data, error } = await supabaseClient
      .from('exercises')
      .insert(validatedBody as CreateExerciseCommand)
      .select()
      .single();

    if (error) {
      console.error('Error creating exercise in database:', error);
      return createErrorResponse(500, 'Failed to create exercise in database.', { details: error.message });
    }

    return createSuccessResponse<ExerciseDto>(201, data);
  } catch (e) {
    console.error('Unexpected error during exercise creation:', e);
    return createErrorResponse(500, 'An unexpected error occurred while creating the exercise.', { details: (e as Error).message });
  }
}
