import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseSetDto, CreateTrainingPlanExerciseSetCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

const COMMAND_SCHEMA = z.object({
  expected_reps: z.number().int().positive('Expected reps must be positive'),
  expected_weight: z.number().positive('Expected weight must be positive'),
  set_index: z.number().int().positive('Set index must be positive').optional(),
});

export async function handleCreateTrainingPlanExerciseSet(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateTrainingPlanExerciseSetCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const rpcCommand = {
      p_user_id: user.id,
      p_training_plan_exercise_id: path!.exerciseId,
      p_expected_reps: command!.expected_reps,
      p_expected_weight: command!.expected_weight,
      p_target_set_index: command!.set_index === undefined ? null : command!.set_index
    };

    // TODO: Import types from Supabase
    // deno-lint-ignore no-explicit-any
    const { data: newSetResult, error: rpcError } = await (supabaseClient as any).rpc('create_training_plan_exercise_set', rpcCommand);

    if (rpcError) {
      console.error('RPC error create_training_plan_exercise_set:', rpcError);
      if (rpcError.message.includes('not found or user does not have access')) {
        const errorData = createErrorDataWithLogging(404, 'Failed to create exercise set: Resource not found or access denied.', { details: rpcError.message }, undefined, rpcError);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to create exercise set via RPC.', { details: rpcError.message }, undefined, rpcError);
      return c.json(errorData, 500);
    }

    if (!newSetResult) {
      console.error('RPC create_training_plan_exercise_set did not return the new set or returned an empty array.', newSetResult);
      const errorData = createErrorDataWithLogging(500, 'RPC create_training_plan_exercise_set did not return the new set as expected.');
      return c.json(errorData, 500);
    }

    const createdSet = newSetResult[0] as TrainingPlanExerciseSetDto;

    const successData = createSuccessData<TrainingPlanExerciseSetDto>(createdSet);
    return c.json(successData, 201);

  } catch (error) {
    console.error('Error during POST set processing (outside RPC call itself):', error);
    const errorData = createErrorDataWithLogging(500, 'Internal server error during set creation.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
