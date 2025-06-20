import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingPlanDto, UpdateTrainingPlanCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name must not be empty').optional(),
  description: z.string().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update"
});

export async function handlePutTrainingPlanById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateTrainingPlanCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { data, error } = await supabaseClient
      .from('training_plans')
      .update(command!)
      .eq('id', path!.planId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating training plan:', error);
      if (error.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Training plan not found for update', undefined, error.code, error);
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to update training plan', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<TrainingPlanDto>(data as TrainingPlanDto);
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handlePutTrainingPlanById:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
