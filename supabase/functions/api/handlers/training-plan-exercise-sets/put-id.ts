import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseSetDto, UpdateTrainingPlanExerciseSetCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
  setId: z.string().uuid('Invalid setId format'),
});

const COMMAND_SCHEMA = z.object({
  set_index: z.number().int().nonnegative().optional(),
  expected_reps: z.number().int().positive().optional(),
  expected_weight: z.number().positive().optional(),
}).refine(
  (data) => data.set_index !== undefined || data.expected_reps !== undefined || data.expected_weight !== undefined,
  'At least one field (set_index, expected_reps, or expected_weight) must be provided for update'
);

export async function handleUpdateTrainingPlanExerciseSet(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateTrainingPlanExerciseSetCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const rpcCommand = {
      p_user_id: user.id,
      p_set_id: path!.setId,
      p_expected_reps: command!.expected_reps === undefined ? null : command!.expected_reps,
      p_expected_weight: command!.expected_weight === undefined ? null : command!.expected_weight,
      p_target_set_index: command!.set_index === undefined ? null : command!.set_index
    };

    // TODO: Import types from Supabase
    // deno-lint-ignore no-explicit-any
    const { data: updatedSetResult, error: rpcError } = await (supabaseClient as any).rpc('update_training_plan_exercise_set', rpcCommand).single();

    if (rpcError) {
      console.error('RPC error update_training_plan_exercise_set:', rpcError);
      if (rpcError.message.includes('not found or user does not have access')) {
        const errorData = createErrorDataWithLogging(404, 'Failed to update exercise set: Resource not found or access denied.', { details: rpcError.message }, undefined, rpcError);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to update exercise set via RPC.', { details: rpcError.message }, undefined, rpcError);
      return c.json(errorData, 500);
    }

    if (!updatedSetResult) {
      console.error('RPC update_training_plan_exercise_set did not return the updated set or returned an empty array.', updatedSetResult);
      const errorData = createErrorDataWithLogging(500, 'RPC update_training_plan_exercise_set did not return the updated set as expected.');
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<TrainingPlanExerciseSetDto>(updatedSetResult as TrainingPlanExerciseSetDto);
    return c.json(successData, 200);
  } catch (error) {
    console.error('Error during PUT set processing (outside RPC call itself):', error);
    const errorData = createErrorDataWithLogging(500, 'Internal server error during set update.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
