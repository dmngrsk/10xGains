import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

export async function handleDeleteTrainingPlanDayById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const rpcCommand = {
      p_user_id: user.id,
      p_day_id: path!.dayId,
    };

    // TODO: Import types from Supabase
    // deno-lint-ignore no-explicit-any
    const { error: rpcError } = await (supabaseClient as any).rpc('delete_training_plan_day', rpcCommand);

    if (rpcError) {
      console.error('RPC error deleting training plan day:', rpcError);
      if (rpcError.message.includes('training plan day not found')) {
        const errorData = createErrorDataWithLogging(404, 'Training plan day not found or no access.', { details: rpcError.message }, undefined, rpcError);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Could not delete training plan day.', { details: rpcError.message }, undefined, rpcError);
      return c.json(errorData, 500);
    }

    return c.body(null, 204);

  } catch (error) {
    console.error('Unexpected error in handleDeleteTrainingPlanDay:', error);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
