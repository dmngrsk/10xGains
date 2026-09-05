import { z } from 'zod';
import type { Context } from 'hono';
import type { CompleteSessionSetWithTokenResponseDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { createErrorData, createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import { validatePathParams } from '../../utils/validation';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
  setId: z.string().uuid('Invalid setId format'),
});

const BODY_SCHEMA = z.object({
  token: z.string().min(1, 'A session action token is required'),
});

/**
 * Completes a set for a caller holding a session action token instead of a user session.
 *
 * Deliberately mounted without `requiredAuthMiddleware`: the caller is a service worker with no JWT
 * to present. The token is the entire authorisation, validated in the database.
 */
export async function handleCompleteSessionSetWithToken(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const parsedBody = BODY_SCHEMA.safeParse(await c.req.json().catch(() => null));
  if (!parsedBody.success) {
    const errorData = createErrorData(400, 'Invalid request body.', { type: 'validation_error' }, 'VALIDATION_ERROR');
    return c.json(errorData, 400);
  }

  const sessionActionTokenRepository = c.get('sessionActionTokenRepository');

  try {
    const result = await sessionActionTokenRepository.consume(parsedBody.data.token, path!.sessionId, path!.setId);

    const successData = createSuccessData<CompleteSessionSetWithTokenResponseDto>(result);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to complete session set with a session action token';
    return handleRepositoryError(c, e as Error, handleCompleteSessionSetWithToken.name, fallbackMessage);
  }
}
