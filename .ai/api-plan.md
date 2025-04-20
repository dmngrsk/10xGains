# REST API Plan

## 1. Resources

- **User Profiles**: Corresponds to the `user_profiles` table. This resource holds additional user data (e.g., first name, active training plan ID) and is linked to Supabase authentication.

- **Training Plans**: Represents the `training_plans` table. It contains the plan name, associated user, and creation timestamp.

- **Training Plan Days**: Maps to the `training_plan_days` table. These are the individual days within a training plan, each having a name, description, and order index.

- **Exercises**: Corresponds to the `exercises` table. This resource includes predefined exercises (name and description) available for users to include in their plans.

- **Training Plan Exercises**: Based on the `training_plan_exercises` table, this resource links a training day with an exercise and preserves the order of exercises.

- **Training Plan Exercise Sets**: Relates to the `training_plan_exercise_sets` table. Each set includes an expected number of reps and the expected weight to be lifted for a given exercise.

- **Training Plan Exercise Progressions**: Maps to the `training_plan_exercise_progressions` table. It defines the progression rules for each exercise within a training plan (e.g., weight increment, failure thresholds, deload strategy).

- **Training Sessions**: Corresponds to the `training_sessions` table. These resources track individual workout sessions including session date, status, and the associated training plan/day.

- **Session Sets**: Based on the `session_sets` table, this resource records the actual performance data for each set within a training session (actual weight, actual reps, status, and completion time).

## 2. Endpoints

> **Note:** Except for global resources, all endpoints operate on data exclusively associated with the currently authenticated user. Queries are automatically filtered using the user's ID (via Row-Level Security in the database). Any attempt to access data that does not belong to the authenticated user will be rejected with a 404 Not Found error.

For each resource, standard CRUD endpoints are defined along with endpoints catering to specific business logic. Endpoints will support pagination, filtering, and sorting where applicable.

### User Profiles

- **GET /profiles/{id}**
  - Description: Retrieve the authenticated user's profile. The provided `{id}` must match the authenticated user's ID.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "first_name": "John",
      "active_training_plan_id": null,
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 403 Forbidden

- **PUT /profiles/{id}**
  - Description: Update profile details for the authenticated user. The `{id}` must match the authenticated user's ID.
  - Request Body:
    ```json
    {
      "first_name": "John",
      "active_training_plan_id": "uuid"
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "first_name": "John",
      "active_training_plan_id": "uuid",
      "updated_at": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden

### Training Plans

- **GET /training-plans**
  - Description: List all training plans belonging to the authenticated user.
  - Query Parameters: `limit`, `offset`, `sort`
  - Example Response:
    ```json
    [
      {
        "id": "uuid",
        "name": "Plan Name",
        "description": "Optional description",
        "user_id": "uuid",
        "created_at": "2023-01-01T00:00:00Z"
      }
    ]
    ```
  - Success: 200 OK

- **POST /training-plans**
  - Description: Create a new training plan for the authenticated user.
  - Request Body:
    ```json
    {
      "name": "Plan Name",
      "description": "Optional description"
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "name": "Plan Name",
      "description": "Optional description",
      "user_id": "uuid",
      "created_at": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 201 Created
  - Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden

- **GET /training-plans/{planId}**
  - Description: Retrieve details for a specific training plan that belongs to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "name": "Plan Name",
      "description": "Optional description",
      "user_id": "uuid",
      "created_at": "2023-01-01T00:00:00Z",
      "training_days": [
        {
          "id": "uuid",
          "name": "Day 1",
          "description": "Optional description",
          "order_index": 1,
          "exercises": [
            {
              "id": "uuid",
              "exercise_id": "uuid",
              "order_index": 1
            },
            {
              "id": "uuid",
              "exercise_id": "uuid",
              "order_index": 2
            }
          ]
        },
        {
          "id": "uuid",
          "name": "Day 2",
          "description": "Optional description",
          "order_index": 2,
          "exercises": []
        }
      ]
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PUT /training-plans/{planId}**
  - Description: Update a training plan belonging to the authenticated user.
  - Request Body:
    ```json
    {
      "name": "Updated Plan Name",
      "description": "Updated description"
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "name": "Updated Plan Name",
      "description": "Updated description",
      "user_id": "uuid",
      "updated_at": "2023-01-02T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 400 Bad Request, 401 Unauthorized, 404 Not Found

- **DELETE /training-plans/{planId}**
  - Description: Delete a training plan belonging to the authenticated user.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 404 Not Found

### Training Plan Days

- **GET /training-plans/{planId}/days**
  - Description: List all days for a specific training plan that belongs to the authenticated user.
  - Query Parameters: `limit`, `offset`
  - Example Response:
    ```json
    [
      {
        "id": "uuid",
        "name": "Day Name",
        "description": "Optional description",
        "order_index": 1,
        "training_plan_id": "uuid",
        "exercises": [
          {
            "id": "uuid",
            "exercise_id": "uuid",
            "order_index": 1
          },
          {
            "id": "uuid",
            "exercise_id": "uuid",
            "order_index": 2
          }
        ]
      }
    ]
    ```
  - Success: 200 OK

- **POST /training-plans/{planId}/days**
  - Description: Create a new day within a training plan that belongs to the authenticated user.
  - Request Body:
    ```json
    {
      "name": "Day Name",
      "description": "Optional description",
      "order_index": 1
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "name": "Day Name",
      "description": "Optional description",
      "order_index": 1,
      "training_plan_id": "uuid"
    }
    ```
  - Success: 201 Created
  - Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden

- **GET /training-plans/{planId}/days/{dayId}**
  - Description: Retrieve details of a specific day for a training plan owned by the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "name": "Day Name",
      "description": "Optional description",
      "order_index": 1,
      "training_plan_id": "uuid"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PUT /training-plans/{planId}/days/{dayId}**
  - Description: Update a day for a training plan belonging to the authenticated user.
  - Request Body:
    ```json
    {
      "name": "Updated Day Name",
      "description": "Updated description",
      "order_index": 2
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "name": "Updated Day Name",
      "description": "Updated description",
      "order_index": 2,
      "training_plan_id": "uuid"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **DELETE /training-plans/{planId}/days/{dayId}**
  - Description: Delete a day within a training plan owned by the authenticated user.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 404 Not Found

- **PATCH /training-plans/{planId}/days/{dayId}/reorder**
  - Description: Update the order index to reorder days within a training plan owned by the authenticated user.
  - Request Body:
    ```json
    {
      "order_index": 3
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "order_index": 3
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

### Exercises

- **GET /exercises**
  - Description: Retrieve a list of all available exercises. Global resource.
  - Example Response:
    ```json
    [
      {
        "id": "uuid",
        "name": "Squat",
        "description": "A lower-body exercise."
      }
    ]
    ```
  - Success: 200 OK

- **POST /exercises**
  - Description: Create a new exercise.
  - Request Body:
    ```json
    {
      "name": "Exercise Name",
      "description": "Details about the exercise"
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "name": "Exercise Name",
      "description": "Details about the exercise"
    }
    ```
  - Success: 201 Created
  - Errors: 401 Unauthorized, 403 Forbidden

- **GET /exercises/{id}**
  - Description: Retrieve details of a specific exercise. Global resource.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "name": "Squat",
      "description": "A lower-body exercise."
    }
    ```
  - Success: 200 OK

- **PUT /exercises/{id}**
  - Description: Update an exercise.
  - Request Body:
    ```json
    {
      "name": "Updated Exercise Name",
      "description": "Updated details about the exercise"
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "name": "Updated Exercise Name",
      "description": "Updated details about the exercise"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 403 Forbidden

- **DELETE /exercises/{id}**
  - Description: Delete an exercise.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 403 Forbidden

### Training Plan Exercises

- **GET /training-plan-days/{dayId}/exercises**
  - Description: List all exercises for a given training day. The day must belong to the authenticated user.
  - Example Response:
    ```json
    [
      {
        "id": "uuid",
        "exercise_id": "uuid",
        "order_index": 1,
        "training_plan_day_id": "uuid"
      }
    ]
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **POST /training-plan-days/{dayId}/exercises**
  - Description: Add an exercise to a training day owned by the authenticated user.
  - Request Body:
    ```json
    {
      "exercise_id": "uuid",
      "order_index": 1
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "exercise_id": "uuid",
      "order_index": 1,
      "training_plan_day_id": "uuid"
    }
    ```
  - Success: 201 Created
  - Errors: 401 Unauthorized, 404 Not Found

- **GET /training-plan-days/{dayId}/exercises/{exerciseId}**
  - Description: Retrieve details of a specific training plan exercise for a day owned by the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "exercise_id": "uuid",
      "order_index": 1,
      "training_plan_day_id": "uuid"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PUT /training-plan-days/{dayId}/exercises/{exerciseId}**
  - Description: Update a training plan exercise (e.g., change order) for a day owned by the authenticated user.
  - Request Body:
    ```json
    {
      "order_index": 2
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "order_index": 2
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **DELETE /training-plan-days/{dayId}/exercises/{exerciseId}**
  - Description: Remove an exercise from a training day owned by the authenticated user.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 404 Not Found

- **PATCH /training-plan-days/{dayId}/exercises/{exerciseId}/reorder**
  - Description: Update the order index to reorder exercises within a training day owned by the authenticated user.
  - Request Body:
    ```json
    {
      "order_index": 3
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "order_index": 3
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

### Training Plan Exercise Sets

- **GET /training-plan-exercises/{exerciseId}/sets**
  - Description: Retrieve all sets for a specific training plan exercise belonging to a training plan of the authenticated user.
  - Example Response:
    ```json
    [
      {
        "id": "uuid",
        "set_index": 1,
        "expected_reps": 10,
        "expected_weight": 50.0,
        "training_plan_exercise_id": "uuid"
      }
    ]
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **POST /training-plan-exercises/{exerciseId}/sets**
  - Description: Create a set for an exercise in a training plan belonging to the authenticated user.
  - Request Body:
    ```json
    {
      "set_index": 1,
      "expected_reps": 10,
      "expected_weight": 50.0
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "set_index": 1,
      "expected_reps": 10,
      "expected_weight": 50.0,
      "training_plan_exercise_id": "uuid"
    }
    ```
  - Success: 201 Created
  - Errors: 400 Bad Request, 401 Unauthorized, 404 Not Found

- **GET /training-plan-exercises/{exerciseId}/sets/{setId}**
  - Description: Retrieve details of a specific set for an exercise in a training plan owned by the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "set_index": 1,
      "expected_reps": 10,
      "expected_weight": 50.0,
      "training_plan_exercise_id": "uuid"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PUT /training-plan-exercises/{exerciseId}/sets/{setId}**
  - Description: Update a set for an exercise in a training plan belonging to the authenticated user.
  - Request Body:
    ```json
    {
      "set_index": 1,
      "expected_reps": 12,
      "expected_weight": 55.0
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "set_index": 1,
      "expected_reps": 12,
      "expected_weight": 55.0,
      "training_plan_exercise_id": "uuid"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **DELETE /training-plan-exercises/{exerciseId}/sets/{setId}**
  - Description: Delete a set for an exercise in a training plan owned by the authenticated user.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 404 Not Found

### Training Plan Exercise Progressions

- **GET /training-plans/{planId}/exercises/{exerciseId}/progression**
  - Description: Retrieve progression rules for a specific exercise in a training plan belonging to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "training_plan_id": "uuid",
      "exercise_id": "uuid",
      "weight_increment": 2.5,
      "failure_count_for_deload": 3,
      "deload_percentage": 10.0,
      "deload_strategy": "PROPORTIONAL",
      "current_weight": 50.0,
      "consecutive_failures": 0,
      "last_updated": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PUT /training-plans/{planId}/exercises/{exerciseId}/progression**
  - Description: Update progression details (e.g., `current_weight`, `consecutive_failures`) for an exercise in a training plan belonging to the authenticated user.
  - Request Body:
    ```json
    {
      "weight_increment": 2.5,
      "failure_count_for_deload": 3,
      "current_weight": 50.0
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "training_plan_id": "uuid",
      "exercise_id": "uuid",
      "weight_increment": 2.5,
      "failure_count_for_deload": 3,
      "deload_percentage": 10.0,
      "deload_strategy": "PROPORTIONAL",
      "current_weight": 50.0,
      "consecutive_failures": 0,
      "last_updated": "2023-01-01T00:00:00Z"
    }
    ```
  - Business Logic: Apply automated weight increment on success or a 10% deload after three consecutive failures.
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

### Training Sessions

- **GET /training-sessions**
  - Description: List training sessions for the authenticated user.
  - Query Parameters: `limit`, `offset`, `order`, `status`, `date_from`, `date_to`
  - Example Response:
    ```json
    [
      {
        "id": "uuid",
        "training_plan_id": "uuid",
        "training_plan_day_id": "uuid",
        "user_id": "uuid",
        "session_date": "2023-01-01T00:00:00Z",
        "status": "IN_PROGRESS"
      }
    ]
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 403 Forbidden

- **POST /training-sessions**
  - Description: Create a new training session for a given training plan and a specific day for the authenticated user.
  - Request Body:
    ```json
    {
      "training_plan_id": "uuid",
      "training_plan_day_id": "uuid"
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "training_plan_id": "uuid",
      "training_plan_day_id": "uuid",
      "user_id": "uuid",
      "session_date": "2023-01-01T00:00:00Z",
      "status": "IN_PROGRESS"
    }
    ```
  - Success: 201 Created
  - Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden

- **GET /training-sessions/{sessionId}**
  - Description: Retrieve details of a specific training session belonging to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "training_plan_id": "uuid",
      "training_plan_day_id": "uuid",
      "user_id": "uuid",
      "session_date": "2023-01-01T00:00:00Z",
      "status": "IN_PROGRESS"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PUT /training-sessions/{sessionId}**
  - Description: Update session details (e.g., status such as CANCELLED) for a training session belonging to the authenticated user.
  - Request Body:
    ```json
    {
      "status": "CANCELLED"
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "status": "CANCELLED"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **DELETE /training-sessions/{sessionId}**
  - Description: Delete (or cancel) a training session belonging to the authenticated user.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 404 Not Found

- **PATCH /training-sessions/{sessionId}/complete**
  - Description: Mark a session as COMPLETED, triggering business logic for updating exercise progressions, for a session belonging to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "status": "COMPLETED"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

### Session Sets

- **GET /training-sessions/{sessionId}/sets**
  - Description: List all session sets for a training session belonging to the authenticated user.
  - Example Response:
    ```json
    [
      {
        "id": "uuid",
        "training_plan_exercise_id": "uuid",
        "set_index": 1,
        "actual_weight": 0,
        "actual_reps": 0,
        "status": "PENDING"
      }
    ]
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 403 Forbidden

- **POST /training-sessions/{sessionId}/sets**
  - Description: Create a new session set for a training session belonging to the authenticated user. Often auto-generated based on the training plan exercise sets.
  - Request Body:
    ```json
    {
      "training_plan_exercise_id": "uuid",
      "set_index": 1
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "training_plan_exercise_id": "uuid",
      "set_index": 1,
      "actual_weight": 0,
      "actual_reps": 0,
      "status": "PENDING"
    }
    ```
  - Success: 201 Created
  - Errors: 401 Unauthorized, 403 Forbidden

- **GET /training-sessions/{sessionId}/sets/{setId}**
  - Description: Retrieve details for a specific session set for a training session belonging to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "training_plan_exercise_id": "uuid",
      "set_index": 1,
      "actual_weight": 0,
      "actual_reps": 0,
      "status": "PENDING"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PUT /training-sessions/{sessionId}/sets/{setId}**
  - Description: Update a session set with actual performance data (e.g., actual_reps, actual_weight, status) for a session belonging to the authenticated user.
  - Request Body:
    ```json
    {
      "actual_reps": 10,
      "actual_weight": 50.0,
      "status": "COMPLETED"
    }
    ```
  - Example Response:
    ```json
    {
      "id": "uuid",
      "actual_reps": 10,
      "actual_weight": 50.0,
      "status": "COMPLETED"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found
  - Validation: Ensure `actual_reps` and `actual_weight` are greater than 0.

- **PATCH /training-sessions/{sessionId}/sets/{setId}/complete**
  - Description: Mark a session set as completed and record the completion timestamp for a session belonging to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "status": "COMPLETED",
      "completed_at": "2023-01-01T00:00:00Z"
    }
    ```

- **PATCH /training-sessions/{sessionId}/sets/{setId}/failed**
  - Description: Mark a session set as failed and record the completion timestamp for a session belonging to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "status": "FAILED",
      "completed_at": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

### AI-Driven Training Suggestions

- **POST /ai/training-suggestions**
  - Description: Provide AI-generated training plan suggestions based on user input/preferences. While the endpoint is public, suggestions are tailored to the authenticated user context if available.
  - Request Body:
    ```json
    {
      "query": "User preferences or query"
    }
    ```
  - Example Response:
    ```json
    {
      "response": "Based on your fitness goals and experience level, I recommend this 2-day split focusing on progressive overload for compound movements. This plan incorporates adequate rest periods and targets all major muscle groups for balanced development.",
      "training_plan": {
        "id": "uuid",
        "name": "Plan Name",
        "description": "Optional description",
        "user_id": "uuid",
        "created_at": "2023-01-01T00:00:00Z",
        "training_days": [
          {
            "id": "uuid",
            "name": "Day 1",
            "description": "Optional description",
            "order_index": 1,
            "exercises": [
              {
                "id": "uuid",
                "exercise_id": "uuid",
                "order_index": 1
              },
              {
                "id": "uuid",
                "exercise_id": "uuid",
                "order_index": 2
              }
            ]
          },
          {
            "id": "uuid",
            "name": "Day 2",
            "description": "Optional description",
            "order_index": 2,
            "exercises": [
              {
                "id": "uuid",
                "exercise_id": "uuid",
                "order_index": 1
              },
              {
                "id": "uuid",
                "exercise_id": "uuid",
                "order_index": 2
              }]
          }
        ]
      },
      "resource_links": [
        {
          "title": "Resource Title",
          "url": "https://example.com"
        }
      ]
    }
    ```
  - Success: 200 OK

> All endpoints will support common query parameters for list endpoints such as `limit`, `offset` (or `page`), and `sort` where applicable.

## 3. Authentication and Authorization

All endpoints require that the client is authenticated. This means all data is visible only when the user is signed in, and unauthenticated requests will be rejected.

- **Authentication**: The API will use JWT-based authentication with tokens issued by Supabase Auth. Clients must include the token in the `Authorization: Bearer <token>` header for all endpoints.

- **Authorization**: Role-based access is enforced using Row-Level Security (RLS) at the database level. Endpoints are protected such that users can only access and modify their own data. Certain administrative endpoints (e.g., creating new exercises) may require elevated privileges.

## 4. Validation and Business Logic

- **Input Validation**: Each endpoint will validate the incoming payloads against the database constraints. For example:
  - `expected_reps`, `expected_weight`, and `actual_reps`, `actual_weight` must be greater than 0.
  - `order_index`, `set_index`, and other numeric fields are validated to ensure uniqueness and proper sequencing.

- **Business Logic**:
  - **Automated Weight Progression**: Upon successful completion of all sets in a training session, the system will update the corresponding training plan exercise progression by increasing the weight by the defined `weight_increment`. If a user records three consecutive failures on an exercise, a 10% deload is automatically applied (using the `deload_percentage` and `deload_strategy`).
  - **Active Session Tracking**: As users mark sets as completed (via the PATCH endpoints), the session and related metrics are updated in real-time.
  - **Reordering**: Endpoints that modify the order of days or exercises (using PATCH requests) allow users to customize the flow of their training plan.
  - **AI Integration**: The `/ai/training-suggestions` endpoint wraps the external AI service to provide tailored training suggestions and embed links to educational resources.

- **Error Handling**: The API will return appropriate HTTP status codes and error messages:
  - 400 Bad Request for validation errors.
  - 401 Unauthorized when authentication fails.
  - 403 Forbidden for access violations.
  - 404 Not Found when resources do not exist.
  - 500 Internal Server Error for unexpected issues.
