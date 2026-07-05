# API (@txg/api)

The backend API: a Hono application hosted on Azure Functions (Node.js 24). Azure Functions is only the transport layer — all routing, middleware, and business logic live in the Hono app. Supabase provides PostgreSQL (with RLS) and authentication; the API uses only the publishable key + the user's JWT, never the secret key.

See `README.md` in this directory for the full architecture and endpoint documentation. Maintain that endpoint documentation after implementing new endpoints.

## Architecture

- `src/main.ts` - Azure Functions entry point: a single catch-all HTTP function (`route: '{*path}'`, all methods, anonymous auth level) bridged to the Hono app via `@marplex/hono-azurefunc-adapter`.
- `src/app.ts` - Initializes the Hono app, applies root-level middleware (CORS, Supabase client, telemetry), and mounts the main router at `/api`.
- `src/context.ts` - TypeScript types for the Hono application context (Supabase client, authenticated user, telemetry data).
- `src/middleware/routes.ts` - The heart of the routing: defines all API endpoints and maps them to handlers. Follow the established modular routing patterns (`/api/profiles`, `/api/exercises`, `/api/plans`, `/api/sessions`, `/api/health`).
- `src/middleware/` - `auth.ts` (`requiredAuthMiddleware`, `optionalAuthMiddleware`), `supabase.ts`, `telemetry.ts`.
- `src/handlers/` - Business logic per endpoint, named `{resource}/{method}-{modifier}.ts` (e.g. `exercises/get.ts`, `plans/get-id.ts`).
- `src/repositories/` - Data access logic abstracted from handlers (e.g. `plan.repository.ts`).
- `src/services/` - Reusable business logic shared across handlers (e.g. weight progression calculations).
- `src/utils/` - `api-helpers.ts` (error handling and response formatting), `supabase.ts`, collections helpers.

## Implementation Guidelines

- Use Zod schemas to validate request data.
- Use entities from the `@txg/shared` workspace package as baseline REST API models; they are shared with the Angular frontend.
- Use consistent error response formatting from `utils/api-helpers.ts` with appropriate HTTP status codes (400, 401, 403, 404, 500).
- Use `requiredAuthMiddleware` for protected endpoints.
- Always include user ownership validation in database queries: use the `.eq('user_id', getUserId())` pattern in repository methods.
- Return 404 for resources that don't exist or don't belong to the user.
- Unit tests use vitest; each test file lives next to the tested file as `{tested-file}.spec.ts`.

## Build and Local Development

- `pnpm --filter @txg/api start` - Builds (esbuild single-file bundle) and starts the local Functions host on port 7071. Requires `local.settings.json` (see `local.settings.json.example`), a running local Supabase stack, and the Azurite Docker container (see root `README.md`) for `AzureWebJobsStorage`.
- `pnpm --filter @txg/api build:deploy` - Assembles the deployment package in `deploy/` (used by CD).
- `@azure/functions` must stay external in the esbuild bundle — it has to resolve to the worker's shared instance.
