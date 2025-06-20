import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseDto, UpdateTrainingPlanExerciseCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

const COMMAND_SCHEMA = z.object({
  order_index: z.number().int().min(1, 'Order index must be a positive integer'),
});

export async function handlePutTrainingPlanExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateTrainingPlanExerciseCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const rpcCommand = {
      p_user_id: user.id,
      p_plan_exercise_id: path!.exerciseId,
      p_target_order_index: command!.order_index,
    };

    // TODO: Import types from Supabase
    // deno-lint-ignore no-explicit-any
    const { data: updatedExercise, error: rpcError } = await (supabaseClient as any).rpc('update_training_plan_exercise_order', rpcCommand).single();

    if (rpcError) {
      if (rpcError.message.includes('not found') || rpcError.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Training plan exercise not found or not authorized.', undefined, rpcError.code, rpcError);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Could not update training plan exercise.', { details: rpcError.message }, undefined, rpcError);
      return c.json(errorData, 500);
    }

    if (!updatedExercise) {
      const errorData = createErrorDataWithLogging(404, 'Failed to update training plan exercise, record not found or no change made.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData(updatedExercise as TrainingPlanExerciseDto);
    return c.json(successData, 200);
  } catch (error) {
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
