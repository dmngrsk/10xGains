/* eslint-disable @typescript-eslint/no-require-imports */

import { defineConfig } from "cypress";
import { config } from "dotenv";
import { tasks } from "./cypress/support/tasks";

config();

export default defineConfig({
  env: {
    CANARY_USER_EMAIL: process.env['CYPRESS_CANARY_USER_EMAIL'],
    CANARY_USER_PASSWORD: process.env['CYPRESS_CANARY_USER_PASSWORD'],
    ENVIRONMENT: process.env['CYPRESS_ENVIRONMENT'],
    SUPABASE_URL: process.env['CYPRESS_SUPABASE_URL'],
    SUPABASE_SERVICE_ROLE_KEY: process.env['CYPRESS_SUPABASE_SERVICE_ROLE_KEY'],
  },
  e2e: {
    baseUrl: process.env['CYPRESS_BASE_URL'],
    experimentalRunAllSpecs: true,
    setupNodeEvents(on, config) {
      if (process.env['CYPRESS_SUPABASE_SERVICE_ROLE_KEY']) {
        on('task', tasks);
      }

      require('@cypress/grep/src/plugin')(config);
      return config;
    },
  },
});
