import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from '../../utils/validation.ts';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

export async function handleDeleteTrainingSessionById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const deleted = await sessionRepository.delete(path!.sessionId);

    if (!deleted) {
      const errorData = createErrorDataWithLogging(404, 'Training session not found for deletion.');
      return c.json(errorData, 404);
    }

    return c.body(null, 204);

  } catch (e) {
    const fallbackMessage = 'Failed to delete training session';
    return handleRepositoryError(c, e as Error, sessionRepository.handleSessionOwnershipError, handleDeleteTrainingSessionById.name, fallbackMessage);
  }
}
