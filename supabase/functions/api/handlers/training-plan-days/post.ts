import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { CreateTrainingPlanDayCommand, TrainingPlanDayDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name is required and cannot be empty'),
  description: z.string().nullable().optional(),
  order_index: z.number().int().positive('Order index must be a positive integer').optional(),
});

export async function handleCreateTrainingPlanDay(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateTrainingPlanDayCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const rpcCommand = {
      p_user_id: user.id,
      p_plan_id: path!.planId,
      p_name: command!.name,
      p_description: command!.description,
      p_target_order_index: command!.order_index,
    };

    // TODO: Import types from Supabase
    // deno-lint-ignore no-explicit-any
    const { data: newDay, error: rpcError } = await (supabaseClient as any).rpc('create_training_plan_day', rpcCommand).single();

    if (rpcError) {
      console.error('RPC error creating training plan day:', rpcError);
      if (rpcError.message.includes('Training plan not found')) {
        const errorData = createErrorDataWithLogging(404, rpcError.message, undefined, undefined, rpcError);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Could not create training plan day.', { details: rpcError.message }, undefined, rpcError);
      return c.json(errorData, 500);
    }

    if (!newDay) {
      const errorData = createErrorDataWithLogging(500, 'Failed to create training plan day, no data returned from RPC.');
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<TrainingPlanDayDto>(newDay);
    return c.json(successData, 201);

  } catch (error) {
    console.error('Unexpected error in handleCreateTrainingPlanDay RPC call:', error);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
