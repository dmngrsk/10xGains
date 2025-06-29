import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { SessionDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from '../../utils/validation.ts';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid({ message: 'Invalid session ID format in path' }),
});

export async function handleCompleteSession(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const updatedSession = await sessionRepository.complete(path!.sessionId);

    if (!updatedSession) {
      const errorData = createErrorDataWithLogging(404, 'Session not found or not accessible.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<SessionDto>(updatedSession);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to complete training session';
    const mergedErrorHandler = (error: Error) =>
      sessionRepository.handleSessionCompletionError(error) ||
      sessionRepository.handlePlanMissingError(error) ||
      sessionRepository.handleSessionOwnershipError(error);
    return handleRepositoryError(c, e as Error, mergedErrorHandler, handleCompleteSession.name, fallbackMessage);
  }
}
