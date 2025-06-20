import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { CreateTrainingPlanCommand, TrainingPlanDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody } from "../../utils/validation.ts";

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name must not be empty'),
  description: z.string().nullable().optional(),
});

export async function handleCreateTrainingPlan(c: Context<AppContext>) {
  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateTrainingPlanCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const newPlanData = {
      name: command!.name,
      description: command!.description ?? null,
      user_id: user!.id,
    };

    const { data, error } = await supabaseClient
      .from('training_plans')
      .insert(newPlanData)
      .select()
      .single();

    if (error) {
      console.error('Error creating training plan:', error);
      const errorData = createErrorDataWithLogging(500, 'Failed to create training plan', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<TrainingPlanDto>(data as TrainingPlanDto);
    return c.json(successData, 201);
  } catch (e) {
    console.error('Unexpected error in handleCreateTrainingPlan:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
