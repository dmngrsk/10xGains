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
10xGains is a streamlined platform designed to lower the entry barrier for powerlifting and weightlifting. The application enables users to create, customize, and track personalized training plans with AI-driven suggestions, ensuring safe and effective workout routines. Key features include secure user registration/login, flexible training plan creation, active workout session tracking, and comprehensive workout history.

## Tech Stack
- **Frontend**: Angular 22, Angular Material Design 3, Tailwind CSS 4
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

### Prerequisites
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
    Once it's running, the CLI will output your local Supabase credentials, including the **API URL** and the **publishable key**. You will need these in steps 6 and 7.

5.  **Start the Azurite storage emulator:**

    The API's local Functions host needs a storage backend (`AzureWebJobsStorage`). Start it via the root `docker-compose.yml`:
    ```bash
    docker compose up -d
    ```

6.  **Configure the API:**

    The API runs on a local Azure Functions host. Create its local settings file from the provided example:
    ```bash
    cp apps/api/local.settings.json.example apps/api/local.settings.json
    ```
    Open `apps/api/local.settings.json` and fill in your local Supabase URL and publishable key from step 4. `AzureWebJobsStorage` is already set to use the Azurite container started in step 5.

7.  **Configure the Angular app:**

    The frontend needs to know how to connect to your local Supabase instance. Create a copy of the development environment file:
    ```bash
    cp apps/web/src/environments/environment.ts apps/web/src/environments/environment.development.ts
    ```
    The Angular CLI will use this file during local development. Open `apps/web/src/environments/environment.development.ts` and replace the placeholder values with the credentials from step 4:
    ```typescript
    export const environment = {
      production: false,
      api: {
        url: 'http://localhost:7071', // The local Azure Functions host
      },
      supabase: {
        url: 'http://localhost:54321', // The local Supabase project URL 
        key: 'sb_publishable_...',  // The local Supabase publishable auth key
      }
    };
    ```

8.  **Start the apps:**

    Run both the Angular dev server and the API host together with a single command:
    ```bash
    pnpm dev
    ```
    This runs the `dev` script of every workspace package in parallel (equivalent to `pnpm --filter @txg/web start:development` and `pnpm --filter @txg/api start` run side by side), prefixing each line of output with its package name. To run them separately instead (e.g. in two terminals), use those individual commands.

9.  **Open your browser and navigate to `http://localhost:4200`**

## Available Scripts

Below are the most important scripts defined in `package.json`.

### Development Server

- `pnpm dev` - Runs the Angular dev server and the API host together, in parallel, each with output prefixed by package name. This is the recommended way to start local development once [Getting Started Locally](#getting-started-locally) is complete.
- `pnpm --filter @txg/api start` - Builds the API and starts the local Azure Functions host at `http://localhost:7071/`. Requires Azurite to be running (see [Getting Started Locally](#getting-started-locally)).
- `pnpm --filter @txg/web start:development` - Runs only the Angular application in development mode using the `development` configuration. The server is hosted at `http://localhost:4200/` and is accessible on your local network (especially to the e2e testing framework) thanks to `--host 0.0.0.0`.
- `pnpm --filter @txg/web start:[staging|production]` - Runs the app locally but with the `staging` or `production` environment configurations. Useful for debugging environment-specific issues.

### Building the Web Application

- `pnpm build` - Builds the web application for production. The output is placed in the `apps/web/dist` directory.
- `pnpm build:[development|staging]` - Builds the web application using the `development` or `staging` configuration.

### Linting and Formatting

- `pnpm lint` - Runs ESLint across all workspace packages (`apps/web`, `apps/api`, `packages/shared`) and the Cypress test code.
- `pnpm lint:fix` - Runs the same linters but attempts to automatically fix any detected issues.
- *Note: A pre-commit hook is configured with Husky and `lint-staged` to automatically format your code before every commit.*

### Running Tests

#### Unit Tests (Vitest)

- `pnpm test` - Runs the complete unit test suite once.
- `pnpm test:watch` - Runs both `apps/web` and `apps/api` unit tests in interactive watch mode, automatically re-running them when you save a file. Ideal for active development.
- `pnpm --filter <@txg/web|@txg/api> test:watch` - Runs a single package's unit tests in watch mode instead of both.
- `pnpm test:coverage` -Runs the unit tests and generates a code coverage report in the `/coverage` directory.

#### End-to-End Tests (Cypress)

Before running the suite locally, copy `.env.example` to `.env` and fill in the values (your local Supabase credentials from step 4, and a canary user email/password of your choice).
```bash
cp .env.example .env
```

- `pnpm e2e` - Opens the interactive Cypress Test Runner, allowing you to watch tests run in a browser and debug them visually.
- `pnpm e2e:run` - Runs the entire E2E test suite headlessly (in the terminal). This is the command used in CI/CD pipelines.
- `pnpm e2e:smoke` - Runs a specific subset of E2E tests tagged as `@smoke`. Useful for quick sanity checks during development or in a CI/CD pipeline.

## Project Scope
The current MVP scope includes:
- **User Account System**: Secure user registration and login.
- **Training Plan Creation**: Ability to create personalized training plans with both predefined and custom exercises, incorporating manual adjustments and automated weight progression.
- **Active Workout Session Tracking**: Real-time tracking of exercises with clickable set markers and detailed editing capabilities.
- **Workout History**: Chronological record of past workout sessions.
- **AI-Driven Training Suggestions**: Integrated chat tool offering tailored training plan suggestions and educational resources.

## Project Status
The project is currently in early development. Features are actively being developed and refined.

## License
This project is licensed under the [MIT License](LICENSE.md). 
