# CI/CD Pipeline Specification

## Overview

This document describes the Continuous Integration and Continuous Deployment pipeline for 10xGains. The pipeline is implemented using GitHub Actions and consists of reusable workflows for CI and CD processes.

## Required Configuration

### Environment Variables

#### Staging Environment
```yaml
# Variables (vars)
APP_WEBMANIFEST_NAME: App name shown in the web manifest
APP_WEBMANIFEST_SHORT_NAME: Short name shown on home screen
APP_URL: URL of the staging application
AZURE_RESOURCE_GROUP: Name of the Azure Resource Group
AZURE_STATIC_WEB_APP_NAME: Name of the Azure Static Web App resource
CYPRESS_DEFAULT_COMMAND_TIMEOUT: Timeout for Cypress commands (optional)
SUPABASE_URL: URL of the staging Supabase instance
SUPABASE_PROJECT_ID: Project ID of the staging Supabase instance

# Secrets
APP_CANARY_USER_EMAIL: Email of the canary user for E2E tests
APP_CANARY_USER_PASSWORD: Password of the canary user for E2E tests
AZURE_STATIC_WEB_APP_DEPLOYMENT_TOKEN: Deployment token for Azure Static Web App
SUPABASE_ACCESS_TOKEN: Access token for Supabase CLI operations
SUPABASE_DB_PASSWORD: Database password for Supabase
SUPABASE_ANON_KEY: Anonymous key for Supabase client
SUPABASE_SERVICE_ROLE_KEY: Service role key for Supabase (used in E2E tests)
```

#### Production Environment
```yaml
# Variables (vars)
APP_WEBMANIFEST_NAME: App name shown in the web manifest
APP_WEBMANIFEST_SHORT_NAME: Short name shown on home screen
APP_URL: URL of the production application
AZURE_RESOURCE_GROUP: Name of the Azure Resource Group
AZURE_STATIC_WEB_APP_NAME: Name of the Azure Static Web App resource
CYPRESS_DEFAULT_COMMAND_TIMEOUT: Timeout for Cypress commands (optional)
SUPABASE_URL: URL of the production Supabase instance
SUPABASE_PROJECT_ID: Project ID of the production Supabase instance

# Secrets
APP_CANARY_USER_EMAIL: Email of the canary user for smoke tests
APP_CANARY_USER_PASSWORD: Password of the canary user for smoke tests
AZURE_STATIC_WEB_APP_DEPLOYMENT_TOKEN: Deployment token for Azure Static Web App
SUPABASE_ACCESS_TOKEN: Access token for Supabase CLI operations
SUPABASE_DB_PASSWORD: Database password for Supabase
SUPABASE_ANON_KEY: Anonymous key for Supabase client
```

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
   - Linting using ESLint
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
2. **Database Migration** (Supabase)
3. **Backend Deployment** (Supabase Edge Functions)
4. **Frontend Deployment** (Azure Static Web App)
5. **E2E Testing**
   - Full test suite
   - Tests against live staging environment

### Production Deployment
Triggered by:
- Release creation/editing

Process:
1. **Staging Deployment** (must succeed first)
2. **Deployment Approval** (via `production-cd` environment)
3. **Database Migration** (Supabase)
4. **Backend Deployment** (Supabase Edge Functions)
5. **Frontend Deployment** (Azure Static Web App)
6. **Smoke Testing**
   - Critical path testing only
   - Uses a predefined canary user
   - Verifies core functionality

## Infrastructure

### Frontend Hosting
- Azure Static Web App
- Configuration in `src/staticwebapp.config.json`

### Backend Services
- Supabase Database
- Supabase Edge Functions
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

The pipeline uses a dedicated canary user for smoke E2E tests. This user needs to be created and configured in both staging and production environments.

### Creating the Canary User

1. **Register the User**
   - Create a new user account in the Supabase Dashboard
   - Use the email and password that will be set in GitHub secrets:
     - `APP_CANARY_USER_EMAIL`
     - `APP_CANARY_USER_PASSWORD`
   - Create an account for each exercise

2. **Initialize Test Data**
The repository includes a SQL function to scaffold test data for the canary user. Execute these steps in both staging and production databases:

```sql
-- 1. Connect to the database using psql or Supabase Dashboard's SQL Editor

-- 2. Verify the environment setting is not 'production' for the function to work
SHOW app.environment;
-- Should return 'staging' or 'development' for staging database
-- For production database, temporarily set it:
ALTER DATABASE postgres SET app.environment = 'staging';

-- 3. Execute the function as the canary user
-- Important: You must be authenticated as the canary user when running this
-- Alternatively: Execute the function's body directly in the Supabase Dashboard
select test_scaffold_user_data();

-- 4. For production database, revert the environment setting
ALTER DATABASE postgres SET app.environment = 'production';
```

The `test_scaffold_user_data()` function will create:
- A training plan with two workouts
- Exercise definitions (Squat, Bench Press, Deadlift)
- Progression rules
- 14 historical training sessions
- A pending session

### Verifying the Setup

After creating the canary user and scaffolding the data:

1. **Verify User Profile**
   ```sql
   select * from user_profiles where id = (
     select id from auth.users where email = 'your-canary-email@example.com'
   );
   ```

2. **Verify Training Data**
   ```sql
   select count(*) from training_sessions where user_id = (
     select id from auth.users where email = 'your-canary-email@example.com'
   );
   -- Should return 15 (14 historical + 1 pending)
   ```

### Security Considerations

1. Use a dedicated email domain for canary users (e.g., `canary@your-domain.com`)
2. Regularly rotate the canary user's password
3. Monitor canary user's activity for any unauthorized access
4. Consider implementing IP restrictions for canary user access
