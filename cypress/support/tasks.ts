import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateTestEmail, generateTestPassword } from './test-data/auth';
import { scaffoldTestUserData } from './test-data/scaffold';

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
  async 'users:createEphemeral'({ prefix }: { prefix: string }): Promise<{ userId: string; email: string; password: string }> {
    const email = generateTestEmail(prefix);
    const password = generateTestPassword();
    
    const { data: createData, error: createError } = await supabase!.auth.admin.createUser({ email, password, email_confirm: true });
    const { error: signInError } = await supabase!.auth.signInWithPassword({ email, password });
    
    if (createError || signInError) {
      console.error('Error creating ephemeral user:', createError);
      throw new Error((createError ?? signInError)?.message);
    }
    
    const userId = createData!.user!.id;
    const { error: rpcError } = await scaffoldTestUserData(supabase!, userId);
 
    if (rpcError) {
      console.error('Error scaffolding user data:', rpcError);
      throw new Error(rpcError.message);
    }

    return { userId, email, password };
  },

  async 'users:deleteEphemeral'({ userId }: { userId: string }): Promise<null> {
    const { error: deleteError } = await supabase!.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting ephemeral user:', deleteError);
      throw new Error(deleteError.message);
    }

    return null;
  },

  async 'plans:resetActivePlan'({ userId }: { userId: string }): Promise<null> {
    const { data: profile, error: profileError } = await supabase!.from('profiles').select('active_plan_id').eq('id', userId).single();
    const { error: updateError } = await supabase!.from('profiles').update({ active_plan_id: null }).eq('id', userId);
    const { error: deleteError } = await supabase!.from('sessions').delete().eq('plan_id', profile?.active_plan_id);

    if (profileError || updateError || deleteError) {
      console.error('Error removing active plan:', profileError ?? updateError ?? deleteError);
      throw new Error((profileError ?? updateError ?? deleteError)?.message);
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
