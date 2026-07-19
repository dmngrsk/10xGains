import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

config();

export const supabaseUrl = process.env['SUPABASE_URL'] ?? '';
export const supabasePublishableKey = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '';
export const supabaseSecretKey = process.env['SUPABASE_SECRET_KEY'] ?? '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
