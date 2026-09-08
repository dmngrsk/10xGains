# CI/CD Pipeline Specification

## Overview

This document describes the Continuous Integration and Continuous Deployment pipeline for 10xGains. The pipeline is implemented using GitHub Actions and consists of reusable workflows for CI and CD processes.

## Required Configuration

### Environment Variables

The values Terraform derives — the API and app URLs, the Supabase project ref and its API keys — are
not configured here; CD reads them from the `infrastructure` job's outputs at deploy time.

Both environments take the same set with their own values. "Set by" is who fills the entry in — `infra:apply` writes it, or you do.

#### Variables

| Variable | Set by | Description |
| --- | --- | --- |
| `APP_WEBMANIFEST_NAME` | **manual** | App name shown in the web manifest |
| `APP_WEBMANIFEST_SHORT_NAME` | **manual** | Short name shown on the home screen |
| `AZURE_RESOURCE_GROUP` | `infra:apply` | Name of the Azure resource group |
| `AZURE_FUNCTIONAPP_NAME` | `infra:apply` | Name of the Azure Function App resource |
| `AZURE_STATIC_WEB_APP_NAME` | `infra:apply` | Name of the Azure Static Web App resource |
| `CYPRESS_DEFAULT_COMMAND_TIMEOUT` | **manual** | Timeout for Cypress commands (optional) |
| `SUPABASE_GOOGLE_CLIENT_ID` | `infra:apply` | Google OAuth client id for Supabase sign-in (optional) |
| `SUPABASE_ORGANIZATION_ID` | `infra:apply` | Supabase organization the project belongs to |
| `TF_STATE_STORAGE_ACCOUNT` | `infra:apply` | Storage account holding this environment's Terraform state |

#### Secrets

| Secret | Set by | Description |
| --- | --- | --- |
| `APP_CANARY_USER_EMAIL` | **manual** | Email of the canary user for E2E tests |
| `APP_CANARY_USER_PASSWORD` | **manual** | Password of the canary user for E2E tests |
| `AZURE_CLIENT_ID` | `infra:apply` | Application id of this environment's CI identity (OIDC) |
| `AZURE_TENANT_ID` | **manual, preflight** | Entra tenant id |
| `AZURE_SUBSCRIPTION_ID` | **manual, preflight** | Azure subscription id |
| `SUPABASE_ACCESS_TOKEN` | **manual, preflight** | Access token for the Supabase CLI and Terraform provider |
| `SUPABASE_DB_PASSWORD` | `infra:apply` | Database password for the Terraform-managed project |
| `SUPABASE_GOOGLE_CLIENT_SECRET` | `infra:apply` | Google OAuth client secret (optional; paired with the id) |

The three marked **preflight** are the only ones anything checks for — `infra:apply` refuses to run
without them. Nothing checks the rest, so a fresh environment missing the `APP_CANARY_USER_*` pair
gets through `infrastructure` and `frontend`, then fails in `e2e`.

`SUPABASE_GOOGLE_*` is written only when both halves are present locally. Without them Terraform
leaves the Google provider unmanaged rather than half-configured, so a rebuilt project keeps
whatever it already has.

### Technical Environments

The pipeline uses two technical environments for deployment control:

1. `staging-cd`: Controls deployment to `staging` environment
2. `production-cd`: Controls deployment to `production` environment

These environments should be configured in GitHub with required reviewers to ensure proper approval flow for deployments.

## Continuous Integration (CI) Flow

### Trigger Events
- Pull requests to `main` branch
- Release creation/editing

### Process Flow
1. **Code Verification and Build**
   - Linting using ESLint and TypeScript typechecks (per-package `lint` scripts)
   - Unit testing with coverage reporting
   - Building the Angular application
   - Artifacts:
     - Test coverage reports
     - Build artifacts for deployment

### Build Information
The CI process includes build metadata in the environment configuration:
```typescript
{
  build: {
    name: string;  // PR branch name or release tag
    sha: string;   // Commit SHA
  }
}
```

### Optimization Potential
Currently, lint, test, and build steps run sequentially in separate jobs. This could be optimized in two ways:

1. **Current Approach (Separate Chained Jobs)**
   - Better isolation
   - Clear job-level status in GitHub UI
   - Trade-off: Takes more time due to environment setup before each step, long job duration on a happy path

2. **Potential Optimization (Single Job)**
   - Faster execution
   - Less GitHub Actions minutes
   - Simpler configuration
   - Trade-off: Less granular control, poor status visibility

3. **Potential Optimization (Parallel Jobs)**
   ```yaml
   jobs:
     lint:
       name: Lint code
       # ... lint job configuration ...

     test:
       name: Run unit tests
       # Remove the 'needs: [lint]' dependency
       # ... test job configuration ...

     build:
       name: Build application
       # Remove the 'needs: [lint, test]' dependency
       # ... build job configuration ...

     verify:
       name: Verify all checks
       needs: [lint, test, build]
       runs-on: ubuntu-latest
       steps:
         - run: |
             echo "All checks passed!"
   ```
   - Better resource utilization
   - Still maintains job isolation
   - Trade-off: Higher concurrent GitHub Actions minutes usage, all jobs run even if one fails

The current approach was chosen for better isolation and clearer status reporting, despite the slight time overhead.

## Continuous Deployment (CD) Flow

### Staging Deployment
Triggered by:
- Successful CI on pull requests
- Release creation

Process:
1. **Deployment Approval** (via `staging-cd` environment)
2. **Infrastructure** (Terraform, `infra/environments/<environment>/resources`)
3. **Database Migration** (Supabase)
4. **Backend Deployment** (Azure Functions)
5. **Frontend Deployment** (Azure Static Web App)
6. **E2E Testing**
   - Full test suite
   - Tests against live staging environment

### Production Deployment
Triggered by:
- Release creation/editing

Process:
1. **Staging Deployment** (must succeed first)
2. **Deployment Approval** (via `production-cd` environment)
3. **Infrastructure** (Terraform)
4. **Database Migration** (Supabase)
5. **Backend Deployment** (Azure Functions)
6. **Frontend Deployment** (Azure Static Web App)
7. **Smoke Testing**
   - Critical path testing only
   - Uses a predefined canary user
   - Verifies core functionality

The numbering is the dependency chain, not just an order: every later job needs the one before it,
and the frontend and E2E jobs additionally read the infrastructure outputs directly rather than
from repository configuration. Nothing downstream runs if Terraform fails.

## Infrastructure

### Frontend Hosting
- Azure Static Web App
- Configuration in `apps/web/src/staticwebapp.config.json`

### Backend Services
- Azure Functions (API, `apps/api`)
- Supabase Database
- Supabase Authentication

## Best Practices

1. **Environment Isolation**
   - Separate Supabase projects for staging/production
   - Separate Azure Static Web Apps for staging/production
   - Environment-specific configuration and secrets

2. **Deployment Safety**
   - Required approvals via technical environments
   - Full E2E testing on staging
   - Smoke testing on production
   - Database migrations run before application deployment

3. **Monitoring & Debugging**
  - Unit test coverage artifacts retained for 7 days
  - E2E test artifacts retained for 7 days
  - Build artifacts for staging retained for 7 days
  - Build artifacts for production retained for 30 days
  - Detailed PR comments with CI status after each run

## Canary User Setup

The pipeline uses a dedicated canary user (`APP_CANARY_USER_EMAIL` / `APP_CANARY_USER_PASSWORD`) for E2E tests. Once per run, before any spec touches it, the `users:ensureUserScaffolded` task (`cypress/support/tasks/users.ts`) signs in with the publishable key and checks its test data (`scaffoldTestUserData()` in `cypress/support/test-data/scaffold.ts`: two workouts, exercise definitions, progression rules, 14 historical sessions, a pending session).

- **Local development & staging**: fully automatic. If the account or its data is missing, the task uses the secret-key client to create the user and/or scaffold the data. Requires a real, non-placeholder `APP_CANARY_USER_PASSWORD` - it refuses to auto-create an account with an empty or default password.
- **Production**: create the account once, manually (e.g. via the Supabase Dashboard). Production only ever runs smoke tests, which intentionally never receive `SUPABASE_SECRET_KEY` (Cypress must not hold service-role access there), so it can't self-heal - the task fails with a readable error if the account or its data is missing.

### Verifying the Setup

After creating the canary user and scaffolding the data:

1. **Verify User Profile**
   ```sql
   select * from profiles where id = (
     select id from auth.users where email = 'your-canary-email@example.com'
   );
   -- active_plan_id should be set
   ```

2. **Verify Session Data**
   ```sql
   select count(*) from sessions where user_id = (
     select id from auth.users where email = 'your-canary-email@example.com'
   );
   -- Should return 15 (14 historical + 1 pending)
   ```

### Security Considerations

1. Use a dedicated email domain for canary users (e.g., `canary@your-domain.com`)
2. Regularly rotate the canary user's password
3. Monitor canary user's activity for any unauthorized access
4. Consider implementing IP restrictions for canary user access
