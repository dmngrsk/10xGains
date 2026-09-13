// Template for env.js, the runtime environment configuration.
//
// CI overwrites src/env.js with this before every build, whether or not one exists: a developer's
// copy holds localhost URLs and no placeholders, so CD's substitution guard could not catch it if
// it ever reached a deployed artifact.
//
// The local `env:ensure` hook is the opposite — it only creates src/env.js when absent, so it never
// clobbers your own. In the dev container post-start.sh writes it directly with the running stack's
// values, so `ng serve` exercises the same runtime-config path as a deployed build.
//
// Deployment-specific values live here rather than inside the bundle, so that a single build can
// be deployed to any environment — CD substitutes these placeholders in the built artifact.
//
// Deliberately a separate, uncompiled file for two reasons:
//   1. Substituting inside minified JS shifts byte offsets on the line, which silently
//      invalidates the source maps for everything after it.
//   2. The CSP is `script-src 'self'` with no 'unsafe-inline', so this cannot be an inline
//      <script> in index.html.
//
// Build metadata is NOT here: it belongs to the build, not the deployment, and is stamped into
// environment.ts by CI.
window.__TXG_ENV__ = {
  name: '__ENVIRONMENT_NAME__',
  apiUrl: '__API_URL__',
  supabaseUrl: '__SUPABASE_URL__',
  supabasePublishableKey: '__SUPABASE_PUBLISHABLE_KEY__',
};
