import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { SessionDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from '../../utils/validation.ts';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

export async function handleGetSessionById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const session = await sessionRepository.findById(path!.sessionId);

    if (!session) {
      const errorData = createErrorDataWithLogging(404, 'Session not found.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<SessionDto>(session);
    return c.json(successData, 200);

  } catch (e) {
    const fallbackMessage = 'Failed to retrieve training session';
    return handleRepositoryError(c, e as Error, sessionRepository.handleSessionOwnershipError, handleGetSessionById.name, fallbackMessage);
  }
}
