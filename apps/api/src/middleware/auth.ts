import type { Context, Next } from 'hono';
import { createErrorData, createErrorDataWithLogging } from '../utils/api-helpers';
import type { AppContext, AuthenticatedUser } from '../context';

/** Extracts the bearer token from an Authorization header, if there is one. */
function readBearerToken(c: Context<AppContext>): string | null {
  const authorization = c.req.header('Authorization');
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Creates an authentication middleware for Hono.
 *
 * This middleware checks for a valid Supabase user session. It can be configured
 * to either require authentication or treat it as optional.
 *
 * @param {boolean} [requireAuth=true] - If true, the middleware will return a 401 Unauthorized error if the user is not authenticated.
 * @returns {Function} The Hono middleware function.
 */
export const authMiddleware = (requireAuth = true) => async (c: Context<AppContext>, next: Next) => {
  const supabaseClient = c.get('supabase');
  if (!supabaseClient) {
    const errorData = createErrorDataWithLogging(
      500,
      "Auth provider not found",
      { details: "Auth provider not found" },
      "AUTH_PROVIDER_NOT_FOUND",
    );
    return c.json(errorData, 500);
  }

  const token = readBearerToken(c);
  const { data, error: authError } = token
    ? await supabaseClient.auth.getClaims(token)
    : { data: null, error: null };

  const claims = data?.claims;
  const sessionUser: AuthenticatedUser | null = claims?.sub
    ? { id: claims.sub, email: claims.email, role: claims.role }
    : null;

  if (requireAuth && !sessionUser) {
    console.error("Auth error or no user in session:", authError?.message);
    const errorData = createErrorData(
      401,
      "Authentication required",
      { details: authError?.message || "No user session", },
      "AUTH_REQUIRED",
    );
    return c.json(errorData, 401);
  }

  if (sessionUser) {
    c.set('user', sessionUser);
  }

  return next();
};

/**
 * Middleware that requires a user to be authenticated.
 * If authentication fails, it returns a 401 Unauthorized error.
 */
export const requiredAuthMiddleware = authMiddleware(true);
