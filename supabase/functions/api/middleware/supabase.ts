import { createClient } from "supabase";
import type { Database } from "../models/database-types.ts";
import type { Context, Next } from 'hono';
import type { AppContext } from '../context.ts';

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
