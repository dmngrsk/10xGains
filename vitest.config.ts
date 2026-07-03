import { defineConfig } from 'vitest/config';

// Runs the Supabase Edge Function unit tests under Node.
// Temporary: this project moves to apps/api when the backend is ported
// to Azure Functions; the Angular tests live in apps/web/vitest.config.ts.
export default defineConfig({
  test: {
    name: {
      label: 'api',
      color: 'green'
    },
    globals: true,
    environment: 'node', // Use Node.js as runtime instead of Deno for test
    include: ['supabase/functions/**/*.test.ts'],
  },
  reporters: ['default'],
});
