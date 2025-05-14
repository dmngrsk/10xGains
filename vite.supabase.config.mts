import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    name: 'supabase',
    globals: true,
    environment: 'node', // Use Node.js as runtime instead of Deno for test
    include: ['supabase/functions/**/*.test.ts'],
    reporters: ['default'],
  },
  define: {
    'import.meta.vitest': mode !== 'production',
  },
}));
