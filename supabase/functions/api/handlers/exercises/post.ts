import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { CreateExerciseCommand, ExerciseDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody } from "../../utils/validation.ts";

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
});

export async function handleCreateExercise(c: Context<AppContext>) {
  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateExerciseCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');

  try {
    const { data, error } = await supabaseClient
      .from('exercises')
      .insert([command!])
      .select()
      .single();

    if (error) {
      console.error('Error creating exercise:', error);
      const errorData = createErrorDataWithLogging(500, 'Failed to create exercise', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<ExerciseDto>(data as ExerciseDto);
    return c.json(successData, 201);
  } catch (e) {
    console.error('Unexpected error in handleCreateExercise:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
