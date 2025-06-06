import angular from '@analogjs/vite-plugin-angular';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          // @ts-expect-error Plugin import type mismatch (¯\_(ツ)_/¯)
          angular(),
        ],
        resolve: {
          alias: {
            '@features': path.resolve(__dirname, 'src/app/features'),
            '@shared': path.resolve(__dirname, 'src/app/shared'),
          },
        },
        test: {
          name: {
            label: 'angular',
            color: 'white'
          },
          globals: true,
          environment: 'jsdom',
          setupFiles: ['src/test-setup.ts'],
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        resolve: {
          alias: {
            '@shared': path.resolve(__dirname, 'shared'),
          },
        },
        test: {
          name: {
            label: 'supabase',
            color: 'green'
          },
          globals: true,
          environment: 'node', // Use Node.js as runtime instead of Deno for test
          include: ['supabase/functions/**/*.test.ts'],
        }
      }
    ],
  },
  reporters: ['default'],
});
