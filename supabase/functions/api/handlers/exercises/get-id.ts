import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { ExerciseDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

export async function handleGetExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');

  try {
    const { data, error } = await supabaseClient
      .from('exercises')
      .select('*')
      .eq('id', path!.exerciseId)
      .single();

    if (error) {
      console.error('Error fetching exercise:', error);
      if (error.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Exercise not found');
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch exercise', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<ExerciseDto>(data as ExerciseDto);
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleGetExerciseById:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
