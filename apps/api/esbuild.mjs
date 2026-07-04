import { build } from 'esbuild';

// Bundle everything (hono, supabase-js, zod, @txg/shared) into a single CJS
// file so the deployment package never contains pnpm's symlinked node_modules.
// @azure/functions stays external: the Functions worker must share the same
// module instance that registered the handler.
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['@azure/functions'],
  logLevel: 'info',
});
