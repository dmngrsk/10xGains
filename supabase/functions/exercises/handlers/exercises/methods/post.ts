import type { ApiHandlerContext } from 'shared/api-handler.ts';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import { z } from 'zod';
import type { CreateExerciseCommand, ExerciseDto } from 'shared/api-types.ts';

const CreateExerciseSchema = z.object({
  name: z.string().min(1, { message: 'Exercise name cannot be empty.' }),
  description: z.string().nullable().optional(),
});

export async function handlePostExercise(
  { req, supabaseClient, user }: Pick<ApiHandlerContext, 'req' | 'supabaseClient' | 'user'>
) {
  if (!user) {
    return createErrorResponse(401, 'Unauthorized: Authentication required.');
  }

  // TODO: Consider adding admin check here, not sure if it's needed
  // if (!user.app_metadata?.roles?.includes('admin')) {
  //   return createErrorResponse(403, 'Forbidden: Administrator access required to create an exercise.');
  // }

  let body: CreateExerciseCommand;
  try {
    body = await req.json();
  } catch (error) {
    console.error('Error parsing request body for POST /exercises:', error);
    return createErrorResponse(400, 'Invalid request body: Failed to parse JSON.', (error as Error).message);
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
      return createErrorResponse(500, 'Failed to create exercise in database.', error.message);
    }

    return createSuccessResponse<ExerciseDto>(201, data);
  } catch (e) {
    console.error('Unexpected error during exercise creation:', e);
    return createErrorResponse(500, 'An unexpected error occurred while creating the exercise.', (e as Error).message);
  }
}
