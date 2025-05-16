import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { TrainingPlanDayDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const CreateTrainingPlanDayCommandSchema = z.object({
  name: z.string().min(1, { message: 'Name is required and cannot be empty.' }),
  description: z.string().optional().nullable(),
  order_index: z.number().int().positive({ message: 'Order index must be a positive integer.' }).optional(),
});

export async function handleCreateTrainingPlanDay(
  { supabaseClient, user, req, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'req' | 'rawPathParams'>
): Promise<Response> {
  let command;
  try {
    const body = await req.json();
    const validationResult = CreateTrainingPlanDayCommandSchema.safeParse(body);

    if (!validationResult.success) {
      const errorDetails = validationResult.error.errors.map(err => `${err.path.join('.') || 'body'}: ${err.message}`).join('; ');
      return createErrorResponse(400, `Invalid request body: ${errorDetails}`);
    }
    command = validationResult.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
        return createErrorResponse(400, 'Invalid JSON format in request body.');
    }
    console.error('Error processing request body:', error);
    return createErrorResponse(500, 'Failed to process request body.', { details: (error as Error).message });
  }

  try {
    const rpcCommand = {
      p_user_id: user!.id,
      p_plan_id: rawPathParams!.planId,
      p_name: command.name,
      p_description: command.description,
      p_target_order_index: command.order_index,
    };

    // @ts-expect-error Parametrized RPC call, not correctly typed in SupabaseClient.d.ts
    const { data: newDay, error: rpcError } = await supabaseClient.rpc('create_training_plan_day', rpcCommand).single();

    if (rpcError) {
      console.error('RPC error creating training plan day:', rpcError);
      if (rpcError.message.includes('Training plan not found')) {
        return createErrorResponse(404, rpcError.message, undefined, undefined, rpcError);
      }
      return createErrorResponse(500, 'Could not create training plan day.', { details: rpcError.message });
    }

    if (!newDay) {
        return createErrorResponse(500, 'Failed to create training plan day, no data returned from RPC.');
    }

    return createSuccessResponse<TrainingPlanDayDto>(201, newDay);

  } catch (error) {
    console.error('Unexpected error in handleCreateTrainingPlanDay RPC call:', error);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (error as Error).message });
  }
}
