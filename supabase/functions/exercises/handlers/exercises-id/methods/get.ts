import type { ApiHandlerContext } from '@shared/api-handler.ts';
import { createErrorResponse, createSuccessResponse } from '@shared/api-helpers.ts';
import { z } from 'zod';
import type { ExerciseDto } from '@shared/api-types.ts';

const PathParamsSchema = z.object({
  id: z.string().uuid({ message: 'Exercise ID must be a valid UUID.' }),
});

export async function handleGetExerciseById(
  { supabaseClient, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'rawPathParams'>
) {
  const exerciseId = rawPathParams?.id;

  const validationResult = PathParamsSchema.safeParse({ id: exerciseId });

  if (!validationResult.success) {
    console.error('Path parameter validation error for GET /exercises/{id}:', validationResult.error.flatten());
    return createErrorResponse(400, 'Invalid exercise ID format', validationResult.error.flatten().fieldErrors);
  }

  const validatedId = validationResult.data.id;

  try {
    const { data, error } = await supabaseClient
      .from('exercises')
      .select('*')
      .eq('id', validatedId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.warn(`Exercise with ID ${validatedId} not found.`);
        return createErrorResponse(404, 'Exercise not found');
      }
      console.error(`Error fetching exercise with ID ${validatedId}:`, error);
      return createErrorResponse(500, 'Failed to fetch exercise.', { details: error.message });
    }

    if (!data) {
      console.warn(`Exercise with ID ${validatedId} not found (data is null, though no error reported by Supabase).`);
      return createErrorResponse(404, 'Exercise not found');
    }

    return createSuccessResponse<ExerciseDto>(200, data);

  } catch (e) {
    console.error(`Unexpected error fetching exercise with ID ${validatedId}:`, e);
    return createErrorResponse(500, 'An unexpected error occurred while fetching the exercise.', { details: (e as Error).message });
  }
}
