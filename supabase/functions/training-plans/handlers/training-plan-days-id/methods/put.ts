import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanDayDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const UpdateTrainingPlanDayCommandSchema = z.object({
  name: z.string().min(1, { message: 'Name cannot be empty if provided.' }).optional(),
  description: z.string().optional(),
  order_index: z.number().int().positive({ message: 'Order index must be a positive integer.' }).optional(),
}).refine(
  (data) => data.name !== undefined || data.description !== undefined || data.order_index !== undefined,
  { message: 'At least one field (name, description, or order_index) must be provided for an update.' }
);

export async function handlePutTrainingPlanDayById(
  { supabaseClient, user, req, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'req' | 'rawPathParams'>
) {

  const paramsValidation = z.object({
    planId: z.string().uuid({ message: 'Invalid planId format.' }),
    dayId: z.string().uuid({ message: 'Invalid dayId format.' }),
  }).safeParse(rawPathParams);

  if (!paramsValidation.success) {
    const errorDetails = paramsValidation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
    return createErrorResponse(400, `Invalid path parameters: ${errorDetails}`);
  }
  const { dayId } = paramsValidation.data;

  let command;
  try {
    const body = await req.json();
    const validationResult = UpdateTrainingPlanDayCommandSchema.safeParse(body);

    if (!validationResult.success) {
      const errorDetails = validationResult.error.errors.map(err => `${err.path.join('.') || 'body'}: ${err.message}`).join('; ');
      return createErrorResponse(400, `Invalid request body: ${errorDetails}`);
    }
    command = validationResult.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
        return createErrorResponse(400, 'Invalid JSON format in request body.');
    }
    console.error('Error processing request body for update:', error);
    return createErrorResponse(500, 'Failed to process request body.', { details: (error as Error).message });
  }

  try {
    const rpcCommand = {
      p_user_id: user!.id,
      p_day_id: dayId,
      p_name: command.name,
      p_description: command.description,
      p_target_order_index: command.order_index,
    };

    // @ts-expect-error Parametrized RPC call, not correctly typed in SupabaseClient.d.ts
    const { data: updatedDay, error: rpcError } = await supabaseClient.rpc('update_training_plan_day', rpcCommand).single();

    if (rpcError) {
      console.error('RPC error updating training plan day:', rpcError);
      if (rpcError.message.includes('Training plan day not found')) {
        return createErrorResponse(404, rpcError.message);
      }
      return createErrorResponse(500, 'Could not update training plan day.', { details: rpcError.message });
    }

    if (!updatedDay) {
        return createErrorResponse(404, 'Failed to update training plan day, no data returned from RPC or access denied.');
    }

    return createSuccessResponse<TrainingPlanDayDto>(200, updatedDay);

  } catch (error) {
    console.error('Unexpected error in handlePutTrainingPlanDayById RPC call:', error);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (error as Error).message });
  }
}
