import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { SessionDto, SessionStatus, UpdateSessionCommand } from '@txg/shared';
import type { AppContext } from '../../context';
import { validateCommandBody, validatePathParams } from '../../utils/validation';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

/**
 * The statuses a plain update may set.
 *
 * COMPLETED is deliberately excluded. Completing a session is a pipeline - it calculates weight
 * progressions, skips the sets left pending, and stamps the session atomically - and none of that
 * runs on a plain PUT.
 *
 * This only constrains the status being moved *to*. The repository separately refuses to move a
 * session out of a finished status, which is what stops a COMPLETED session being reopened as
 * IN_PROGRESS and then completed a second time.
 */
const UPDATABLE_SESSION_STATUSES = ['PENDING', 'IN_PROGRESS', 'CANCELLED'] as const satisfies readonly SessionStatus[];

const COMMAND_SCHEMA = z.object({
  status: z.enum(UPDATABLE_SESSION_STATUSES, {
    message: "Status 'COMPLETED' cannot be set here; use POST /sessions/:sessionId/complete instead",
  }).optional(),
  notes: z.string().max(5000, 'Notes must not exceed 5000 characters').nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update"
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
    return handleRepositoryError(c, e as Error, handlePutSessionById.name, fallbackMessage);
  }
}
