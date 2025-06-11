import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

config();

let supabase: SupabaseClient | null = null;
const supabaseUrl = process.env['SUPABASE_URL'] ?? '';
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export const tasks = {
  async 'users:createEphemeral'(): Promise<{ userId: string; email: string; password: string }> {
    const email = generateTestEmail();
    const password = generateTestPassword();

    const { data: createData, error: createError } = await supabase!.auth.admin.createUser({ email, password, email_confirm: true });
    const { error: signInError } = await supabase!.auth.signInWithPassword({ email, password });

    if (createError || signInError) {
      console.error('Error creating ephemeral user:', createError);
      throw new Error((createError ?? signInError)?.message);
    }

    const { error: rpcError } = await supabase!.rpc('test_scaffold_user_data');

    if (rpcError) {
      console.error('Error seeding user data:', rpcError);
      throw new Error(rpcError.message);
    }

    return { userId: createData!.user!.id, email, password };
  },

  async 'users:deleteEphemeral'({ userId }: { userId: string }): Promise<null> {
    const { error: deleteError } = await supabase!.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting ephemeral user:', deleteError);
      throw new Error(deleteError.message);
    }

    return null;
  },

  async 'plans:resetActiveTrainingPlan'({ userId }: { userId: string }): Promise<null> {
    const { data: userProfile, error: userProfileError } = await supabase!.from('user_profiles').select('active_training_plan_id').eq('id', userId).single();
    const { error: updateError } = await supabase!.from('user_profiles').update({ active_training_plan_id: null }).eq('id', userId);
    const { error: deleteError } = await supabase!.from('training_sessions').delete().eq('training_plan_id', userProfile?.active_training_plan_id);

    if (userProfileError || updateError || deleteError) {
      console.error('Error removing active plan:', userProfileError ?? updateError ?? deleteError);
      throw new Error((userProfileError ?? updateError ?? deleteError)?.message);
    }

    return null;
  },

  async 'exercises:deleteExercise'({ name }: { name: string }): Promise<null> {
    const { data, error: dataError } = await supabase!.from('exercises').select('id').eq('name', name).single();
    const { count, error: deleteError } = await supabase!.from('exercises').delete({ count: 'exact' }).eq('id', data!.id);

    if (dataError || deleteError || count !== 1) {
      console.error('Error deleting exercise:', dataError ?? deleteError ?? `Expected 1 exercise to be deleted, but got ${count}`);
      throw new Error((dataError ?? deleteError)?.message ?? `Expected 1 exercise to be deleted, but got ${count}`);
    }

    return null;
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
