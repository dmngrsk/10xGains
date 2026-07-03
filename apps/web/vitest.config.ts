import angular from '@analogjs/vite-plugin-angular';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // @ts-expect-error Plugin import type mismatch (¯\_(ツ)_/¯)
    angular(),
  ],
  resolve: {
    alias: {
      '@features': path.resolve(__dirname, 'src/app/features'),
      '@shared': path.resolve(__dirname, 'src/app/shared'),
      '@txg/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    name: {
      label: 'web',
      color: 'white'
    },
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
  reporters: ['default'],
});
