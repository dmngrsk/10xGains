import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
  setId: z.string().uuid('Invalid setId format'),
});

export async function handleDeleteTrainingPlanExerciseSet(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const rpcCommand = {
      p_user_id: user.id,
      p_set_id: path!.setId
    };

    // TODO: Import types from Supabase
    // deno-lint-ignore no-explicit-any
    const { error: rpcError } = await (supabaseClient as any).rpc('delete_training_plan_exercise_set', rpcCommand);

    if (rpcError) {
      console.error('RPC error delete_training_plan_exercise_set:', rpcError);
      if (rpcError.message.includes('not found or user does not have access')) {
        const errorData = createErrorDataWithLogging(404, 'Exercise set not found or access denied.', { details: rpcError.message }, undefined, rpcError);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to delete exercise set via RPC.', { details: rpcError.message }, undefined, rpcError);
      return c.json(errorData, 500);
    }

    return c.body(null, 204);

  } catch (error) {
    console.error('Error during DELETE set processing (outside RPC call itself):', error);
    const errorData = createErrorDataWithLogging(500, 'Internal server error during set deletion.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
