# 10xGains

10xGains is a training plan and workout tracking application (see `README.md` for the product description).

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

## Commit Messages

Use the Conventional Commits format: `<type>(<optional scope>): <Description>`

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- The type and scope MUST be lowercase; the first letter after the colon MUST be capitalized.
- Use imperative mood ("Add feature", not "Added feature"); no period at the end; keep the description under 72 characters.
- Prefer the feature scope when a change is confined to one product feature, e.g. `sessions`, `plans`, `progress`, `home`, `auth` — regardless of which packages it touches.
- Scope by project area for cross-feature or infrastructure changes, e.g. `web`, `api`, `shared`, `db`, `cd`, `config`.
- One logical change per commit. For breaking changes, add `!` after the type/scope and a `BREAKING CHANGE:` body explaining the impact.

Examples: `feat(settings): Add profile image upload feature`, `fix(auth): Resolve token validation issue`, `chore(config): Bump the pnpm version`.

## Additional Notes

- When not sure about a solution to a problem, ask for feedback — do not make anything up.
- Keep documentation and comments minimal: section headings and the non-obvious, not prose. If the name, value, or surrounding code already says it, leave it out.
- Place draft documents (work-in-progress specs, design notes) in `docs/specs/`, which is git-ignored; only finished documentation belongs directly in `docs/`.
