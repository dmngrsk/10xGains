import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { scaffoldTestUserData } from './test-data/scaffold';

// Seeds a known local dev account (dev@10xgains.com) with sample training data, so opening the
// app in a fresh local stack shows a realistic history. Run by the dev container's post-start;
// also available as `pnpm seed`. Idempotent: the user and its data are created once, then left
// alone. Local-only by construction - it needs the local service-role key and only runs where
// that is set, so this account never reaches staging or production.

config();

const url = process.env['SUPABASE_URL'];
const secretKey = process.env['SUPABASE_SECRET_KEY'];
const email = process.env['APP_DEV_USER_EMAIL'];
const password = process.env['APP_DEV_USER_PASSWORD'];

if (!url || !secretKey || !email || !password) {
  throw new Error(
    'Cannot seed the dev user: SUPABASE_URL, SUPABASE_SECRET_KEY, APP_DEV_USER_EMAIL and ' +
    'APP_DEV_USER_PASSWORD must all be set (see .env.example).'
  );
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function resolveUserId(): Promise<string> {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true
  });

  if (created?.user) {
    return created.user.id;
  }

  // Already registered - look it up instead of failing.
  if (createError && /already|registered|exists/i.test(createError.message)) {
    const { data, error } = await supabase.auth.admin.listUsers();
    const existing = data?.users.find(u => u.email === email);

    if (error || !existing) {
      throw new Error(`Dev user ${email} exists but could not be resolved: ${error?.message ?? 'not found'}`);
    }

    return existing.id;
  }

  throw new Error(`Could not create the dev user ${email}: ${createError?.message ?? 'unknown error'}`);
}

async function main(): Promise<void> {
  const userId = await resolveUserId();

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('active_plan_id').eq('id', userId).maybeSingle();

  if (profileError) {
    throw new Error(`Could not read the dev user's profile: ${profileError.message}`);
  }

  if (profile?.active_plan_id) {
    console.log(`Dev user ${email} already has sample data; nothing to do.`);
    return;
  }

  const { error: scaffoldError } = await scaffoldTestUserData(supabase, userId);

  if (scaffoldError) {
    throw new Error(`Could not seed the dev user's sample data: ${scaffoldError.message}`);
  }

  console.log(`Seeded dev user ${email} with sample training data.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
