import type { Context, Next } from 'hono';
import { createErrorDataWithLogging, createRequestInfo } from '../utils/api-helpers.ts';
import type { AppContext } from '../context.ts';

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
  const requestInfo = createRequestInfo(c.req.raw);

  if (requireAuth && (authError || !sessionUser)) {
    console.error("Auth error or no user in session:", authError?.message);
    const errorData = createErrorDataWithLogging(
      401,
      "Authentication required",
      {
        details: authError?.message || "No user session",
      },
      "AUTH_REQUIRED",
      authError,
      requestInfo,
    );
    return c.json(errorData, 401);
  }

  if (sessionUser) {
    c.set('user', sessionUser);
  }

  await next();
};

export const requiredAuthMiddleware = authMiddleware(true);
export const optionalAuthMiddleware = authMiddleware(false);
