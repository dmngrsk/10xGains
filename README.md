# 10xGains
<img src="apps/web/src/assets/images/logo-auth.png" alt="10xGains Logotype" width="512" height="512">

## Table of Contents
- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description
10xGains is a streamlined platform designed to lower the entry barrier for powerlifting and weightlifting. The application enables users to create, customize, and track personalized training plans with AI-driven suggestions, ensuring safe and effective workout routines. Key features include secure user registration/login, flexible training plan creation, active workout session tracking, comprehensive workout history, and exercise progress charts.

## Tech Stack
- **Frontend**: Angular 22, Angular Material Design 3, Tailwind CSS 4, Chart.js 4 (via ng2-charts)
- **Backend**: Hono on Azure Functions (Node.js 24) for the API; Supabase for PostgreSQL and authentication
- **AI Integration**: OpenRouter API for AI-driven training plan suggestions
- **Test Suite**: Vitest (unit), Cypress (e2e)
- **CI/CD and Hosting**: GitHub Actions, Azure Static Web Apps (frontend), Azure Functions (API)

## Project Structure

This is a pnpm workspace monorepo:

- `apps/web` - The Angular frontend application (`@txg/web`).
- `apps/api` - The backend API: a Hono app hosted on Azure Functions (`@txg/api`). See [apps/api/README.md](apps/api/README.md) for architecture and endpoint documentation.
- `packages/shared` - Shared TypeScript types (`@txg/shared`): API DTOs, command models, and generated database types consumed by both apps.
- `supabase` - Database migrations, tests, and local stack configuration.
- `cypress` - System-level end-to-end tests run against a deployed (or locally running) application.

## Getting Started Locally

There are two ways to get a working environment. The [dev container](#dev-container-recommended) builds the whole stack — Node, the Supabase services, Azurite, and Claude Code — inside one container, and is the recommended path: it is the same environment for everyone, and an agent running in it cannot reach your machine. The [host setup](#host-setup) installs the same toolchain directly on your machine.

### Dev Container (recommended)

#### Prerequisites
- **A Docker engine.** On Windows it must be reachable from WSL2: Docker Desktop with WSL integration (what the steps below assume and what this is tested against) or a Docker Engine installed directly in the WSL2 distro, which skips the integration step. On macOS/Linux, Docker Desktop or the native engine.
- **[VS Code](https://code.visualstudio.com/)** with the **Dev Containers** and **WSL** extensions. Both are in this repo's recommended extensions, so VS Code offers to install them when you open the folder. (You can drive the container with the [Dev Containers CLI](https://github.com/devcontainers/cli) instead, but VS Code is the least-effort path.)

On **Windows** there are two extra steps, because the working copy must live on the Linux (ext4) filesystem — never under `C:\`. A clone under `C:\` (or `/mnt/c`) reaches the container through a slow translation layer that the container's nested Docker daemon cannot create directories on, so Supabase Studio fails to start. Keep the clone in your WSL2 home instead:

1. **A WSL2 distro.** If you don't have one, run `wsl --install -d Ubuntu` in an elevated PowerShell and set a username when it first launches. (Docker Desktop's own `docker-desktop` distro does not count.)
2. **Docker reachable from the distro.** With Docker Desktop, enable its WSL integration (Settings → Resources → WSL Integration → enable your distro → Apply & Restart) and verify it — a disabled integration is the most common blocker, and its symptom is opaque (`dial unix /var/run/docker.sock: no such file`). A Docker Engine installed inside the distro is already reachable and needs nothing here.

The [`windows-dev-container` skill](.claude/skills/windows-dev-container/SKILL.md) documents this setup and its failure modes in full.

#### Set up the project
1. **Clone into the WSL2 filesystem** (Windows) or anywhere (macOS/Linux). From a WSL/Ubuntu terminal:
   ```bash
   git clone https://github.com/dmngrsk/10xGains.git ~/10xGains
   ```
2. **Open it in VS Code:**
   ```bash
   code ~/10xGains
   ```
3. **Reopen in Container** when prompted (or Command Palette → *Dev Containers: Reopen in Container*). The first build is slow — it installs dependencies and pulls the Supabase images — then starts Supabase and Azurite on the container's own Docker daemon and generates the local config files (see [Local configuration](#local-configuration)). Later starts reuse the stack and are fast.
4. **Run the app** with `pnpm dev` and open `http://localhost:4200`. Sign in with the seeded dev account — `dev@10xgains.com` / `10xGains!` — which comes preloaded with sample training data (see [`pnpm seed`](#development-server)).

If you use Claude Code, sign in once with `claude` in the container terminal. Because the container is the blast radius, Claude Code can be run inside it without permission prompts:

```bash
claude --dangerously-skip-permissions
```

This is safe for the *host* — the agent has no route to your machine's files or Docker daemon — but it is not a license to run untrusted code: anything reachable from inside the container, including the working copy and the credentials in `~/.claude`, is still fair game. See [Anthropic's dev container guidance](https://code.claude.com/docs/en/devcontainer).

#### Running several containers at once

Each container runs a full Supabase stack, so two containers cannot both publish the default ports. To run a second worktree in parallel, set the `TXG_*` host ports before opening it — the container picks them up, and the generated config points at them:

| Variable            | Default | Worktree #2 | Service               |
|---------------------|---------|-------------|-----------------------|
| `TXG_WEB_PORT`      | `4200`  | `4300`      | Angular dev server    |
| `TXG_API_PORT`      | `7071`  | `7171`      | Azure Functions host  |
| `TXG_SUPABASE_PORT` | `54321` | `54421`     | Supabase API          |
| `TXG_STUDIO_PORT`   | `54323` | `54423`     | Supabase Studio       |
| `TXG_MAIL_PORT`     | `54324` | `54424`     | Mailpit               |

### Host Setup

#### Prerequisites
- **Node.js**: Version specified in `.nvmrc` (e.g., `24.18.0`)
- **pnpm**: This project uses `pnpm` for package management (managed via Corepack)
- **Docker**: Required to run Supabase and Azurite locally
- **Supabase CLI**: Follow the [official installation guide](https://supabase.com/docs/guides/cli/getting-started)
- **Azurite**: Local Azure Storage emulator required by the API's Functions host

### Installation
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/dmngrsk/10xGains.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd 10xGains
    ```

3.  **Install dependencies:**

    Install the necessary npm packages for all workspace packages.
    ```bash
    pnpm install
    ```

4.  **Start the local Supabase services:**

    This command uses Docker to start the local Supabase stack (database, auth, storage, etc.). On first run, it also creates the database and applies all schema changes from the `supabase/migrations` folder.
    ```bash
    npx supabase start
    ```
    Once it's running, the CLI will output your local Supabase credentials, including the **API URL** and the **publishable key**. Step 6 reads these for you.

5.  **Start the Azurite storage emulator:**

    The API's local Functions host needs a storage backend (`AzureWebJobsStorage`). Start it via the root `docker-compose.yml`:
    ```bash
    docker compose up -d
    ```

6.  **Write the local configuration:**

    Create the three files listed under [Local configuration](#local-configuration) from their committed templates, filling in the API URL, publishable key and secret key that step 4 printed:
    ```bash
    cp .env.example .env
    cp apps/api/local.settings.json.example apps/api/local.settings.json
    cp apps/web/src/environments/environment.ts apps/web/src/environments/environment.development.ts
    ```

7.  **Seed a local dev account (optional):**

    Create `dev@10xgains.com` / `10xGains!` with sample training data, so the app has a realistic history to explore:
    ```bash
    pnpm seed
    ```
    This reads `SUPABASE_SECRET_KEY` from `.env` (printed by `supabase start`), and is idempotent — safe to re-run, e.g. after `supabase db reset`.

8.  **Start the apps:**

    Run both the Angular dev server and the API host together with a single command:
    ```bash
    pnpm dev
    ```
    This runs the `dev` script of every workspace package in parallel (equivalent to `pnpm --filter @txg/web start:development` and `pnpm --filter @txg/api start` run side by side), prefixing each line of output with its package name. To run them separately instead (e.g. in two terminals), use those individual commands.

9.  **Navigate to the web app:**

    Open your browser, navigate to `http://localhost:4200`, and sign in with `dev@10xgains.com` / `10xGains!` (if you ran the seed step).

### Local Configuration

Three files hold local settings, and all three are gitignored:

- `.env` — Supabase keys and the canary user credentials, read by Cypress.
- `apps/api/local.settings.json` — settings for the local Azure Functions host.
- `apps/web/src/environments/environment.development.ts` — the API and Supabase URLs the Angular dev build is compiled against.

In the dev container, `.devcontainer/post-start.sh` regenerates all three on every start from the keys the running Supabase stack reports, so they never drift. On a host setup you maintain them by hand, and must refresh the keys yourself after recreating the stack (`supabase stop --no-backup` followed by `supabase start`), because a fresh stack mints fresh ones.

## Available Scripts

Below are the most important scripts defined in `package.json`.

### Development Server

- `pnpm dev` - Runs the Angular dev server and the API host together, in parallel, each with output prefixed by package name. This is the recommended way to start local development once [Getting Started Locally](#getting-started-locally) is complete.
- `pnpm seed` - Seeds a local dev account (`dev@10xgains.com` / `10xGains!`) with sample training data, so the app has a realistic history to explore. Idempotent and local-only (it uses the local service-role key). The dev container runs it automatically on start; run it by hand after resetting the database (e.g. `supabase db reset`).
- `pnpm --filter @txg/api start` - Builds the API and starts the local Azure Functions host at `http://localhost:7071/`. Requires Azurite to be running (see [Getting Started Locally](#getting-started-locally)).
- `pnpm --filter @txg/web start:development` - Runs only the Angular application in development mode using the `development` configuration. The server is hosted at `http://localhost:4200/` and is accessible on your local network (especially to the e2e testing framework) thanks to `--host 0.0.0.0`.
- `pnpm --filter @txg/web start:[staging|production]` - Runs the app locally but with the `staging` or `production` environment configurations. Useful for debugging environment-specific issues.

### Building the Web Application

- `pnpm build` - Builds the web application for production. The output is placed in the `apps/web/dist` directory.
- `pnpm build:[development|staging]` - Builds the web application using the `development` or `staging` configuration.

### Linting and Formatting

- `pnpm lint` - Runs each package's lint script: ESLint across `apps/web`, `apps/api`, and the Cypress test code, plus a TypeScript typecheck (spec files included) for `apps/web`, `apps/api`, and `packages/shared`.
- `pnpm lint:fix` - Runs the same linters but attempts to automatically fix any detected issues.
- *Note: A pre-commit hook is configured with Husky and `lint-staged` to automatically format your code before every commit.*

### Running Tests

#### Unit Tests (Vitest)

- `pnpm test` - Runs the complete unit test suite once.
- `pnpm test:watch` - Runs both `apps/web` and `apps/api` unit tests in interactive watch mode, automatically re-running them when you save a file. Ideal for active development.
- `pnpm --filter <@txg/web|@txg/api> test:watch` - Runs a single package's unit tests in watch mode instead of both.
- `pnpm test:coverage` -Runs the unit tests and generates a code coverage report in the `/coverage` directory.

#### End-to-End Tests (Cypress)

- `pnpm e2e` - Opens the interactive Cypress Test Runner, allowing you to watch tests run in a browser and debug them visually.
- `pnpm e2e:run` - Runs the entire E2E test suite headlessly (in the terminal). This is the command used in CI/CD pipelines.
- `pnpm e2e:smoke` - Runs a specific subset of E2E tests tagged as `@smoke`. Useful for quick sanity checks during development or in a CI/CD pipeline.

## Project Scope
The current MVP scope includes:
- **User Account System**: Secure user registration and login.
- **Training Plan Creation**: Ability to create personalized training plans with both predefined and custom exercises, incorporating manual adjustments and automated weight progression.
- **Active Workout Session Tracking**: Real-time tracking of exercises with clickable set markers, detailed editing capabilities, and free-form session and plan notes.
- **Workout History**: Chronological record of past workout sessions, including access to per-session notes.
- **Exercise Progress**: Weight-over-time line chart with one line per exercise, defaulting to the active plan and the last 3 months, filterable by training plan (or across all of them) and date range.
- **AI-Driven Training Suggestions**: Integrated chat tool offering tailored training plan suggestions and educational resources.

## Project Status
The project is currently in early development. Features are actively being developed and refined.

## License
This project is licensed under the [MIT License](LICENSE.md). 
