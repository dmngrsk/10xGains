import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, createErrorDataWithLogging, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { SessionSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
  setId: z.string().uuid('Invalid setId format'),
});

export async function handleGetTrainingSessionSetById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const sessionSet = await sessionRepository.findSetById(path!.sessionId, path!.setId);

    if (!sessionSet) {
      const errorData = createErrorDataWithLogging(404, `Session set with ID ${path!.setId} not found in session ${path!.sessionId}.`);
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<SessionSetDto>(sessionSet);
    return c.json(successData, 200);

  } catch (e) {
    const fallbackMessage = 'Failed to fetch session set';
    return handleRepositoryError(c, e as Error, sessionRepository.handleSessionOwnershipError, handleGetTrainingSessionSetById.name, fallbackMessage);
  }
}
