import { config } from 'dotenv';
import { AUTO_CREATE_ENVIRONMENTS, canAutoCreateUsers, ensureUserScaffolded, ScaffoldedUserRole } from './tasks/users';

config();

const ROLES: ScaffoldedUserRole[] = ['canary', 'dev'];

async function main(): Promise<void> {
  if (!process.env['SUPABASE_SECRET_KEY']) {
    throw new Error('Cannot seed: SUPABASE_SECRET_KEY must be set (see .env.example).');
  }

  if (!canAutoCreateUsers()) {
    throw new Error(
      `Refusing to seed: CYPRESS_ENVIRONMENT is '${process.env['CYPRESS_ENVIRONMENT'] ?? ''}', ` +
      `and these accounts are only ever created on ${AUTO_CREATE_ENVIRONMENTS.join(' or ')}.`
    );
  }

  for (const role of ROLES) {
    const email = process.env[`APP_${role.toUpperCase()}_USER_EMAIL`];
    const password = process.env[`APP_${role.toUpperCase()}_USER_PASSWORD`];

    if (!email || !password) {
      throw new Error(`Cannot seed the ${role} user: APP_${role.toUpperCase()}_USER_EMAIL and APP_${role.toUpperCase()}_USER_PASSWORD must both be set (see .env.example).`);
    }

    const { scaffolded } = await ensureUserScaffolded({ email, password, role });

    console.log(scaffolded
      ? `Seeded ${role} user ${email} with sample training data.`
      : `The ${role} user ${email} already has sample data; nothing to do.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
