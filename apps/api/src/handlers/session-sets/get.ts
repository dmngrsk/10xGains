import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { SessionSetDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { validatePathParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

export async function handleGetSessionSets(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const sessionSets = await sessionRepository.findSetsBySessionId(path!.sessionId);

    const successData = createSuccessData<SessionSetDto[]>(sessionSets);
    return c.json(successData, 200);

  } catch (e) {
    const fallbackMessage = 'Failed to fetch session sets';
    return handleRepositoryError(c, e as Error, handleGetSessionSets.name, fallbackMessage);
  }
}
