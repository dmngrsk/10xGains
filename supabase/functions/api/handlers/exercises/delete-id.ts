import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

export async function handleDeleteExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');

  try {
    const { error } = await supabaseClient
      .from('exercises')
      .delete()
      .eq('id', path!.exerciseId);

    if (error) {
      console.error('Error deleting exercise:', error);
      const errorData = createErrorDataWithLogging(500, 'Failed to delete exercise', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    return c.body(null, 204);
  } catch (e) {
    console.error('Unexpected error in handleDeleteExerciseById:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
