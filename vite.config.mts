/// <reference types="vitest" />

import angular from '@analogjs/vite-plugin-angular';
import path from 'path';

import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      angular(),

    ],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/app/shared'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['**/*.spec.ts'],
      reporters: ['default'],
    },
    define: {
      'import.meta.vitest': mode !== 'production',
    },
  };
});
