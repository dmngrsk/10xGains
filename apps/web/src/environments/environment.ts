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
