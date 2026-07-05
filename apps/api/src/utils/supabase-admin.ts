import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@txg/shared';

/**
 * Creates a Supabase client authenticated with the service-role (secret) key.
 *
 * Intended ONLY for background workers (e.g. the push queue trigger) that run
 * without a user JWT and must read across users. This bypasses RLS, so it must
 * never be used in request-scoped handlers — those use the publishable key plus
 * the caller's JWT via `supabaseMiddleware`.
 */
export function createAdminSupabaseClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env['SUPABASE_URL'] ?? '',
    process.env['SUPABASE_SECRET_KEY'] ?? '',
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
