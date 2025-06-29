import type { Context, Next } from 'hono';
import { createErrorData, createErrorDataWithLogging } from '../utils/api-helpers.ts';
import type { AppContext } from '../context.ts';

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

  const { data: { user: sessionUser }, error: authError } = await supabaseClient.auth.getUser();

  if (requireAuth && (authError || !sessionUser)) {
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

  await next();
};

/**
 * Middleware that requires a user to be authenticated.
 * If authentication fails, it returns a 401 Unauthorized error.
 */
export const requiredAuthMiddleware = authMiddleware(true);

/**
 * Middleware that treats authentication as optional.
 * If a user is authenticated, their info is set in the context; otherwise, the request proceeds without a user.
 */
export const optionalAuthMiddleware = authMiddleware(false);
