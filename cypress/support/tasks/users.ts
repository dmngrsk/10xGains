import { createClient } from '@supabase/supabase-js';
import { generateTestEmail, generateTestPassword } from '../test-data/auth';
import { scaffoldTestUserData } from '../test-data/scaffold';
import { supabase, supabaseUrl, supabasePublishableKey, supabaseSecretKey } from './supabase';

const CANARY_AUTO_CREATE_ENVIRONMENTS = ['staging', 'development'];
const CANARY_PASSWORD_PLACEHOLDER = '<canary user password>';
let canaryScaffoldVerified = false;
let canaryUserId: string | null = null;

export const usersTasks = {
  async 'users:create'({ prefix, scaffold = false, userMetadata }: { prefix: string; scaffold?: boolean; userMetadata?: Record<string, unknown> }): Promise<{ userId: string; email: string; password: string }> {
    const email = generateTestEmail(prefix);
    const password = generateTestPassword();

    const { data: createData, error: createError } = await supabase!.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: userMetadata });

    if (createError || !createData.user) {
      console.error('Error creating test user:', createError);
      throw new Error(createError?.message ?? 'No user data returned');
    }

    const userId = createData.user.id;

    const verifyClient = createClient(supabaseUrl, supabasePublishableKey || supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { error: signInError } = await verifyClient.auth.signInWithPassword({ email, password });

    if (signInError) {
      console.error('Error verifying test user credentials:', signInError);
      throw new Error(signInError.message);
    }

    if (scaffold) {
      const { error: rpcError } = await scaffoldTestUserData(supabase!, userId);

      if (rpcError) {
        console.error('Error scaffolding user data:', rpcError);
        throw new Error(rpcError.message);
      }
    }

    return { userId, email, password };
  },

  async 'users:delete'({ userId }: { userId: string }): Promise<null> {
    const { error: deleteError } = await supabase!.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting test user:', deleteError);
      throw new Error(deleteError.message);
    }

    return null;
  },

  async 'users:ensureCanaryScaffolded'({ email, password }: { email: string; password: string }): Promise<{ scaffolded: boolean; userId: string }> {
    if (canaryScaffoldVerified && canaryUserId) {
      return { scaffolded: false, userId: canaryUserId };
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
          'The canary user must already exist in this environment - see "Canary User Setup" in docs/ci-cd.md.'
        );
      }

      if (!password || password === CANARY_PASSWORD_PLACEHOLDER) {
        throw new Error(
          `Cannot auto-create the canary user (${email}) on ${environment}: APP_CANARY_USER_PASSWORD is empty or still set to ` +
          'the placeholder value from .env.example. Set a real password, then re-run the tests - see "Canary User Setup" in docs/ci-cd.md.'
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
      canaryUserId = userId;
      return { scaffolded: false, userId };
    }

    if (!supabase) {
      throw new Error(
        `The canary user (${email}) has no test data (no active training plan), and this environment has no SUPABASE_SECRET_KEY ` +
        'configured, so Cypress cannot seed it automatically - by design, Cypress never gets service-role access in production. ' +
        'Seed the canary user\'s test data manually, then re-run the tests - see "Canary User Setup" in docs/ci-cd.md.'
      );
    }

    const { error: scaffoldError } = await scaffoldTestUserData(supabase, userId);

    if (scaffoldError) {
      console.error('Error scaffolding canary user data:', scaffoldError);
      throw new Error(scaffoldError.message);
    }

    canaryScaffoldVerified = true;
    canaryUserId = userId;
    return { scaffolded: true, userId };
  }
};
