# E2E Tests (Cypress)

System-level end-to-end tests, run against a deployed environment (or the full local stack: Supabase + API host on :7071 + `ng serve` on :4200).

- `pnpm e2e:run` runs the suite headlessly (this is what CI/CD uses); `pnpm e2e` opens the interactive runner; `pnpm e2e:smoke` runs only tests tagged `@smoke`.
- Use `data-cy` attributes for test selectors instead of CSS classes or IDs (see `cypress/support/selectors/`).
- Leverage custom commands for reusable test steps (see `cypress/support/commands.ts`, e.g. `cy.login()`, `cy.getBySel()`).
- Share multi-step UI flows between specs via helper modules in `cypress/support/helpers/` (e.g. the plan-building steps in `plans.helpers.ts`) — never import one spec file from another, as that registers its test suite.
- Implement E2E testing for critical user flows; tag critical-path tests with `@smoke`.
- Use `cy.intercept()` for network request mocking, stubbing, and awaiting requests.
- Use fixtures and the scaffolding tasks (`cypress/support/tasks.ts`, `cypress/support/test-data/`) for test data.
- Implement retry-ability for flaky tests.
