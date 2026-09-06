import { createClient } from '@supabase/supabase-js';
import { generateTestEmail, generateTestPassword } from '../test-data/auth';
import { scaffoldTestUserData } from '../test-data/scaffold';
import { supabase, supabaseUrl, supabasePublishableKey, supabaseSecretKey } from './supabase';

export type ScaffoldedUserRole = 'canary' | 'dev';

export const AUTO_CREATE_ENVIRONMENTS = ['staging', 'development'];

const PASSWORD_PLACEHOLDERS: Partial<Record<ScaffoldedUserRole, string>> = {
  canary: '<canary user password>'
};

const DOCS_SECTIONS: Record<ScaffoldedUserRole, string> = {
  canary: 'Canary User Setup',
  dev: 'Dev User Setup'
};

const REQUIRED_ROLES: ScaffoldedUserRole[] = ['canary'];

const scaffoldResults = new Map<ScaffoldedUserRole, EnsureUserScaffoldedResult>();

export interface EnsureUserScaffoldedResult {
  userId: string | null;
  message: string;
}

function environmentName(): string {
  return process.env['CYPRESS_ENVIRONMENT'] ?? '';
}

export function canAutoCreateUsers(): boolean {
  return AUTO_CREATE_ENVIRONMENTS.includes(environmentName()) && !!supabase;
}

export async function ensureUserScaffolded(
  { email, password, role }: { email: string; password: string; role: ScaffoldedUserRole }
): Promise<{ scaffolded: boolean; userId: string }> {
  const docs = `see "${DOCS_SECTIONS[role]}" in docs/ci-cd.md`;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      `Cannot verify the ${role} user's test data: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not configured for Cypress. ` +
      'Set both (see .env.example) so the account can be checked before each run.'
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
      throw new Error(`Could not read the ${role} user's profile: ${profileError.message}`);
    }

    hasTestData = !!profile?.active_plan_id;
  } else {
    const environment = environmentName();

    if (!canAutoCreateUsers()) {
      throw new Error(
        `Could not sign in as the ${role} user (${email}): ${signInError?.message ?? 'unknown error'}. ` +
        `The ${role} user must already exist in this environment - ${docs}.`
      );
    }

    if (!password || password === PASSWORD_PLACEHOLDERS[role]) {
      throw new Error(
        `Cannot auto-create the ${role} user (${email}) on ${environment}: APP_${role.toUpperCase()}_USER_PASSWORD is empty or still set to ` +
        `the placeholder value from .env.example. Set a real password, then re-run the tests - ${docs}.`
      );
    }

    const { data: createData, error: createError } = await supabase!.auth.admin.createUser({ email, password, email_confirm: true });

    if (createError || !createData.user) {
      throw new Error(
        `Could not auto-create the ${role} user (${email}) on ${environment}: ${createError?.message ?? 'unknown error'}. ` +
        `If the user already exists, APP_${role.toUpperCase()}_USER_PASSWORD likely does not match its actual password.`
      );
    }

    userId = createData.user.id;
  }

  if (hasTestData) {
    return { scaffolded: false, userId };
  }

  if (!supabase) {
    throw new Error(
      `The ${role} user (${email}) has no test data (no active training plan), and this environment has no SUPABASE_SECRET_KEY ` +
      'configured, so Cypress cannot seed it automatically - by design, Cypress never gets service-role access in production. ' +
      `Seed the ${role} user's test data manually, then re-run the tests - ${docs}.`
    );
  }

  const { error: scaffoldError } = await scaffoldTestUserData(supabase, userId);

  if (scaffoldError) {
    console.error(`Error scaffolding ${role} user data:`, scaffoldError);
    throw new Error(scaffoldError.message);
  }

  return { scaffolded: true, userId };
}

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

  async 'users:ensureUserScaffolded'(
    { email, password, role }: { email?: string; password?: string; role: ScaffoldedUserRole }
  ): Promise<EnsureUserScaffoldedResult> {
    const cached = scaffoldResults.get(role);

    if (cached) {
      return cached;
    }

    const result = await resolveScaffoldedUser(email, password, role);
    scaffoldResults.set(role, result);
    return result;
  }
};

async function resolveScaffoldedUser(
  email: string | undefined, password: string | undefined, role: ScaffoldedUserRole
): Promise<EnsureUserScaffoldedResult> {
  const required = REQUIRED_ROLES.includes(role);
  const skip = (message: string): EnsureUserScaffoldedResult => {
    if (required) {
      throw new Error(message);
    }

    return { userId: null, message: `Skipped the ${role} user: ${message}` };
  };

  if (!email || !password) {
    return skip(`APP_${role.toUpperCase()}_USER_EMAIL / APP_${role.toUpperCase()}_USER_PASSWORD are not set (see .env.example).`);
  }

  if (!required && !canAutoCreateUsers()) {
    return skip(`'${environmentName()}' is not one of ${AUTO_CREATE_ENVIRONMENTS.join(', ')}.`);
  }

  try {
    const { scaffolded, userId } = await ensureUserScaffolded({ email, password, role });

    return {
      userId,
      message: scaffolded
        ? `Seeded ${role} user ${email} with sample training data.`
        : `The ${role} user ${email} already has sample data.`
    };
  } catch (err) {
    if (required) {
      throw err;
    }

    const message = `Could not provision the ${role} user ${email}: ${err instanceof Error ? err.message : String(err)}`;
    console.warn(message);
    return { userId: null, message };
  }
}
