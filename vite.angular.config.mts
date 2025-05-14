/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    angular(),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/app/shared'),
    },
  },
  test: {
    name: 'angular',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
  define: {
    'import.meta.vitest': mode !== 'production',
  },
}));
