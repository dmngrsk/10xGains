import { createClient } from "supabase";
import type { Database } from "../models/database-types.ts";
import type { Context, Next } from 'hono';
import type { AppContext } from '../context.ts';

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

  const supabaseClient = createClient<Database>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );

  c.set('supabase', supabaseClient);
  await next();
};
