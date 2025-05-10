import type { ApiHandlerContext } from 'shared/api-handler.ts';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import { z } from 'zod';

const PathParamsSchema = z.object({
  id: z.string().uuid({ message: 'Exercise ID must be a valid UUID.' }),
});

export async function handleDeleteExerciseById(
  { supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams'>
) {
  const exerciseId = rawPathParams?.id;

  if (!user) {
    console.warn(`DELETE /exercises/${exerciseId}: Attempt to delete without user context.`);
    return createErrorResponse(401, 'Unauthorized: Authentication required.');
  }

  // TODO: Consider adding admin check here, not sure if it's needed
  // if (!user.app_metadata?.roles?.includes('admin')) {
  //   return createErrorResponse(403, 'Forbidden: Administrator access required to delete an exercise.');
  // }

  const pathValidationResult = PathParamsSchema.safeParse({ id: exerciseId });
  if (!pathValidationResult.success) {
    console.error('Path parameter validation error for DELETE /exercises/{id}:', pathValidationResult.error.flatten());
    return createErrorResponse(400, 'Invalid exercise ID format', pathValidationResult.error.flatten().fieldErrors);
  }
  const validatedId = pathValidationResult.data.id;

  try {
    const { error } = await supabaseClient
      .from('exercises')
      .delete()
      .eq('id', validatedId);

    if (error) {
      console.error(`Error deleting exercise ${validatedId} from database:`, error);
      return createErrorResponse(500, 'Failed to delete exercise from database.', error.message);
    }

    return createSuccessResponse(204, null);

  } catch (e) {
    console.error(`Unexpected error during exercise deletion for ID ${validatedId}:`, e);
    return createErrorResponse(500, 'An unexpected error occurred while deleting the exercise.', (e as Error).message);
  }
}
