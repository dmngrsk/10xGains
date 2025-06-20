import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

export async function handleDeleteTrainingPlanExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const rpcCommand = {
      p_user_id: user.id,
      p_plan_exercise_id: path!.exerciseId,
    };

    // TODO: Import types from Supabase
    // deno-lint-ignore no-explicit-any
    const { error: rpcError, status } = await (supabaseClient as any).rpc('delete_training_plan_exercise', rpcCommand);

    if (rpcError) {
      if (rpcError.message.includes('not found') || rpcError.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Training plan exercise not found or not authorized to delete.', undefined, rpcError.code, rpcError);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Could not delete training plan exercise.', { details: rpcError.message }, undefined, rpcError);
      return c.json(errorData, 500);
    }

    if (status === 204 || (status >= 200 && status < 300 && !rpcError)) {
      return c.body(null, 204);
    } else if (status === 404) {
      const errorData = createErrorDataWithLogging(404, 'Training plan exercise not found or not authorized to delete.');
      return c.json(errorData, 404);
    }

    return c.body(null, 204);

  } catch (error) {
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
