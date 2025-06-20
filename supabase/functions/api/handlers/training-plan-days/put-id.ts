import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanDayDto, UpdateTrainingPlanDayCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name cannot be empty if provided').optional(),
  description: z.string().nullable().optional(),
  order_index: z.number().int().positive('Order index must be a positive integer').optional(),
}).refine(
  (data) => data.name !== undefined || data.description !== undefined || data.order_index !== undefined,
  'At least one field (name, description, or order_index) must be provided for an update.'
);

export async function handlePutTrainingPlanDayById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateTrainingPlanDayCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const rpcCommand = {
      p_user_id: user.id,
      p_day_id: path!.dayId,
      p_name: command!.name,
      p_description: command!.description,
      p_target_order_index: command!.order_index,
    };

    // TODO: Import types from Supabase
    // deno-lint-ignore no-explicit-any
    const { data: updatedDay, error: rpcError } = await (supabaseClient as any).rpc('update_training_plan_day', rpcCommand).single();

    if (rpcError) {
      console.error('RPC error updating training plan day:', rpcError);
      if (rpcError.message.includes('Training plan day not found')) {
        const errorData = createErrorDataWithLogging(404, rpcError.message, undefined, undefined, rpcError);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Could not update training plan day.', { details: rpcError.message }, undefined, rpcError);
      return c.json(errorData, 500);
    }

    if (!updatedDay) {
      const errorData = createErrorDataWithLogging(404, 'Failed to update training plan day, no data returned from RPC or access denied.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingPlanDayDto>(updatedDay);
    return c.json(successData, 200);

  } catch (error) {
    console.error('Unexpected error in handlePutTrainingPlanDayById RPC call:', error);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
