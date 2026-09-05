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

// The token travels in the body rather than the path or a query string, so it stays out of access
// logs and referrer headers - it is a bearer credential, and URLs are recorded in more places than
// request bodies are.
const BODY_SCHEMA = z.object({
  token: z.string().min(1, 'A session action token is required'),
});

/**
 * Completes a set for a caller holding a session action token instead of a user session.
 *
 * Deliberately mounted without `requiredAuthMiddleware`: the request comes from a service worker
 * acting on a notification, which has no JWT to present. The token is the entire authorisation, and
 * the database is what validates it - see `complete_session_set_with_action_token`.
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
