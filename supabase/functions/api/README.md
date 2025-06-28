# Supabase API Edge Function

This directory contains a unified Supabase Edge Function that serves as the main API for the 10xGains application. It is built using Deno, with routing handled by the Hono web framework.

## Table of Contents

- [Architecture](#architecture)
- [Type Synchronization](#type-synchronization)
- [Development Notes](#development-notes)
  - [Dependency Management](#dependency-management)
  - [TypeScript Support](#typescript-support)
  - [Handling Linting Errors in VS Code](#handling-linting-errors-in-vs-code)
  - [Local Development](#local-development)
  - [Deployment](#deployment)
- [API Documentation](#api-documentation)
  - [User Profiles API](#user-profiles-api)
  - [Exercises API](#exercises-api)
  - [Training Plans API](#training-plans-api)
  - [Training Plan Days API](#training-plan-days-api)
  - [Training Plan Exercises API](#training-plan-exercises-api)
  - [Training Plan Exercise Sets API](#training-plan-exercise-sets-api)
  - [Training Plan Exercise Progression API](#training-plan-exercise-progression-api)
  - [Training Sessions API](#training-sessions-api)
  - [Session Sets API](#session-sets-api)
  - [Health Check API](#health-check-api)

## Architecture

The API Edge Function is organized into the following structure, using Hono for routing:

- `supabase/functions/api/` - The root directory for the unified API Edge Function.
  - `index.ts` - The main entry point for the function. It initializes the Hono app and applies root-level middleware (CORS, Supabase client).
  - `context.ts` - Defines the TypeScript types for the application context used by Hono. This context holds variables that are passed through the middleware and to the handlers, such as the Supabase client, the authenticated user, and telemetry data.
  - `deno.json` - Deno configuration, including import maps for dependency management.
  - `middleware/` - Contains Hono middleware.
    - `routes.ts` - This is the heart of the routing. It defines all API endpoints (e.g., `/api/exercises`, `/api/training-plans`) and maps them to their respective handler functions. It uses Hono's `route` method to create a modular routing structure.
    - `auth.ts`, `supabase.ts`, `telemetry.ts` - Middleware for handling authentication, initializing the Supabase client, and telemetry.
  - `handlers/` - Contains the business logic for each API endpoint.
    - `[resource]/[method]-[modifier].ts` - Each file implements the logic for a specific action on a resource (e.g., `exercises/get.ts`, `training-plans/get-id.ts`). These handlers receive a context object with the request, response, and middleware data.
  - `repositories/` - Contains data access logic. Each file abstracts the database interactions for a specific resource (e.g., `plan.repository.ts`, `session.repository.ts`).
  - `services/` - Contains business logic that can be shared across different handlers.
  - `models/` - Contains type definitions for the API and database.
  - `utils/` - Shared utility functions.

The request lifecycle is as follows:
1. A request hits the `Deno.serve` entrypoint in `index.ts`.
2. Root-level middleware for CORS, Supabase, and telemetry are applied.
3. The request is passed to the main router defined in `middleware/routes.ts`.
4. Hono matches the request path (e.g., `GET /api/exercises/:exerciseId`) to a registered route.
5. Authentication middleware (`requiredAuthMiddleware` or `optionalAuthMiddleware`) is executed.
6. The corresponding handler function from the `handlers/` directory is executed.
7. The handler may call a function from the `services/` directory to perform complex business logic.
8. The handler calls one or more functions from a repository in the `repositories/` directory to fetch or persist data.
9. The handler formats the final response and responds to the initial request.

## Type Synchronization

To maintain a single source of truth for types, we automatically copy types from the Supabase Edge Function to the Angular frontend before deployment:

1.  The sources of truth are:
    *   `supabase/functions/api/models/api-types.ts` - API DTOs and command models
    *   `supabase/functions/api/models/database-types.ts` - Database schema definitions
2.  The `copy-api-types.js` script copies these to:
    *   `src/app/shared/api/api.types.ts`
    *   `src/app/shared/db/database.types.ts`

Never edit the Edge Function types directly. Always modify the source files in the Angular project.

## Development Notes

### Dependency Management

The API function has a `deno.json` file that manages dependencies and Deno-specific configurations. This follows the recommended Supabase practice to isolate dependencies per function:

```json
{
  "imports": {
    "hono": "https://deno.land/x/hono@v4.2.7/mod.ts",
    "hono/middleware": "https://deno.land/x/hono@v4.2.7/middleware.ts",
    "hono/utils/http-status": "https://deno.land/x/hono@v4.2.7/utils/http-status.ts",
    "supabase": "https://esm.sh/@supabase/supabase-js@2",
    "zod": "https://deno.land/x/zod@v3.22.4/mod.ts"
  }
}
```

### TypeScript Support

This function uses Deno as the runtime environment, which is different from Node.js. This means that:

1.  Import paths are managed through the `imports` section in `deno.json`
2.  Dependencies are imported via URLs (e.g., `https://deno.land/...`) or npm packages with the new `npm:` prefix
3.  The Deno global is available for environment variables and other runtime features

The IDE may show TypeScript errors for Deno-specific features because the regular TypeScript compiler doesn't recognize them. These errors can be ignored as they don't affect the function's execution in the Supabase environment.

### Handling Linting Errors in VS Code

If you're seeing linting errors in VS Code for Deno imports or types, you can:

1.  **Use Deno for VS Code Extension**: Install the official Deno extension and enable it for this workspace
2.  **Configure TypeScript Plugin**: Add a `.vscode/settings.json` file with:
    ```json
    {
      "deno.enable": true,
      "deno.lint": true,
      "deno.unstable": false
    }
    ```
3.  **Disable TypeScript Validation**: If you prefer to disable TypeScript validation for these files:
    ```json
    {
      "typescript.validate.enable": false
    }
    ```

### Local Development

To develop and test the API function locally:

1.  Install the Supabase CLI
2.  Copy the latest API types with `yarn copy-api-types`
3.  Run `supabase functions serve api` to start the local development server for the API function.
4.  Use tools like Postman or curl to test the API endpoints.

### Deployment

To deploy the API Edge Function:

```bash
# Deploy the 'api' function
supabase functions deploy api
```

## API Documentation

### User Profiles API

Allows authenticated users to manage their own profile information.

#### GET /api/user-profiles/{userId}

Retrieves the profile information for the authenticated user.

-   **Authorization**: Bearer token required. The `{userId}` in the path MUST match the authenticated user's ID.
-   **URL Path Parameter**:
    -   `userId` (UUID): The ID of the user profile to retrieve.
-   **Response (200 OK)**: The `UserProfileDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "first_name": "John",
        "active_training_plan_id": "uuid | null",
        "ai_suggestions_remaining": 0,
        "created_at": "timestamp",
        "updated_at": "timestamp"
      }
    }
    ```
-   **Responses (Error)**:
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `403 Forbidden`: If the requested `{userId}` does not match the authenticated user's ID.
    -   `404 Not Found`: If the user's profile is not found.

#### PUT /api/user-profiles/{userId}

Creates or updates the profile information for the authenticated user (upsert behavior).

-   **Authorization**: Bearer token required. The `{userId}` in the path MUST match the authenticated user's ID.
-   **URL Path Parameter**:
    -   `userId` (UUID): The ID of the user profile to update or create.
-   **Request Body**: `UpsertUserProfileCommand` (at least one of `first_name` or `active_training_plan_id` must be provided)
    ```json
    {
      "first_name": "string (optional)",
      "active_training_plan_id": "uuid | null (optional)"
    }
    ```
-   **Response (200 OK/201 Created)**: The created or updated `UserProfileDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "first_name": "John",
        "active_training_plan_id": "uuid | null",
        "ai_suggestions_remaining": 0,
        "created_at": "timestamp",
        "updated_at": "timestamp" // updated
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If the request body is invalid (e.g., missing both fields, invalid UUID format).
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `403 Forbidden`: If the requested `{userId}` does not match the authenticated user's ID.
    -   `500 Internal Server Error`: For other server-side issues during the upsert operation.

### Exercises API

Allows management of the global list of available exercises in the system.

#### GET /api/exercises

Lists all available exercises. Supports pagination and sorting.

-   **Authorization**: Optional Bearer token. Publicly accessible.
-   **URL Query Parameters**:
    -   `limit` (optional, integer, default: 20, max: 100): Number of exercises to return.
    -   `offset` (optional, integer, default: 0): Offset for pagination.
    -   `sort` (optional, string, default: `name.asc`): Sort criteria (e.g., `id.asc`).
-   **Response (200 OK)**: An array of `ExerciseDto` objects.
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "name": "Squat",
          "description": "A lower-body exercise."
        }
        // ... other exercises
      ]
    }
    ```
-   **Response (400 Bad Request)**: If pagination or sort parameters are invalid.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### POST /api/exercises

Creates a new exercise. Requires administrator privileges.

-   **Authorization**: Bearer token required (user must be an admin).
-   **Request Body**: `CreateExerciseCommand`
    ```json
    {
      "name": "string (required, min 1 char)",
      "description": "string (nullable, optional)"
    }
    ```
-   **Response (201 Created)**: The newly created `ExerciseDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "name": "New Exercise",
        "description": "Details about the new exercise."
      }
    }
    ```
-   **Response (400 Bad Request)**: If the request body is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (403 Forbidden)**: If the authenticated user is not an administrator.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### GET /api/exercises/{exerciseId}

Retrieves a specific exercise by its ID.

-   **Authorization**: Optional Bearer token. Publicly accessible.
-   **URL Path Parameter**: `exerciseId` (UUID, required) - The ID of the exercise to retrieve.
-   **Response (200 OK)**: The `ExerciseDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "name": "Squat",
        "description": "A lower-body exercise."
      }
    }
    ```
-   **Response (400 Bad Request)**: If `exerciseId` format is invalid (not a UUID).
-   **Response (404 Not Found)**: If the exercise is not found.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### PUT /api/exercises/{exerciseId}

Updates an existing exercise by its ID. Requires administrator privileges.

-   **Authorization**: Bearer token required (user must be an admin).
-   **URL Path Parameter**: `exerciseId` (UUID, required) - The ID of the exercise to update.
-   **Request Body**: `UpdateExerciseCommand` (at least one field must be present)
    ```json
    {
      "name": "string (optional, min 1 char if provided)",
      "description": "string (nullable, optional)"
    }
    ```
-   **Response (200 OK)**: The updated `ExerciseDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "name": "Updated Exercise Name",
        "description": "Updated details about the exercise."
      }
    }
    ```
-   **Response (400 Bad Request)**: If `exerciseId` format is invalid or the request body is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (403 Forbidden)**: If the authenticated user is not an administrator.
-   **Response (404 Not Found)**: If the exercise is not found for an update.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### DELETE /api/exercises/{exerciseId}

Deletes a specific exercise by its ID. Requires administrator privileges.

-   **Authorization**: Bearer token required (user must be an admin).
-   **URL Path Parameter**: `exerciseId` (UUID, required) - The ID of the exercise to delete.
-   **Response (204 No Content)**: Indicates successful deletion with no response body.
-   **Response (400 Bad Request)**: If `exerciseId` format is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (403 Forbidden)**: If the authenticated user is not an administrator.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs during the delete operation (e.g., database error, not for a non-existent record which still returns 204).

### Training Plans API

Manages training plans within the scope of an authenticated user.

#### GET /api/training-plans

Lists all training plans for the authenticated user. Supports pagination and sorting.

-   **Authorization**: Bearer token required.
-   **URL Query Parameters**:
    -   `limit` (optional, integer, default: 20, max: 100): Number of plans to return.
    -   `offset` (optional, integer, default: 0): Offset for pagination.
    -   `sort` (optional, string, default: `created_at.desc`): Sort criteria (e.g., `name.asc`, `created_at.desc`).
-   **Response (200 OK)**: An array of `TrainingPlanDto` objects.
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "name": "My Awesome Plan",
          "description": "A great plan for gains.",
          "user_id": "uuid",
          "created_at": "timestamp",
          "days": [
            {
              "id": "uuid",
              "name": "Day 1: Push",
              /* ... other day fields ... */
              "exercises": [
                {
                  "id": "uuid",
                  /* ... other exercise fields ... */
                  "sets": [
                    {
                      "id": "uuid",
                      /* ... other set fields ... */
                    }
                  ]
                }
              ]
            }
          ],
          "progressions": [
            {
              "id": "uuid",
              "exercise_id": "uuid",
              /* ... other exercise progression fields ... */
            }
          ]
        }
      ],
      "totalCount": 7 // Total row count, used in pagination scenarios
    }
    ```

#### POST /api/training-plans

Creates a new training plan for the authenticated user.

-   **Authorization**: Bearer token required.
-   **Request Body**: `CreateTrainingPlanCommand`
    ```json
    {
      "name": "string (required, max 255)",
      "description": "string (optional)"
    }
    ```
-   **Response (201 Created)**: The newly created `TrainingPlanDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "name": "New Plan",
        "description": "Details about the new plan.",
        "user_id": "uuid",
        "created_at": "timestamp"
      }
    }
    ```

#### GET /api/training-plans/{planId}

Retrieves a specific training plan by its ID, if it belongs to the authenticated user. Includes associated training days exercise progressions.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**: `planId` (UUID) - The ID of the training plan to retrieve.
-   **Response (200 OK)**: The `TrainingPlanDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "name": "Specific Plan",
        "description": "Description of this plan.",
        "user_id": "uuid",
        "created_at": "timestamp",
        "days": [
          {
            "id": "uuid",
            "name": "Day 1: Push",
            /* ... other day fields ... */
            "exercises": [
              {
                "id": "uuid",
                /* ... other exercise fields ... */
                "sets": [
                  {
                    "id": "uuid",
                    /* ... other set fields ... */
                  }
                ]
              }
            ]
          }
        ],
        "progressions": [
          {
            "id": "uuid",
            "exercise_id": "uuid",
            /* ... other exercise progression fields ... */
          }
        ]
      }
    }
    ```
-   **Response (404 Not Found)**: If the plan is not found or not accessible to the user.

#### PUT /api/training-plans/{planId}

Updates an existing training plan by its ID, if it belongs to the authenticated user.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**: `planId` (UUID) - The ID of the training plan to update.
-   **Request Body**: `UpdateTrainingPlanCommand` (at least one field must be present)
    ```json
    {
      "name": "string (optional, max 255)",
      "description": "string (optional)"
    }
    ```
-   **Response (200 OK)**: The updated `TrainingPlanDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "name": "Updated Plan Name",
        "description": "Updated description.",
        "user_id": "uuid",
        "updated_at": "timestamp" 
      }
    }
    ```
-   **Response (404 Not Found)**: If the plan is not found or not accessible to the user for an update.

#### DELETE /api/training-plans/{planId}

Deletes a specific training plan by its ID, if it belongs to the authenticated user.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**: `planId` (UUID) - The ID of the training plan to delete.
-   **Response (204 No Content)**: Indicates successful deletion with no response body.
-   **Response (404 Not Found)**: If the plan is not found or not accessible to the user for deletion.

### Training Plan Days API

Manages days within a specific training plan.

#### GET /api/training-plans/{planId}/days

Retrieves a list of all training days for a specified training plan. Includes nested exercise and set data.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**:
    -   `planId` (UUID, required): The ID of the training plan.
-   **URL Query Parameters**:
    -   `limit` (optional, integer, default: 20, max: 100): Number of days to return.
    -   `offset` (optional, integer, default: 0): Offset for pagination.
-   **Response (200 OK)**: An array of `TrainingPlanDayDto` objects.
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "name": "Day 1: Push",
          "description": "Chest, Shoulders, Triceps",
          "order_index": 1,
          "training_plan_id": "uuid",
          "exercises": [
            {
              "id": "uuid",
              "exercise_id": "uuid",
              "training_plan_day_id": "uuid",
              "order_index": 1,
              "sets": [
                {
                  "id": "uuid",
                  "training_plan_exercise_id": "uuid",
                  "set_index": 1,
                  "expected_reps": 10,
                  "expected_weight": 52.5
                }
              ]
            }
          ]
        }
      ]
    }
    ```
-   **Response (400 Bad Request)**: If `planId` format is invalid or pagination parameters are incorrect.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan with `planId` is not found or not accessible to the user.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### POST /api/training-plans/{planId}/days

Creates a new training day within a specified training plan. `order_index` is managed by the backend.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**:
    -   `planId` (UUID, required): The ID of the training plan.
-   **Request Body**: `CreateTrainingPlanDayCommand`
    ```json
    {
      "name": "string (required)",
      "description": "string | null (optional)",
      "order_index": "integer (optional, positive)"
    }
    ```
-   **Response (201 Created)**: The newly created `TrainingPlanDayDto` object (without nested exercises).
    ```json
    {
      "data": {
        "id": "uuid",
        "name": "Day 2: Pull",
        "description": "Back, Biceps",
        "order_index": 2,
        "training_plan_id": "uuid",
        "created_at": "timestamp",
        "updated_at": "timestamp"
      }
    }
    ```
-   **Response (400 Bad Request)**: If `planId` format is invalid or the request body is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan with `planId` is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### GET /api/training-plans/{planId}/days/{dayId}

Retrieves details for a specific training day, including nested exercise and set data.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
-   **Response (200 OK)**: The `TrainingPlanDayDto` object, including `exercises` and their `sets`.
    ```json
    {
      "data": {
        "id": "uuid",
        "name": "Day 1: Push",
        "description": "Chest, Shoulders, Triceps",
        "order_index": 1,
        "training_plan_id": "uuid",
        "created_at": "timestamp",
        "updated_at": "timestamp",
        "exercises": [ /* ... as in GET /api/training-plans/{planId}/days ... */ ]
      }
    }
    ```
-   **Response (400 Bad Request)**: If `planId` or `dayId` format is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan or day is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### PUT /api/training-plans/{planId}/days/{dayId}

Updates an existing training day. If `order_index` is changed, reordering of other days occurs.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day to update.
-   **Request Body**: `UpdateTrainingPlanDayCommand` (at least one field must be present)
    ```json
    {
      "name": "string (optional)",
      "description": "string | null (optional)",
      "order_index": "integer (optional, positive)"
    }
    ```
-   **Response (200 OK)**: The updated `TrainingPlanDayDto` object (without nested exercises).
    ```json
    {
      "data": {
        "id": "uuid",
        "name": "Day 1: Upper Body Push",
        "description": "Focus on compound movements",
        "order_index": 1,
        "training_plan_id": "uuid",
        "created_at": "timestamp", 
        "updated_at": "timestamp"
      }
    }
    ```
-   **Response (400 Bad Request)**: If `planId` or `dayId` format is invalid, or the request body is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan or day is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### DELETE /api/training-plans/{planId}/days/{dayId}

Deletes a specific training day. Reordering of subsequent days occurs automatically.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day to delete.
-   **Response (204 No Content)**: Indicates successful deletion with no response body.
-   **Response (400 Bad Request)**: If `planId` or `dayId` format is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan or day is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

### Training Plan Exercises API

Manages exercises within a specific training plan day.

#### GET /api/training-plans/{planId}/days/{dayId}/exercises

Retrieves a list of all exercises for a specified training day.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
-   **URL Query Parameters**:
    -   `limit` (optional, integer, default: 20, max: 100): Number of exercises to return.
    -   `offset` (optional, integer, default: 0): Offset for pagination.
-   **Response (200 OK)**: An array of `TrainingPlanExerciseDto` objects.
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "exercise_id": "uuid", // References the global exercises table
          "training_plan_day_id": "uuid",
          "order_index": 1,
          "sets": [ /* Array of TrainingPlanExerciseSetDto */ ]
        }
      ]
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid or pagination parameters are incorrect.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan or day is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### POST /api/training-plans/{planId}/days/{dayId}/exercises

Adds a new exercise to a specified training day. `order_index` is managed by the backend.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
-   **Request Body**: `CreateTrainingPlanExerciseCommand`
    ```json
    {
      "exercise_id": "uuid (required)", // ID of the exercise from the global exercises table
      "order_index": "integer (optional, positive)" // If omitted, appends to the end
    }
    ```
-   **Response (201 Created)**: The newly created `TrainingPlanExerciseDto` object (without nested sets usually, unless explicitly designed to return them).
    ```json
    {
      "data": {
        "id": "uuid",
        "exercise_id": "uuid",
        "training_plan_day_id": "uuid",
        "order_index": 1
      }
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid or the request body is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, day, or the referenced global exercise is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### GET /api/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}

Retrieves a specific exercise within a training day by its ID. Includes associated sets.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
    -   `exerciseId` (UUID, required): The ID of the training plan exercise entry (`training_plan_exercises.id`) to retrieve.
-   **Response (200 OK)**: The `TrainingPlanExerciseDto` object, including `sets`.
    ```json
    {
      "data": {
        "id": "uuid",
        "exercise_id": "uuid", // References the global exercises table
        "training_plan_day_id": "uuid",
        "order_index": 1,
        "sets": [
          {
            "id": "uuid",
            "training_plan_exercise_id": "uuid",
            "set_index": 1,
            "expected_reps": 10,
            "expected_weight": 52.5
          }
        ]
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If any path parameter format is invalid.
    -   `401 Unauthorized`: If the authentication token is missing or invalid.
    -   `404 Not Found`: If the training plan, day, or specific plan exercise is not found or not accessible.
    -   `500 Internal Server Error`: If an unexpected server error occurs.

#### PUT /api/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}

Updates an existing exercise within a training day, primarily for reordering.
This endpoint corresponds to the `update_training_plan_exercise_order` RPC.
If other fields of `training_plan_exercises` need to be updated, a separate endpoint or an extension to this one might be required.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
    -   `exerciseId` (UUID, required): The ID of the training plan exercise entry (`training_plan_exercises.id`) to update.
-   **Request Body**: `UpdateTrainingPlanExerciseOrderCommand`
    ```json
    {
      "order_index": "integer (required, positive)"
    }
    ```
-   **Response (200 OK)**: The updated `TrainingPlanExerciseDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "exercise_id": "uuid",
        "training_plan_day_id": "uuid",
        "order_index": 2 // Updated order_index
      }
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid or the request body is invalid (e.g., missing `order_index`).
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, day, or specific plan exercise is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs during the update or reordering.

#### DELETE /api/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}

Deletes a specific exercise from a training day. Reordering of subsequent exercises occurs automatically.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
    -   `exerciseId` (UUID, required): The ID of the training plan exercise entry (`training_plan_exercises.id`) to delete.
-   **Response (204 No Content)**: Indicates successful deletion with no response body.
-   **Response (400 Bad Request)**: If path parameter formats are invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, day, or specific plan exercise is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

### Training Plan Exercise Sets API

Manages sets for a specific exercise within a training plan day.

#### GET /api/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets

Retrieves a list of all sets for a specified exercise within a training day.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
    -   `exerciseId` (UUID, required): The ID of the training plan exercise (`training_plan_exercises.id`).
-   **URL Query Parameters**:
    -   `limit` (optional, integer, default: 20, max: 100): Number of sets to return.
    -   `offset` (optional, integer, default: 0): Offset for pagination.
-   **Response (200 OK)**: An array of `TrainingPlanExerciseSetDto` objects.
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "training_plan_exercise_id": "uuid",
          "set_index": 1,
          "expected_reps": 5,
          "expected_weight": 52.5
        }
      ]
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid or pagination parameters are incorrect.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, day, or exercise is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### POST /api/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets

Creates a new set for a specified exercise within a training day. `set_index` is typically managed by the backend or can be optionally provided.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
    -   `exerciseId` (UUID, required): The ID of the training plan exercise (`training_plan_exercises.id`).
-   **Request Body**: `CreateTrainingPlanExerciseSetCommand`
    ```json
    {
      "set_index": "integer (optional, positive)",
      "expected_reps": "integer (required, positive)",
      "expected_weight": "number (required, positive)"
    }
    ```
-   **Response (201 Created)**: The newly created `TrainingPlanExerciseSetDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_plan_exercise_id": "uuid",
        "set_index": 1,
        "expected_reps": 5,
        "expected_weight": 52.5
      }
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid or the request body is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, day, or exercise is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### GET /api/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}

Retrieves details for a specific set.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
    -   `exerciseId` (UUID, required): The ID of the training plan exercise (`training_plan_exercises.id`).
    -   `setId` (UUID, required): The ID of the training plan exercise set.
-   **Response (200 OK)**: The `TrainingPlanExerciseSetDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_plan_exercise_id": "uuid",
        "set_index": 1,
        "expected_reps": 5,
        "expected_weight": 52.5
      }
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, day, exercise, or set is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### PUT /api/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}

Updates an existing set.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
    -   `exerciseId` (UUID, required): The ID of the training plan exercise (`training_plan_exercises.id`).
    -   `setId` (UUID, required): The ID of the training plan exercise set to update.
-   **Request Body**: `UpdateTrainingPlanExerciseSetCommand` (at least one field must be present)
    ```json
    {
      "set_index": "integer (optional, positive)",
      "expected_reps": "integer (optional, positive)",
      "expected_weight": "number (optional, positive)"
    }
    ```
-   **Response (200 OK)**: The updated `TrainingPlanExerciseSetDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_plan_exercise_id": "uuid",
        "set_index": 1,
        "expected_reps": 5,
        "expected_weight": 55.0
      }
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid or the request body is invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, day, exercise, or set is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### DELETE /api/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}

Deletes a specific set. Reordering of subsequent sets (if `set_index` is managed) occurs automatically.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `dayId` (UUID, required): The ID of the training plan day.
    -   `exerciseId` (UUID, required): The ID of the training plan exercise (`training_plan_exercises.id`).
    -   `setId` (UUID, required): The ID of the training plan exercise set to delete.
-   **Response (204 No Content)**: Indicates successful deletion with no response body.
-   **Response (400 Bad Request)**: If path parameter formats are invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, day, exercise, or set is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

### Training Plan Exercise Progression API

Manages progression rules for a specific exercise within a training plan.

#### GET /api/training-plans/{planId}/progressions

Retrieves the progression rules for all exercises within a training plan.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
-   **Response (200 OK)**: An array of `TrainingPlanExerciseProgressionDto` objects.
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "training_plan_id": "uuid",
          "exercise_id": "uuid",
          "weight_increment": 2.5,
          "failure_count_for_deload": 3,
          "deload_percentage": 10.0,
          "deload_strategy": "PROPORTIONAL",
          "consecutive_failures": 0,
          "last_updated": "2023-01-01T00:00:00Z",
          "reference_set_index": null
        }
      ]
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, exercise, or the specific progression rule is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### GET /api/training-plans/{planId}/progressions/{exerciseId}

Retrieves the progression rule for a specific exercise within a training plan.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `exerciseId` (UUID, required): The ID of the exercise (from the global `exercises` table) for which progression is being fetched. This corresponds to the `exercise_id` in the `training_plan_exercise_progressions` table.
-   **Response (200 OK)**: The `TrainingPlanExerciseProgressionDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_plan_id": "uuid",
        "exercise_id": "uuid",
        "weight_increment": 2.5,
        "failure_count_for_deload": 3,
        "deload_percentage": 10.0,
        "deload_strategy": "PROPORTIONAL",
        "consecutive_failures": 0,
        "last_updated": "2023-01-01T00:00:00Z",
        "reference_set_index": null
      }
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan, exercise, or the specific progression rule is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

#### PUT /api/training-plans/{planId}/progressions/{exerciseId}

Creates or updates (upserts) the progression rule for a specific exercise within a training plan.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `planId` (UUID, required): The ID of the training plan.
    -   `exerciseId` (UUID, required): The ID of the exercise (from the global `exercises` table).
-   **Request Body**: `UpdateTrainingPlanExerciseProgressionCommand` (at least one field must be present for an update; `weight_increment`, `failure_count_for_deload` are required if creating a new progression rule for an exercise that doesn't have one).
    ```json
    {
      "weight_increment": 2.5,                // Optional (Required for create), NUMERIC(7,3) > 0
      "failure_count_for_deload": 3,          // Optional (Required for create), SMALLINT > 0
      "consecutive_failures": 0,              // Optional, SMALLINT >= 0
      "deload_percentage": 10.0,              // Optional, NUMERIC(4,2) > 0
      "deload_strategy": "PROPORTIONAL",      // Optional, ENUM('PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM')
      "reference_set_index": null             // Optional, SMALLINT >= 0 or null
    }
    ```
-   **Response (200 OK/201 Created)**: Returns the newly created or updated `TrainingPlanExerciseProgressionDto`.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_plan_id": "uuid",
        "exercise_id": "uuid",
        "weight_increment": 2.5,
        "failure_count_for_deload": 3,
        "deload_percentage": 10.0,
        "deload_strategy": "PROPORTIONAL",
        "consecutive_failures": 0,
        "last_updated": "2023-01-01T00:00:00Z",
        "reference_set_index": null
      }
    }
    ```
-   **Response (400 Bad Request)**: If path parameter formats are invalid, the request body is invalid (e.g., missing required fields for creation, invalid values), or no fields provided for update.
-   **Response (401 Unauthorized)**: If the authentication token is missing or invalid.
-   **Response (404 Not Found)**: If the training plan or exercise is not found or not accessible.
-   **Response (500 Internal Server Error)**: If an unexpected server error occurs.

### Training Sessions API

Manages user training sessions, allowing for creation, listing, retrieval, updates (e.g., cancellation), and marking sessions as complete, which triggers exercise progression logic.

#### GET /api/training-sessions

Lists all training sessions for the authenticated user. Supports pagination, sorting, and filtering.

-   **Authorization**: Bearer token required.
-   **URL Query Parameters**:
    -   `limit` (optional, integer, default: 20, max: 100): Number of sessions to return.
    -   `offset` (optional, integer, default: 0): Offset for pagination.
    -   `sort` (optional, string, default: `session_date.desc`): Sort criteria (e.g., `session_date.asc`, `status.asc`).
    -   `status` (optional, string): Filter by session status (e.g., `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
    -   `date_from` (optional, string ISO 8601): Filter sessions from this date (inclusive).
    -   `date_to` (optional, string ISO 8601): Filter sessions up to this date (inclusive).
    -   `plan_id` (optional, string UUID): Filter sessions associated with a training plan with a given `training_plan_id`.
-   **Response (200 OK)**: An array of `TrainingSessionDto` objects.
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "training_plan_id": "uuid",
          "training_plan_day_id": "uuid",
          "user_id": "uuid",
          "session_date": "2023-01-01T00:00:00Z",
          "status": "IN_PROGRESS",
          "sets": [
            {
              "id": "uuid",
              "training_session_id": "uuid", // Matches parent session ID
              "training_plan_exercise_id": "uuid", // ID of the exercise from training_plan_exercises
              "set_index": 1,
              "expected_reps": 10,
              "actual_reps": null,
              "actual_weight": 50.0,
              "status": "PENDING", // or 'COMPLETED', 'FAILED', 'SKIPPED'
              "completed_at": null // or timestamp
            }
            // ... other sets for this session
          ]
        }
      ],
      "totalCount": 42 // Total row count, used in pagination scenarios
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If query parameters are invalid.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `500 Internal Server Error`: For unexpected server issues.

#### POST /api/training-sessions

Creates a new training session for the authenticated user.
If `training_plan_day_id` is not provided, the system determines it:
- If historical completed sessions exist for the `training_plan_id`, the next `training_plan_day_id` in sequence is chosen.
- Otherwise, the first `training_plan_day_id` of the `training_plan_id` is chosen.
Once the `training_plan_day_id` is determined (either provided or automatically selected), new `session_sets` are automatically created for the session. These sets are based on the `training_plan_exercise_sets` defined for the determined day. `actual_reps` and `actual_weight` for these new sets are initialized from the `expected_reps` and `expected_weight` of the plan, and their `status` is set to `PENDING`.

-   **Authorization**: Bearer token required.
-   **Request Body**: `CreateTrainingSessionCommand`
    ```json
    {
      "training_plan_id": "uuid", // Required
      "training_plan_day_id": "uuid" // Optional. If not provided, it's determined automatically.
    }
    ```
-   **Response (201 Created)**: The newly created `TrainingSessionDto` object, including auto-generated `session_sets`.
    ```json
    {
      "data": {
        "id": "uuid", // ID of the new session
        "training_plan_id": "uuid", // As provided
        "training_plan_day_id": "uuid", // Provided or determined
        "user_id": "uuid", // ID of the authenticated user
        "session_date": "2023-01-01T00:00:00Z", // Creation timestamp
        "status": "PENDING", // Default status
        "sets": [ // Auto-created session sets
          {
            "id": "uuid", // ID of the new session set
            "training_session_id": "uuid", // Matches parent session ID
            "training_plan_exercise_id": "uuid", // From the plan day's exercise
            "set_index": 1,
            "expected_reps": 10,     // Initialized from plan's expected_reps
            "actual_reps": null,     // Initially null
            "actual_weight": 50.0, // Initialized from plan's expected_weight
            "status": "PENDING",
            "completed_at": null
          }
          // ... other auto-created sets based on the plan day
        ]
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If the request body is invalid, or if the referenced `training_plan_id` or `training_plan_day_id` is not found or not accessible to the user.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `500 Internal Server Error`: For unexpected server issues.

#### GET /api/training-sessions/{sessionId}

Retrieves a specific training session by its ID, if it belongs to the authenticated user.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**: `sessionId` (UUID) - The ID of the training session.
-   **Response (200 OK)**: The `TrainingSessionDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_plan_id": "uuid",
        "training_plan_day_id": "uuid",
        "user_id": "uuid",
        "session_date": "2023-01-01T00:00:00Z",
        "status": "IN_PROGRESS",
        "sets": [
          {
            "id": "uuid",
            "training_session_id": "uuid", // Matches parent session ID
            "training_plan_exercise_id": "uuid", // ID of the exercise from training_plan_exercises
            "set_index": 1,
            "expected_reps": 10,
            "actual_reps": null,
            "actual_weight": 50.0,
            "status": "PENDING", // or 'COMPLETED', 'FAILED', 'SKIPPED'
            "completed_at": null // or timestamp
          }
          // ... other sets for this session
        ]
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If `sessionId` format is invalid.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the session is not found or not accessible to the user.
    -   `500 Internal Server Error`: For unexpected server issues.

#### PUT /api/training-sessions/{sessionId}

Updates the status of an existing training session (e.g., to cancel it).

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**: `sessionId` (UUID) - The ID of the training session.
-   **Request Body**: `UpdateTrainingSessionCommand`
    ```json
    {
      "status": "CANCELLED" // e.g., 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    }
    ```
-   **Response (200 OK)**: The full, updated `TrainingSessionDto` object, including any nested sets.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_plan_id": "uuid",
        "training_plan_day_id": "uuid",
        "user_id": "uuid",
        "session_date": "2023-01-01T00:00:00Z",
        "status": "CANCELLED", // Updated status
        "sets": [
          {
            "id": "uuid",
            "training_session_id": "uuid",
            "training_plan_exercise_id": "uuid",
            "set_index": 1,
            "expected_reps": 10,
            "actual_reps": null,
            "actual_weight": 50.0,
            "status": "PENDING",
            "completed_at": null
          }
          // ... other existing sets for this session
        ]
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If `sessionId` format is invalid or the request body is invalid (e.g., invalid status).
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the session is not found or not accessible to the user.
    -   `500 Internal Server Error`: For unexpected server issues.

#### DELETE /api/training-sessions/{sessionId}

Deletes a specific training session by its ID, if it belongs to the authenticated user. Associated session sets are deleted via cascading delete in the database.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**: `sessionId` (UUID) - The ID of the training session to delete.
-   **Response (204 No Content)**: Indicates successful deletion.
-   **Responses (Error)**:
    -   `400 Bad Request`: If `sessionId` format is invalid.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the session is not found or not accessible to the user.
    -   `500 Internal Server Error`: For unexpected server issues.

#### POST /api/training-sessions/{sessionId}/complete

Marks a training session as completed and triggers exercise progression logic.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**: `sessionId` (UUID) - The ID of the training session to complete.
-   **Request Body**: Empty (`CompleteTrainingSessionCommand` is `Record<string, never>`).
-   **Response (200 OK)**: The full, updated `TrainingSessionDto` object (including nested fields like `sets`) with status set to `COMPLETED`.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_plan_id": "uuid",
        "training_plan_day_id": "uuid",
        "user_id": "uuid",
        "session_date": "2023-01-01T00:00:00Z",
        "status": "COMPLETED",
        "sets": [
          {
            "id": "uuid",
            "training_session_id": "uuid", 
            "training_plan_exercise_id": "uuid",
            "set_index": 1,
            "expected_reps": 10,
            "actual_reps": 10,
            "actual_weight": 50.0,
            "status": "COMPLETED", // Example: sets also marked completed
            "completed_at": "2023-01-02T10:30:00Z"
          }
          // ... other sets for this session, likely also completed
        ]
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If `sessionId` format is invalid or the session is not in a state that can be completed (e.g., already 'CANCELLED' or 'COMPLETED').
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the session is not found or not accessible to the user.
    -   `500 Internal Server Error`: For unexpected server issues, especially during progression logic.

### Session Sets API

Manages sets within a specific training session.

#### GET /api/training-sessions/{sessionId}/sets

Retrieves a list of all sets for a specified training session.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**:
    -   `sessionId` (UUID, required): The ID of the training session.
-   **Response (200 OK)**: An array of `SessionSetDto` objects.
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "training_session_id": "uuid",
          "training_plan_exercise_id": "uuid",
          "set_index": 1,
          "expected_reps": 5,
          "actual_reps": 5,
          "actual_weight": 57.5,
          "status": "PENDING",
          "completed_at": null
        }
      ]
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If `sessionId` format is invalid.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the training session is not found or not accessible.
    -   `500 Internal Server Error`: If an unexpected server error occurs.

#### POST /api/training-sessions/{sessionId}/sets

Creates a new set for a specified training session.

-   **Authorization**: Bearer token required.
-   **URL Path Parameter**:
    -   `sessionId` (UUID, required): The ID of the training session.
-   **Request Body**: `CreateSessionSetCommand`
    ```json
    {
      "training_plan_exercise_id": "uuid", // Required, ID from training_plan_exercises
      "set_index": 1, // Optional, SMALLINT >= 1. If provided, inserts at this position and shifts others. If omitted, appends to the end.
      "expected_reps": 5, // Required, SMALLINT >= 0
      "actual_reps": 5, // Optional, SMALLINT >= 0, nullabe
      "actual_weight": 57.5, // Required, NUMERIC(7,3) >= 0
      "status": "PENDING",  // Optional, e.g., 'PENDING', 'COMPLETED', 'FAILED', 'SKIPPED', defaults to PENDING
      "completed_at": "datetime" // Optional; required if status is 'COMPLETED' or 'FAILED'.
    }
    ```
-   **Response (201 Created)**: The newly created `SessionSetDto` object.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_session_id": "uuid",
        "training_plan_exercise_id": "uuid",
        "set_index": 1, // or assigned index
        "expected_reps": 5,
        "actual_reps": 5,
        "actual_weight": 57.5,
        "status": "PENDING", // or provided status
        "completed_at": null // or provided datetime
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If `sessionId` format is invalid, or the request body is invalid (e.g., missing required fields, invalid `set_index`).
    -   `401 Unauthorized`: If the authentication token is missing or invalid.
    -   `404 Not Found`: If the training session or referenced `training_plan_exercise_id` is not found or not accessible.
    -   `500 Internal Server Error`: If an unexpected server error occurs.

#### GET /api/training-sessions/{sessionId}/sets/{setId}

Retrieves details for a specific set within a training session.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `sessionId` (UUID, required): The ID of the training session.
    -   `setId` (UUID, required): The ID of the session set.
-   **Response (200 OK)**: The `SessionSetDto` object.
    ```json
    {
      "data": {
        "id": "uuid", // ID of the session set
        "training_session_id": "uuid", // Parent session ID
        "training_plan_exercise_id": "uuid", // Corresponding exercise in the plan
        "set_index": 1,
        "expected_reps": 5,
        "actual_weight": 55.0,
        "actual_reps": 8,
        "status": "COMPLETED",
        "completed_at": "2023-01-01T10:05:00Z"
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If `sessionId` or `setId` format is invalid.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the training session or set is not found or not accessible.
    -   `500 Internal Server Error`: If an unexpected server error occurs.

#### PUT /api/training-sessions/{sessionId}/sets/{setId}

Updates an existing set within a training session.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `sessionId` (UUID, required): The ID of the training session.
    -   `setId` (UUID, required): The ID of the session set to update.
-   **Request Body**: `UpdateSessionSetCommand` (at least one optional field must be provided)
    ```json
    {
      "set_index": 1, // Optional, SMALLINT >= 1. Reorders sets if changed.
      "expected_reps": 5, // Optional, SMALLINT >= 0
      "actual_reps": 5, // Optional, SMALLINT >= 0, nullable
      "actual_weight": 57.5, // Optional, NUMERIC(7,3) >= 0
      "status": "COMPLETED", // Optional, e.g., 'PENDING', 'COMPLETED', 'FAILED', 'SKIPPED'
      "completed_at": "datetime" // Optional; required if status is 'COMPLETED' or 'FAILED'. If status is 'COMPLETED' or 'FAILED' and this is omitted, it defaults to NOW().
    }
    ```
-   **Response (200 OK)**: The updated `SessionSetDto` object.
    ```json
    {
      "data": {
        "id": "uuid", // ID of the session set (matches setId)
        "training_session_id": "uuid", // Parent session ID
        "training_plan_exercise_id": "uuid", // Corresponding exercise in the plan
        "set_index": 1, // Updated value
        "expected_reps": 5, // Updated value
        "actual_reps": 5, // Updated value
        "actual_weight": 57.5, // Updated value
        "status": "COMPLETED", // Updated value
        "completed_at": "2023-01-01T10:10:00Z" // Updated or set to NOW()
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If path parameter formats are invalid, the request body is invalid, or no fields provided for update.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the training session or set is not found or not accessible.
    -   `500 Internal Server Error`: If an unexpected server error occurs.

#### DELETE /api/training-sessions/{sessionId}/sets/{setId}

Deletes a specific set from a training session. Reordering of subsequent sets occurs automatically.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `sessionId` (UUID, required): The ID of the training session.
    -   `setId` (UUID, required): The ID of the session set to delete.
-   **Response (204 No Content)**: Indicates successful deletion.
-   **Responses (Error)**:
    -   `400 Bad Request`: If path parameter formats are invalid.
    -   `401 Unauthorized`: If the authentication token is missing or invalid.
    -   `404 Not Found`: If the training session or set is not found or not accessible.
    -   `500 Internal Server Error`: If an unexpected server error occurs.

#### PATCH /api/training-sessions/{sessionId}/sets/{setId}/complete

Marks a specific set as completed.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `sessionId` (UUID, required): The ID of the training session.
    -   `setId` (UUID, required): The ID of the session set.
-   **Response (200 OK)**: The updated `SessionSetDto` object with `status: "COMPLETED"` and `completed_at` set to the current server time.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_session_id": "uuid",
        "training_plan_exercise_id": "uuid",
        "set_index": 1,
        "expected_reps": 5,
        "actual_reps": 5, // Updated to the current value of 'expected_reps'
        "actual_weight": 57.5,
        "status": "COMPLETED",
        "completed_at": "2023-01-01T00:00:00Z" // Server time of completion
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If path parameter formats are invalid.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the training session or set is not found or not accessible.
    -   `500 Internal Server Error`: If an unexpected server error occurs.

#### PATCH /api/training-sessions/{sessionId}/sets/{setId}/fail

Marks a specific set as failed.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `sessionId` (UUID, required): The ID of the training session.
    -   `setId` (UUID, required): The ID of the session set.
-   **URL Query Parameters**:
    -   `reps` (optional, integer, default: 0): Number of actual repetitions performed (must be >= 0).
-   **Response (200 OK)**: The updated `SessionSetDto` object with `status: "FAILED"`, `completed_at` set to current server time, and `actual_reps` updated if provided.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_session_id": "uuid",
        "training_plan_exercise_id": "uuid",
        "set_index": 1,
        "expected_reps": 5,
        "actual_reps": 3,  // Updated from 'reps' query param or 0
        "actual_weight": 57.5,
        "status": "FAILED",
        "completed_at": "2023-01-01T00:00:00Z" // Server time of failure
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If path parameter formats are invalid or `reps` query parameter is invalid. Alternatively, if the `reps` value is equal to or higher than `expected_reps` of the referenced set.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the training session or set is not found or not accessible.
    -   `500 Internal Server Error`: If an unexpected server error occurs.

#### PATCH /api/training-sessions/{sessionId}/sets/{setId}/reset

Marks a specific set as pending.

-   **Authorization**: Bearer token required.
-   **URL Path Parameters**:
    -   `sessionId` (UUID, required): The ID of the training session.
    -   `setId` (UUID, required): The ID of the session set.
-   **Response (200 OK)**: The updated `SessionSetDto` object with `status: "PENDING"` and `completed_at` set to null.
    ```json
    {
      "data": {
        "id": "uuid",
        "training_session_id": "uuid",
        "training_plan_exercise_id": "uuid",
        "set_index": 1,
        "expected_reps": 5,
        "actual_reps": null, // Updated to null
        "actual_weight": 57.5,
        "status": "PENDING",
        "completed_at": null // Updated to null
      }
    }
    ```
-   **Responses (Error)**:
    -   `400 Bad Request`: If path parameter formats are invalid.
    -   `401 Unauthorized`: If the authentication token is invalid or missing.
    -   `404 Not Found`: If the training session or set is not found or not accessible.
    -   `500 Internal Server Error`: If an unexpected server error occurs.

### Health Check API

The Health Check API provides a simple endpoint to check the health status of the API.

#### GET /api/health

Checks the health status of the API.

-   **Authorization**: No authentication required.
-   **Response (200 OK)**: A JSON object indicating the health status.
    ```json
    {
      "status": "ok",
      "timestamp": "2023-01-01T00:00:00.000Z"
    }
    ```
