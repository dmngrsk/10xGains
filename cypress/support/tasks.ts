import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env['CYPRESS_SUPABASE_URL'] ?? '';
const supabaseKey = process.env['CYPRESS_SUPABASE_ANON_KEY'] ?? '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export const tasks = {
  async createEphemeralUser(): Promise<{ userId: string; email: string; password: string }> {
    const email = generateTestEmail();
    const password = generateTestPassword();

    const { data, error: createError } = await supabase.auth.signUp({ email, password });

    if (createError) {
      console.error('Error creating ephemeral user:', createError);
      throw new Error(createError.message);
    }

    const { error: rpcError } = await supabase.rpc('test_scaffold_user_data');

    if (rpcError) {
      console.error('Error seeding user data:', rpcError);
      throw new Error(rpcError.message);
    }

    return { userId: data!.user!.id, email, password };
  }
};

function generateTestEmail(): string {
  const timestamp = new Date();
  const pad = (n: number, length: number = 2) => n.toString().padStart(length, '0');

  const formattedDate = timestamp.getFullYear().toString() +
    pad(timestamp.getMonth() + 1) +
    pad(timestamp.getDate()) +
    pad(timestamp.getHours()) +
    pad(timestamp.getMinutes()) +
    pad(timestamp.getSeconds()) +
    pad(timestamp.getMilliseconds(), 3);

  const random = Math.floor(Math.random() * 10000);
  return `test-${formattedDate}-rand${pad(random, 4)}@10xgains.com`;
}

function generateTestPassword(): string {
  return Math.random().toString(36).substring(2, 15);
}
