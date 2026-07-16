# 10xGains

10xGains is a training plan and workout tracking application (see `README.md` for the product description).

## Tech Stack

- Angular 22, Angular Material Design 3, Tailwind CSS 4 (frontend)
- Hono on Azure Functions, Node.js 24 (API)
- Supabase (PostgreSQL with RLS, authentication)

## Project Structure

This is a pnpm workspace monorepo:

- `apps/web` - Angular frontend (`@txg/web`); see `apps/web/CLAUDE.md`
- `apps/api` - Hono API on Azure Functions (`@txg/api`); see `apps/api/CLAUDE.md`
- `packages/shared` - Shared code (`@txg/shared`): API DTOs, command models, and generated database types. Types only, with one exception: `src/domain.types.ts` also exports runtime lists of the value unions the database constrains columns to (statuses, deload strategies), because validators need the values and not just the type. Derive from the generated types there rather than retyping a union by hand.
- `supabase` - Database migrations and local stack configuration; see `supabase/CLAUDE.md`
- `cypress` - System-level E2E tests; see `cypress/CLAUDE.md`

Use `pnpm` (never `npm` or `yarn`) for all package-related commands. Run package-scoped scripts with `pnpm --filter <@txg/web|@txg/api> <script>`.

## Clean Code Guidelines

- Use feedback from linters to improve the code when making changes.
- Prioritize error handling and edge cases; handle them at the beginning of functions.
- Use early returns and guard clauses for error conditions to avoid deeply nested if statements; avoid unnecessary else statements (if-return pattern).
- Place the happy path last in the function for improved readability.
- Implement proper error logging and user-friendly error messages.
- Consider using custom error types or error factories for consistent error handling.

## Unit Testing (Vitest)

- Leverage the `vi` object for test doubles - `vi.fn()` for function mocks, `vi.spyOn()` to monitor existing functions, and `vi.stubGlobal()` for global mocks. Prefer spies over mocks when you only need to verify interactions without changing behavior.
- Master `vi.mock()` factory patterns - place mock factory functions at the top level of your test file, return typed mock implementations, and use `mockImplementation()` or `mockReturnValue()` for dynamic control during tests. Remember the factory runs before imports are processed.
- Use inline snapshots (`toMatchInlineSnapshot()`) for readable assertions of complex values.
- Run `vitest --watch` during development, filtering tests with `-t` to focus on specific areas.
- Structure tests for maintainability - group related tests with descriptive `describe` blocks, use explicit assertion messages, and follow the Arrange-Act-Assert pattern.
- Leverage TypeScript type checking in tests - use `expectTypeOf()` for type-level assertions, and ensure mocks preserve the original type signatures.

## Commit Messages

Use the Conventional Commits format: `<type>(<optional scope>): <Description>`

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- The type and scope MUST be lowercase; the first letter after the colon MUST be capitalized.
- Use imperative mood ("Add feature", not "Added feature"); no period at the end; keep the description under 72 characters.
- Scope by project area, e.g. `web`, `api`, `shared`, `db`, `auth`, `cd`, `config`.
- One logical change per commit. For breaking changes, add `!` after the type/scope and a `BREAKING CHANGE:` body explaining the impact.

Examples: `feat(web): Add profile image upload feature`, `fix(auth): Resolve token validation issue`.

## Additional Notes

- When not sure about a solution to a problem, ask for feedback — do not make anything up.
