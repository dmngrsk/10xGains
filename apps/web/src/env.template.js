// Template for env.js, the runtime environment configuration.
//
// CI copies this to src/env.js before building (unconditionally — a developer's local env.js must
// never reach a deployed artifact, since it holds localhost URLs and no placeholders for CD's
// guard to catch). Locally, post-start.sh writes src/env.js directly with the running stack's
// values, so `ng serve` exercises exactly the same runtime-config path as a deployed build.
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
