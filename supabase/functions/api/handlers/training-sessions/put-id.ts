import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { TrainingSessionDto, UpdateTrainingSessionCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from '../../utils/validation.ts';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

const COMMAND_SCHEMA = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export async function handlePutTrainingSessionById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateTrainingSessionCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { data: updatedSession, error } = await supabaseClient
      .from('training_sessions')
      .update(command!)
      .eq('id', path!.sessionId)
      .eq('user_id', user!.id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating training session ${path!.sessionId} for user ${user!.id}:`, error);
      if (error.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Training session not found or not authorized to update.');
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to update training session', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    if (!updatedSession) {
      const errorData = createErrorDataWithLogging(404, 'Training session not found or not authorized to update.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingSessionDto>(updatedSession as TrainingSessionDto);
    return c.json(successData, 200);

  } catch (error) {
    console.error('Unexpected error in handlePutTrainingSessionById:', error);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (error as Error).message }, undefined, error);
    return c.json(errorData, 500);
  }
}
