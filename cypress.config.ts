/* eslint-disable @typescript-eslint/no-require-imports */

import { defineConfig } from "cypress";
import { config } from "dotenv";
import { tasks } from "./cypress/support/tasks";

config();

export default defineConfig({
  env: {
    CANARY_USER_EMAIL: process.env['APP_CANARY_USER_EMAIL'],
    CANARY_USER_PASSWORD: process.env['APP_CANARY_USER_PASSWORD'],
    ENVIRONMENT: process.env['CYPRESS_ENVIRONMENT'],
  },
  e2e: {
    baseUrl: process.env['CYPRESS_BASE_URL'],
    defaultCommandTimeout: process.env['CYPRESS_DEFAULT_COMMAND_TIMEOUT'] ? parseInt(process.env['CYPRESS_DEFAULT_COMMAND_TIMEOUT']) : undefined,
    experimentalRunAllSpecs: true,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    video: true,
    setupNodeEvents(on, config) {
      on('task', tasks);
      require('@cypress/grep/src/plugin')(config);
      return config;
    },
  },
});
