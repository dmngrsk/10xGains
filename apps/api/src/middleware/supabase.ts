import { createClient } from "@supabase/supabase-js";
import type { Database } from "@txg/shared";
import type { Context, Next } from 'hono';
import type { AppContext } from '../context';

/**
 * Middleware to create and inject a Supabase client into the Hono context.
 *
 * This function initializes the Supabase client using environment variables and
 * the Authorization header from the incoming request. This ensures that subsequent
 * operations are performed in the context of the authenticated user.
 *
 * @param {Context<AppContext>} c - The Hono context.
 * @param {Next} next - The next middleware function in the chain.
 */
export const supabaseMiddleware = async (c: Context<AppContext>, next: Next) => {
  const req = c.req.raw;

  // Unauthenticated requests (e.g. /api/health, CORS preflight) legitimately
  // carry no Authorization header; undici rejects null header values.
  const authorization = req.headers.get('Authorization');

  const supabaseClient = createClient<Database>(
    process.env['SUPABASE_URL'] ?? '',
    process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '',
    {
      global: {
        headers: authorization ? { Authorization: authorization } : {},
      },
    }
  );

  c.set('supabase', supabaseClient);
  await next();
};
