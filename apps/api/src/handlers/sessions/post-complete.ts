import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { CompleteSessionCommand, SessionDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { validateOptionalCommandBody, validatePathParams } from '../../utils/validation';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid({ message: 'Invalid session ID format in path' }),
});

const COMMAND_SCHEMA = z.object({
  end_at: z.string().datetime({ offset: true, message: 'end_at must be an ISO 8601 instant with an offset' }).optional(),
});

export async function handleCompleteSession(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateOptionalCommandBody<typeof COMMAND_SCHEMA, CompleteSessionCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const updatedSession = await sessionRepository.complete(path!.sessionId, command!.end_at);

    if (!updatedSession) {
      const errorData = createErrorDataWithLogging(404, 'Session not found or not accessible.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<SessionDto>(updatedSession);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to complete training session';
    return handleRepositoryError(c, e as Error, handleCompleteSession.name, fallbackMessage);
  }
}
