import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
  setId: z.string().uuid('Invalid setId format'),
});

export async function handleDeleteSessionSetById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const deleted = await sessionRepository.deleteSet(path!.sessionId, path!.setId);

    if (!deleted) {
      const errorData = createErrorDataWithLogging(404, `Session set with ID ${path!.setId} not found for deletion.`);
      return c.json(errorData, 404);
    }

    return c.body(null, 204);
  } catch (e) {
    const fallbackMessage = 'Failed to delete session set';
    return handleRepositoryError(c, e as Error, sessionRepository.handleSessionOwnershipError, handleDeleteSessionSetById.name, fallbackMessage);
  }
}
