import { plugin as cypressGrepPlugin } from "@cypress/grep/plugin";
import { defineConfig } from "cypress";
import { config } from "dotenv";
import { tasks } from "./cypress/support/tasks";

config();

export default defineConfig({
  // Secrets stay in `env` and are read in specs via the cy.env() command;
  // Cypress.env() in the browser is deprecated, so opt out of it entirely.
  allowCypressEnv: false,
  env: {
    CANARY_USER_EMAIL: process.env['APP_CANARY_USER_EMAIL'],
    CANARY_USER_PASSWORD: process.env['APP_CANARY_USER_PASSWORD'],
  },
  // Non-secret values exposed to the browser, read via Cypress.expose().
  expose: {
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
      cypressGrepPlugin(config);
      return config;
    },
  },
});
