import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { SessionDto, UpdateSessionCommand } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from '../../utils/validation.ts';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

const COMMAND_SCHEMA = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export async function handlePutSessionById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateSessionCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const updatedSession = await sessionRepository.update(path!.sessionId, command!);

    if (!updatedSession) {
      const errorData = createErrorDataWithLogging(404, 'Session not found for update.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<SessionDto>(updatedSession);
    return c.json(successData, 200);

  } catch (e) {
    const fallbackMessage = 'Failed to update training session';
    return handleRepositoryError(c, e as Error, sessionRepository.handleSessionOwnershipError, handlePutSessionById.name, fallbackMessage);
  }
}
