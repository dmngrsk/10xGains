import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateTestEmail, generateTestPassword } from './test-data/auth';
import { scaffoldTestUserData } from './test-data/scaffold';

config();

const CANARY_AUTO_CREATE_ENVIRONMENTS = ['staging', 'development'];
const CANARY_PASSWORD_PLACEHOLDER = '<canary user password>';
let canaryScaffoldVerified = false;

const supabaseUrl = process.env['SUPABASE_URL'] ?? '';
const supabasePublishableKey = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '';
const supabaseSecretKey = process.env['SUPABASE_SECRET_KEY'] ?? '';
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseSecretKey) {
  supabase = createClient(supabaseUrl, supabaseSecretKey, {
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
  },

  async 'users:ensureCanaryScaffolded'({ email, password }: { email: string; password: string }): Promise<{ scaffolded: boolean }> {
    if (canaryScaffoldVerified) {
      return { scaffolded: false };
    }

    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error(
        'Cannot verify the canary user\'s test data: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not configured for Cypress. ' +
        'Set both (see .env.example) so the canary user can be checked before each run.'
      );
    }

    const publishableSupabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: signInData, error: signInError } = await publishableSupabase.auth.signInWithPassword({ email, password });
    let userId: string;
    let hasTestData = false;

    if (signInData.user) {
      userId = signInData.user.id;
      const { data: profile, error: profileError } = await publishableSupabase.from('profiles').select('active_plan_id').eq('id', userId).maybeSingle();

      if (profileError) {
        throw new Error(`Could not read the canary user's profile: ${profileError.message}`);
      }

      hasTestData = !!profile?.active_plan_id;
    } else {
      const environment = process.env['CYPRESS_ENVIRONMENT'] ?? '';
      const canAutoCreate = CANARY_AUTO_CREATE_ENVIRONMENTS.includes(environment) && !!supabase;

      if (!canAutoCreate) {
        throw new Error(
          `Could not sign in as the canary user (${email}): ${signInError?.message ?? 'unknown error'}. ` +
          'The canary user must already exist in this environment - see "Canary User Setup" in docs/ci-cd-spec.md.'
        );
      }

      if (!password || password === CANARY_PASSWORD_PLACEHOLDER) {
        throw new Error(
          `Cannot auto-create the canary user (${email}) on ${environment}: APP_CANARY_USER_PASSWORD is empty or still set to ` +
          'the placeholder value from .env.example. Set a real password, then re-run the tests - see "Canary User Setup" in docs/ci-cd-spec.md.'
        );
      }

      const { data: createData, error: createError } = await supabase!.auth.admin.createUser({ email, password, email_confirm: true });

      if (createError || !createData.user) {
        throw new Error(
          `Could not auto-create the canary user (${email}) on ${environment}: ${createError?.message ?? 'unknown error'}. ` +
          'If the user already exists, APP_CANARY_USER_PASSWORD likely does not match its actual password.'
        );
      }

      userId = createData.user.id;
    }

    if (hasTestData) {
      canaryScaffoldVerified = true;
      return { scaffolded: false };
    }

    if (!supabase) {
      throw new Error(
        `The canary user (${email}) has no test data (no active training plan), and this environment has no SUPABASE_SECRET_KEY ` +
        'configured, so Cypress cannot seed it automatically - by design, Cypress never gets service-role access in production. ' +
        'Seed the canary user\'s test data manually, then re-run the tests - see "Canary User Setup" in docs/ci-cd-spec.md.'
      );
    }

    const { error: scaffoldError } = await scaffoldTestUserData(supabase, userId);

    if (scaffoldError) {
      console.error('Error scaffolding canary user data:', scaffoldError);
      throw new Error(scaffoldError.message);
    }

    canaryScaffoldVerified = true;
    return { scaffolded: true };
  }
};
