import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseDto, CreateTrainingPlanExerciseCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

const COMMAND_SCHEMA = z.object({
  exercise_id: z.string().uuid('Invalid exerciseId format'),
  order_index: z.number().int().min(1, 'Order index must be a positive integer').optional(),
});

export async function handleCreateTrainingPlanExercise(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateTrainingPlanExerciseCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const rpcCommand = {
      p_user_id: user.id,
      p_day_id: path!.dayId,
      p_exercise_id: command!.exercise_id,
      p_target_order_index: command!.order_index,
    };

    // TODO: Import types from Supabase
    // deno-lint-ignore no-explicit-any
    const { data: newTrainingPlanExercise, error: rpcError } = await (supabaseClient as any).rpc('create_training_plan_exercise', rpcCommand).single();

    if (rpcError) {
      if (rpcError.message.includes('Training plan day not found') || rpcError.message.includes('Training plan not found')) {
        const errorData = createErrorDataWithLogging(404, rpcError.message, undefined, undefined, rpcError);
        return c.json(errorData, 404);
      }
      if (rpcError.message.includes('Exercise not found')) {
        const errorData = createErrorDataWithLogging(400, rpcError.message, { details: 'Exercise not found' }, undefined, rpcError);
        return c.json(errorData, 400);
      }
      const errorData = createErrorDataWithLogging(500, 'Could not add exercise to training plan day.', { details: rpcError.message }, undefined, rpcError);
      return c.json(errorData, 500);
    }

    if (!newTrainingPlanExercise) {
      const errorData = createErrorDataWithLogging(500, 'Failed to add exercise, no data returned from RPC.');
      return c.json(errorData, 500);
    }

    const successData = createSuccessData(newTrainingPlanExercise as TrainingPlanExerciseDto);
    return c.json(successData, 201);
  } catch (error) {
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
