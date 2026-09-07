/**
 * Deployment configuration is supplied at runtime by `env.js`, which CD substitutes per
 * environment — see that file for why it is not compiled into the bundle.
 *
 * Only build metadata is baked in at build time, by CI.
 */
interface RuntimeEnvironment {
  name: string;
  apiUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
}

const runtime = (window as unknown as { __TXG_ENV__?: RuntimeEnvironment }).__TXG_ENV__;

if (!runtime) {
  // Nothing downstream can work without this, and an empty URL surfaces later as an opaque
  // "supabaseUrl is required" from the Supabase client. Fail where the cause is visible.
  throw new Error(
    'Runtime configuration is missing: /env.js did not load. ' +
    'Locally, run `pnpm env:ensure` in apps/web; a deployed build has it substituted by CD.'
  );
}

// `env:ensure` copies env.template.js, whose values are all placeholders. The object is truthy, so
// the check above passes and the failures land far away: name is not 'development', which turns on
// a service worker `ng serve` never emits, and createClient('__SUPABASE_URL__') throws Invalid URL.
if (Object.values(runtime).some((v) => typeof v === 'string' && /^__.*__$/.test(v))) {
  throw new Error(
    'Runtime configuration still holds template placeholders: env.js was copied from ' +
    'env.template.js but never filled in. Start the local stack (.devcontainer/post-start.sh ' +
    'writes it), or edit apps/web/src/env.js with your local URLs.'
  );
}

export const environment = {
  name: runtime?.name ?? '',
  // Only the production build emits ngsw-worker.js; registering it under `ng serve` fails.
  enableServiceWorker: runtime?.name !== undefined && runtime.name !== 'development',
  build: {
    name: '__BUILD_NAME__',
    sha: '__BUILD_SHA__',
    tag: '__BUILD_TAG__',
  },
  api: {
    url: runtime?.apiUrl ?? '',
  },
  supabase: {
    url: runtime?.supabaseUrl ?? '',
    key: runtime?.supabasePublishableKey ?? '',
  }
};
