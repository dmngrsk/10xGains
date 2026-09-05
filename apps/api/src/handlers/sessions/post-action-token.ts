import { z } from 'zod';
import type { Context } from 'hono';
import type { SessionActionTokenDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import { validatePathParams } from '../../utils/validation';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid({ message: 'Invalid session ID format in path' }),
});

export async function handleCreateSessionActionToken(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const sessionActionTokenRepository = c.get('sessionActionTokenRepository');

  try {
    const token = await sessionActionTokenRepository.mint(path!.sessionId);

    const successData = createSuccessData<SessionActionTokenDto>(token);
    return c.json(successData, 201);
  } catch (e) {
    const fallbackMessage = 'Failed to mint a session action token';
    return handleRepositoryError(c, e as Error, handleCreateSessionActionToken.name, fallbackMessage);
  }
}
