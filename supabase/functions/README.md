# Supabase Edge Functions

This directory contains the Supabase Edge Functions for the 10xGains application. These functions are deployed to the Supabase platform and serve as the API backend for the application.

## Architecture

The Edge Functions are organized into the following structure:

- `profiles/` - Contains the user profile function
  - `index.ts` - Endpoint for user profile operations (GET, PUT)
  - `deno.json` - Function-specific Deno configuration and dependencies
- `_shared/` - Contains shared utilities
  - `database-types.ts` - Database type definitions (auto-generated)
  - `api-types.ts` - Shared API type definitions (auto-generated)
  - `api-helpers.ts` - Helper types, CORS headers, and utility functions for API responses

## Type Synchronization

To maintain a single source of truth for types, we automatically copy types from the Angular frontend to the Supabase Edge Functions before deployment:

1. The sources of truth are:
   - `src/app/shared/api/api.types.ts` - API DTOs and command models
   - `src/app/shared/db/database.types.ts` - Database schema definitions
2. The `copy-api-types.js` script copies these to:
   - `supabase/functions/_shared/api-types.ts`
   - `supabase/functions/_shared/database-types.ts`

Never edit the Edge Function types directly. Always modify the source files in the Angular project.

## Development Notes

### Dependency Management

Each function has its own `deno.json` file that manages dependencies and Deno-specific configurations. This follows the recommended Supabase practice to isolate dependencies per function:

```json
{
  "imports": {
    "std/": "https://deno.land/std@0.168.0/",
    "shared/": "../_shared/",
    "supabase": "https://esm.sh/@supabase/supabase-js@2",
    "zod": "https://deno.land/x/zod@v3.22.4/mod.ts"
  }
}
```

### TypeScript Support

These functions use Deno as the runtime environment, which is different from Node.js. This means that:

1. Import paths are managed through the `imports` section in `deno.json`
2. Dependencies are imported via URLs (e.g., `https://deno.land/...`) or npm packages with the new `npm:` prefix
3. The Deno global is available for environment variables and other runtime features

The IDE may show TypeScript errors for Deno-specific features because the regular TypeScript compiler doesn't recognize them. These errors can be ignored as they don't affect the function's execution in the Supabase environment.

### Handling Linting Errors in VS Code

If you're seeing linting errors in VS Code for Deno imports or types, you can:

1. **Use Deno for VS Code Extension**: Install the official Deno extension and enable it for this workspace
2. **Configure TypeScript Plugin**: Add a `.vscode/settings.json` file with:
   ```json
   {
     "deno.enable": true,
     "deno.lint": true,
     "deno.unstable": false
   }
   ```
3. **Disable TypeScript Validation**: If you prefer to disable TypeScript validation for these files:
   ```json
   {
     "typescript.validate.enable": false
   }
   ```

### Local Development

To develop and test Edge Functions locally:

1. Install the Supabase CLI
2. Copy the latest API types with `yarn copy-api-types`
3. Run `supabase functions serve` to start the local development server
4. Use tools like Postman or curl to test the API endpoints

### Deployment

To deploy Edge Functions:

```bash
# Deploy all functions
supabase functions deploy

# Deploy a specific function
supabase functions deploy profiles
```

## API Documentation

### User Profiles API

#### GET /profiles/{id}

Retrieves a user profile by ID.

- Authorization: Bearer token required
- URL Parameters: `id` - The user ID (must match the authenticated user)
- Response: `UserProfileDto` - The user profile data

#### PUT /profiles/{id}

Creates or updates a user profile.

- Authorization: Bearer token required
- URL Parameters: `id` - The user ID (must match the authenticated user)
- Request Body: `UpdateUserProfileCommand` - The fields to update
  - `first_name` (optional) - The user's first name
  - `active_training_plan_id` (optional) - The ID of the active training plan
- Response:
  - Status 200: `UserProfileDto` - If profile was updated
  - Status 201: `UserProfileDto` - If profile was created
- Success message indicates whether the profile was created or updated
