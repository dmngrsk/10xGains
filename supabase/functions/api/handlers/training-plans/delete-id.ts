import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

export async function handleDeleteTrainingPlanById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { error } = await supabaseClient
      .from('training_plans')
      .delete()
      .eq('id', path!.planId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting training plan:', error);
      const errorData = createErrorDataWithLogging(500, 'Failed to delete training plan', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    return c.body(null, 204);
  } catch (e) {
    console.error('Unexpected error in handleDeleteTrainingPlanById:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
