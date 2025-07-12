# 10xGains
<img src="src/assets/images/logo-auth.png" alt="10xGains Logotype" width="512" weight="512">

## Table of Contents
- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description
10xGains is a streamlined platform designed to lower the entry barrier for powerlifting and weightlifting. The application enables users to create, customize, and track personalized training plans with AI-driven suggestions, ensuring safe and effective workout routines. Key features include secure user registration/login, flexible training plan creation, active workout session tracking, and comprehensive workout history.

## Tech Stack
- **Frontend**: Angular 19, Angular Material Design 3, Tailwind CSS 4
- **Backend**: Supabase (for PostgreSQL, serverless API via Supabase Edge Functions and authentication)
- **AI Integration**: OpenRouter API for AI-driven training plan suggestions
- **Test Suite**: Vitest (unit), Cypress (e2e)
- **CI/CD and Hosting**: GitHub Actions, Azure Static Web Apps

## Getting Started Locally

### Prerequisites
- **Node.js**: Version specified in `.nvmrc` (e.g., `22.14.0`)
- **Yarn**: This project uses `yarn` for package management (managed via Corepack)
- **Docker**: Required to run Supabase locally
- **Supabase CLI**: Follow the [official installation guide](https://supabase.com/docs/guides/cli/getting-started)

### Installation
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/dmngrsk/10xGains.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd 10xGains
    ```
3.  **Start the local Supabase services:**

    This command uses Docker to start the local Supabase stack (database, auth, storage, etc.).
    ```bash
    npx supabase start
    ```
    Once it's running, the CLI will output your local Supabase credentials, including the **API URL** and the **anon key**. You will need these for the next step.

4.  **Configure environment variables for the Angular app:**

    The frontend needs to know how to connect to your local Supabase instance.

    Create a copy of the development environment file:
    ```bash
    cp src/environments/environment.ts src/environments/environment.development.ts
    ```
    The Angular CLI will use this file during local development.

    Open `src/environments/environment.development.ts` and replace the placeholder values with the credentials from the `supabase start` output:
    ```typescript
    export const environment = {
      production: false,
      supabase: {
        url: 'YOUR_LOCAL_SUPABASE_URL', // e.g., http://localhost:54321
        key: 'YOUR_LOCAL_SUPABASE_ANON_KEY', // The long JWT string
      }
    };
    ```
5.  **Apply database migrations and seed data:**

    This command resets your local database and applies all schema changes from the `supabase/migrations` folder.
    ```bash
    npx supabase db reset
    ```

6.  **Install frontend dependencies:**

    Now that the backend is fully configured, install the necessary npm packages.
    ```bash
    yarn install
    ```

7.  **Start the development server:**

    To run the app using your new `development` configuration, use this command:
    ```bash
    yarn start:development
    ```

8.  **Open your browser and navigate to `http://localhost:4200`**

## Available Scripts

Below are the most important scripts defined in `package.json`.

### Development Server

- `yarn start:development` - Runs the Angular application in development mode using the `development` configuration. The server is hosted at `http://localhost:4200/` and is accessible on your local network (especially to the e2e testing framework) thanks to `--host 0.0.0.0`.
- `yarn start:[staging|production]` - Runs the app locally but with the `staging` or `production` environment configurations. Useful for debugging environment-specific issues.

### Building the Application

- `yarn build` - Builds the application for production. The output is placed in the `dist/10xGains` directory.
- `yarn build:[development|staging]` - Builds the application using the `development` or `staging` configuration.

### Linting and Formatting

- `yarn lint` - Runs ESLint on the Angular frontend code (`/src`, `/cypress`). Then, runs Deno Lint on the Supabase Edge Functions code (`/supabase/functions`).
- `yarn lint:fix` - Runs the same linters but attempts to automatically fix any detected issues.
- *Note: A pre-commit hook is configured with Husky and `lint-staged` to automatically format your code before every commit.*

### Running Tests

#### Unit Tests (Vitest)

- `yarn test` - Runs the complete unit test suite once.
- `yarn test:watch` - Runs the unit tests in an interactive watch mode, automatically re-running them when you save a file. Ideal for active development.
- `yarn test:coverage` -Runs the unit tests and generates a code coverage report in the `/coverage` directory.

#### End-to-End Tests (Cypress)

- `yarn e2e` - Opens the interactive Cypress Test Runner, allowing you to watch tests run in a browser and debug them visually.
- `yarn e2e:run` - Runs the entire E2E test suite headlessly (in the terminal). This is the command used in CI/CD pipelines.
- `yarn e2e:smoke` - Runs a specific subset of E2E tests tagged as `@smoke`. Useful for quick sanity checks during development or in a CI/CD pipeline.

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
