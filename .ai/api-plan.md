# REST API Plan

## 1. Resources

- **User Profiles**: Corresponds to the `user_profiles` table. This resource holds additional user data (e.g., first name, active training plan ID) and is linked to Supabase authentication.

- **Exercises**: Corresponds to the `exercises` table. This resource includes predefined exercises (name and description) available for users to include in their plans.

- **Training Plans**: Represents the `training_plans` table. It contains the plan name, associated user, and creation timestamp.

- **Training Plan Days**: Maps to the `training_plan_days` table. These are the individual days within a training plan, each having a name, description, and order index.

- **Training Plan Exercises**: Based on the `training_plan_exercises` table, this resource links a training day with an exercise and preserves the order of exercises.

- **Training Plan Exercise Sets**: Relates to the `training_plan_exercise_sets` table. Each set includes an expected number of reps and the expected weight to be lifted for a given exercise.

- **Training Plan Exercise Progressions**: Maps to the `training_plan_exercise_progressions` table. It defines the progression rules for each exercise within a training plan (e.g., weight increment, failure thresholds, deload strategy).

- **Training Sessions**: Corresponds to the `training_sessions` table. These resources track individual workout sessions including session date, status, and the associated training plan/day.

- **Session Sets**: Based on the `session_sets` table, this resource records the actual performance data for each set within a training session (actual weight, actual reps, status, and completion time).

## 2. Endpoints

> **Note:** Except for global resources, all endpoints operate on data exclusively associated with the currently authenticated user. Queries are automatically filtered using the user's ID (via Row-Level Security in the database). Any attempt to access data that does not belong to the authenticated user will be rejected with a 404 Not Found error.

For each resource, standard CRUD endpoints are defined along with endpoints catering to specific business logic. Endpoints will support pagination, filtering, and sorting where applicable.

### User Profiles

- **GET /user-profiles/{id}**
  - Description: Retrieve the authenticated user's profile. The provided `{id}` must match the authenticated user's ID.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "first_name": "John",
      "active_training_plan_id": "uuid",
      "ai_suggestions_remaining": 0,
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 403 Forbidden

- **PUT /user-profiles/{id}**
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
      "ai_suggestions_remaining": 0,
      "updated_at": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden

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
        "created_at": "2023-01-01T00:00:00Z",
        "days": [
          {
            "id": "uuid",
            "name": "Day 1",
            "description": "Optional description",
            "order_index": 1,
            "exercises": [
              {
                "id": "uuid",
                "exercise_id": "uuid",
                "order_index": 1,
                "sets": [
                  {
                    "id": "uuid",
                    "set_index": 1,
                    "expected_reps": 5,
                    "expected_weight": 20,
                    "training_plan_exercise_id": "uuid"
                  },
                  {
                    "id": "uuid",
                    "set_index": 2,
                    "expected_reps": 5,
                    "expected_weight": 20,
                    "training_plan_exercise_id": "uuid"
                  },
                ]
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
      },
      {
        "id": "uuid",
        "name": "Plan Name 2",
        "description": "Optional description",
        "user_id": "uuid",
        "created_at": "2023-01-01T00:00:00Z",
        "days": []
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
      "days": [
        {
          "id": "uuid",
          "name": "Day 1",
          "description": "Optional description",
          "order_index": 1,
          "exercises": [
            {
              "id": "uuid",
              "exercise_id": "uuid",
              "order_index": 1,
              "sets": [
                {
                  "id": "uuid",
                  "set_index": 1,
                  "expected_reps": 5,
                  "expected_weight": 20,
                  "training_plan_exercise_id": "uuid"
                },
                {
                  "id": "uuid",
                  "set_index": 2,
                  "expected_reps": 5,
                  "expected_weight": 20,
                  "training_plan_exercise_id": "uuid"
                },
              ]
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

- **POST /training-plans/{planId}/suggest**
  - Description: Provide AI-generated suggestions to modify an existing training plan (`{planId}`) belonging to the authenticated user. The suggestions are based on a user query. This endpoint can propose training exercises using existing global exercises or creating new ones (which are then added to the global `exercises` table). The response will indicate which parts of the plan were modified or newly suggested by the AI, using the original `TrainingPlanDto` model expanded with an additional `is_ai_modified` property whenever applicable. As a side-effect, this method also decrements the value of `user_profiles.ai_suggestions_remaining` by 1, and does not allow AI suggestions when that value is not positive (403 Forbidden).
  - Request Body:
    ```json
    {
      "query": "I want to focus more on strength for this plan, add some plyometrics."
    }
    ```
  - Example Response:
    ```json
    {
      "ai_message": "Based on your query to focus more on strength and add plyometrics to your current plan, here are some suggested modifications and new exercises.",
      "ai_plan_modified": true, // Flag indicating whether the plan was modified; if false, the value of the suggested_training_plan field is null
      "suggested_training_plan": { 
        "id": "uuid", // {planId}
        "name": "Plan Name (Strength & Plyo Focused)", 
        "description": "Updated description reflecting new focus on strength and plyometrics.",
        "user_id": "uuid",
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-10T10:00:00Z", // Reflects AI modification time
        "is_ai_modified": true, // Flag indicating the plan object itself was modified
        "days": [
          {
            "id": "day1_uuid_existing", 
            "name": "Day 1 - Lower Body Strength & Plyo",
            "description": "Focused on squats, deadlifts, and new plyometric exercises.",
            "order_index": 1,
            "is_ai_modified": true, // This day was modified
            "exercises": [
              {
                "id": "day1_ex1_uuid_existing",
                "exercise_id": "global_squat_uuid", // Existing exercise
                "order_index": 1,
                // No is_ai_modified flag here means this exercise linkage was kept as is,
                // but its sets might be modified.
                "sets": [
                  { 
                    "id": "day1_ex1_set1_uuid_existing", 
                    "set_index": 1, 
                    "expected_reps": 5, 
                    "expected_weight": 105, // Weight increased by AI
                    "is_ai_modified": true // This set was modified
                  },
                  { 
                    "id": "day1_ex1_set2_uuid_new_by_ai", // New set added by AI
                    "set_index": 2, 
                    "expected_reps": 8, 
                    "expected_weight": 70,
                    "is_ai_modified": true // This new set is an AI modification
                  }
                ]
              },
              {
                "id": "day1_ex2_uuid_new_by_ai", // New training plan exercise entry
                "exercise_id": "new_global_box_jump_uuid", // Assumes AI created Box Jump in global 'exercises' table
                "order_index": 2,
                "is_ai_modified": true, // This new exercise entry is an AI modification
                "sets": [
                  { 
                    "id": "day1_ex2_set1_uuid_new_by_ai", 
                    "set_index": 1, 
                    "expected_reps": 10, 
                    "expected_weight": 0, // Bodyweight
                    "is_ai_modified": true
                  }
                ]
              }
            ]
          },
          {
            "id": "day2_uuid_existing",
            "name": "Day 2 - Unchanged Upper Body",
            "description": "Original upper body day.",
            "order_index": 2,
            "is_ai_modified": false, // Flag indicating the plan object itself was NOT modified
            "exercises": [ /* ... original exercises and sets, with an additional 'is_ai_modified' flag set to false ... */ ]
          }
        ]
      }
    }
    ```
  - Success: 200 OK
  - Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found (`{planId}`).

- **POST /training-plans/{planId}/composite**
  - Description: Performs a composite update of an entire training plan (`{planId}`) belonging to the authenticated user. This includes its nested days, exercises, and sets. The server will determine whether to create, update, or delete these nested entities based on the provided payload compared to the current state of the plan.
  - Request Body: A `TrainingPlanDto`-like structure. IDs for existing entities should be provided; new entities may omit IDs (server generates).
    ```json
    {
      "name": "Completely Overhauled Plan",
      "description": "New comprehensive description.",
      "days": [
        {
          "id": "day1_uuid_existing_or_new", // If existing, server updates. If new/omitted, server creates.
          "name": "New Day 1 Name",
          "description": "...",
          "order_index": 0,
          "exercises": [
            {
              "id": "day1_ex1_uuid_existing_or_new",
              "exercise_id": "global_exercise_uuid_1", // Refers to an exercise in the global 'exercises' table
              "order_index": 0,
              "sets": [
                {
                  "id": "day1_ex1_set1_uuid_existing_or_new",
                  "set_index": 0,
                  "expected_reps": 5,
                  "expected_weight": 100
                }
                // ... other sets for this exercise
              ]
            }
            // ... other exercises for this day
          ]
        }
        // ... other days for this plan
        // IMPORTANT: Days/exercises/sets NOT included in the payload but existing in DB for this plan will be DELETED.
      ]
    }
    ```
  - Example Response: The fully updated `TrainingPlanDto` reflecting all changes.
    ```json
    {
      "id": "uuid", // {planId}
      "name": "Completely Overhauled Plan",
      "description": "New comprehensive description.",
      "user_id": "uuid",
      "updated_at": "YYYY-MM-DDTHH:mm:ssZ",
      "days": [ /* ... resulting structure of days, exercises, sets ... */ ]
    }
    ```
  - Success: 200 OK
  - Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found (`{planId}` or referenced `exercise_id`).
  - Business Logic: Complex. Involves diffing the provided structure with the existing one. Handles CUD for plan itself, days, exercises, and sets. Manages `order_index` and `set_index` based on array order in payload. This should ideally be a transactional operation.

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
            "order_index": 1,
            "sets": [
              {
                "id": "uuid",
                "set_index": 1,
                "expected_reps": 5,
                "expected_weight": 20,
                "training_plan_exercise_id": "uuid"
              },
              {
                "id": "uuid",
                "set_index": 2,
                "expected_reps": 5,
                "expected_weight": 20,
                "training_plan_exercise_id": "uuid"
              },
            ]
          },
          {
            "id": "uuid",
            "exercise_id": "uuid",
            "order_index": 2,
            "sets": []
          }
        ]
      }
    ]
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 403 Forbidden

- **POST /training-plans/{planId}/days**
  - Description: Create a new day for the authenticated user's training plan. The server automatically manages `order_index` – appends if not provided by the client, or inserts at the specified `order_index` and shifts subsequent days accordingly.
  - Request Body:
    ```json
    {
      "name": "Day Name",
      "description": "Optional description"
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
      "training_plan_id": "uuid",
      "exercises": [
        {
          "id": "uuid",
          "exercise_id": "uuid",
          "order_index": 1,
          "sets": [
            {
              "id": "uuid",
              "set_index": 1,
              "expected_reps": 5,
              "expected_weight": 20,
              "training_plan_exercise_id": "uuid"
            },
            {
              "id": "uuid",
              "set_index": 2,
              "expected_reps": 5,
              "expected_weight": 20,
              "training_plan_exercise_id": "uuid"
            },
          ]
        },
        {
          "id": "uuid",
          "exercise_id": "uuid",
          "order_index": 2,
          "sets": []
        }
      ]
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PUT /training-plans/{planId}/days/{dayId}**
  - Description: Update a day for a training plan belonging to the authenticated user. If `order_index` is changed, other days in the plan will be re-indexed automatically by the server.
  - Request Body:
    ```json
    {
      "name": "Updated Day Name",
      "description": "Updated description"
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
  - Description: Delete a day within a training plan owned by the authenticated user. Subsequent days in the plan will be re-indexed automatically by the server.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 404 Not Found

### Training Plan Exercises

- **GET /training-plans/{planId}/days/{dayId}/exercises**
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

- **POST /training-plans/{planId}/days/{dayId}/exercises**
  - Description: Add an exercise to a training day owned by the authenticated user. The server automatically manages `order_index` – appends if not provided by the client, or inserts at the specified `order_index` and shifts subsequent exercises accordingly.
  - Request Body:
    ```json
    {
      "exercise_id": "uuid"
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

- **GET /training-plans/{planId}/days/{dayId}/exercises/{exerciseId}**
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

- **PUT /training-plans/{planId}/days/{dayId}/exercises/{exerciseId}**
  - Description: Update a training plan exercise (e.g., change order) for a day owned by the authenticated user. If `order_index` is changed, other exercises in the day will be re-indexed automatically by the server.
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

- **DELETE /training-plans/{planId}/days/{dayId}/exercises/{exerciseId}**
  - Description: Remove an exercise from a training day owned by the authenticated user. Subsequent exercises in the day will be re-indexed automatically by the server.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 404 Not Found

### Training Plan Exercise Sets

- **GET /training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets**
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

- **POST /training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets**
  - Description: Create a set for an exercise in a training plan belonging to the authenticated user. The server automatically manages `set_index` – appends if not provided by the client, or inserts at the specified `set_index` and shifts subsequent sets accordingly.
  - Request Body:
    ```json
    {
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

- **GET /training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}**
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

- **PUT /training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}**
  - Description: Update a set for an exercise in a training plan belonging to the authenticated user. If `set_index` is changed, other sets for this exercise will be re-indexed automatically by the server.
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

- **DELETE /training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}**
  - Description: Delete a set for an exercise in a training plan owned by the authenticated user. Subsequent sets for this exercise will be re-indexed automatically by the server.
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
      "consecutive_failures": 0,
      "last_updated": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PUT /training-plans/{planId}/exercises/{exerciseId}/progression**
  - Description: Update progression details (e.g., `consecutive_failures`) for an exercise in a training plan belonging to the authenticated user.
  - Request Body:
    ```json
    {
      "weight_increment": 2.5,
      "failure_count_for_deload": 3
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
      "consecutive_failures": 0,
      "last_updated": "2023-01-01T00:00:00Z"
    }
    ```
  - Business Logic: Apply automated weight increment on success or a 10% deload after three consecutive failures.
  - Success: 200 OK, 201 Created
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
        "status": "PENDING",
        "sets": [
        {
          "id": "uuid",
          "training_plan_exercise_id": "uuid1", 
          "set_index": 1,
          "actual_weight": 5,
          "actual_reps": 102.5,
          "status": "PENDING"
        },
        {
          "id": "uuid",
          "training_plan_exercise_id": "uuid2",
          "set_index": 1,
          "actual_weight": 8,
          "actual_reps": 60,
          "status": "PENDING"
        }
      }
    ]
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 403 Forbidden

- **POST /training-sessions**
  - Description: Create a new training session for a given training plan and a specific day for the authenticated user. This endpoint also automatically generates the initial `session_set` entities for the session, based on the exercises and sets defined in the referenced `training_plan_day_id`. Any applicable progression logic (e.g., weight increases) will be applied to determine the initial `expected_weight` for these session sets. The newly created session, along with its pre-generated sets, is returned in the response.
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
      "session_date": "2023-10-27T10:00:00Z",
      "status": "PENDING",
      "sets": [
        {
          "id": "uuid",
          "training_plan_exercise_id": "uuid1", 
          "set_index": 1,
          "actual_weight": 5,
          "actual_reps": 102.5,
          "status": "PENDING"
        },
        // ...
        {
          "id": "uuid",
          "training_plan_exercise_id": "uuid2",
          "set_index": 1,
          "actual_weight": 8,
          "actual_reps": 60,
          "status": "PENDING"
        },
        // ...
      ]
    }
    ```
  - Success: 201 Created
  - Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found

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
      "status": "PENDING",
      "sets": [
      {
        "id": "uuid",
        "training_plan_exercise_id": "uuid1", 
        "set_index": 1,
        "actual_weight": 5,
        "actual_reps": 102.5,
        "status": "PENDING"
      },
      {
        "id": "uuid",
        "training_plan_exercise_id": "uuid2",
        "set_index": 1,
        "actual_weight": 8,
        "actual_reps": 60,
        "status": "PENDING"
      }
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
      "training_plan_id": "uuid",
      "training_plan_day_id": "uuid",
      "user_id": "uuid",
      "session_date": "2023-01-01T00:00:00Z",
      "status": "CANCELLED"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **DELETE /training-sessions/{sessionId}**
  - Description: Delete (or cancel) a training session belonging to the authenticated user.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 404 Not Found

- **POST /training-sessions/{sessionId}/complete**
  - Description: Mark a session as COMPLETED, triggering business logic for updating exercise progressions for the involved exercises, for a session belonging to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "training_plan_id": "uuid",
      "training_plan_day_id": "uuid",
      "user_id": "uuid",
      "session_date": "2023-01-01T19:16:42Z", // Updated with the current timestamp 
      "status": "COMPLETED"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found
  - Business Logic: Marking a training session as complete (via `POST /training-sessions/{sessionId}/complete`) will trigger an update to the corresponding `training_plan_exercise_progression` for each exercise in that session. This involves increasing the weight by the defined `weight_increment` if the exercise was completed successfully, or applying deload logic (e.g., 10% deload after three consecutive failures based on `deload_percentage` and `deload_strategy`). The weight changes will be applied to the `training_plan_exercise_sets` entities related to the session's training plan.

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

- **DELETE /training-sessions/{sessionId}/sets/{setId}**
  - Description: Delete a session set belonging to the authenticated user. Subsequent sets for this exercise and session will be re-indexed automatically by the server.
  - Success: 204 No Content
  - Errors: 401 Unauthorized, 404 Not Found
  
- **PATCH /training-sessions/{sessionId}/sets/{setId}/complete**
  - Description: Mark a session set as completed and record the completion timestamp for a session belonging to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "status": "COMPLETED",
      "actual_reps": 5,
      "completed_at": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

- **PATCH /training-sessions/{sessionId}/sets/{setId}/fail**
  - Description: Mark a session set as FAILED, record the completion timestamp, and update the `actual_reps` performed for a session belonging to the authenticated user.
  - Query Parameters:
    - `reps` (integer, optional): The number of repetitions actually performed for this failed set. Must be a non-negative integer. Defaults to 0 if not provided.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "status": "FAILED",
      "actual_reps": 0,
      "completed_at": "2023-01-01T00:00:00Z"
    }
    ```
  - Success: 200 OK
  - Errors: 400 Bad Request, 401 Unauthorized, 404 Not Found
  - Validation: Ensure `reps` query parameter, if provided, is a non-negative integer.
  
- **PATCH /training-sessions/{sessionId}/sets/{setId}/reset**
  - Description: Mark a session set as pending and clear the completion timestamp for a session belonging to the authenticated user.
  - Example Response:
    ```json
    {
      "id": "uuid",
      "status": "PENDING",
      "actual_reps": 5,
      "completed_at": null
    }
    ```
  - Success: 200 OK
  - Errors: 401 Unauthorized, 404 Not Found

## 3. Authentication and Authorization

All endpoints require that the client is authenticated. This means all data is visible only when the user is signed in, and unauthenticated requests will be rejected.

- **Authentication**: The API will use JWT-based authentication with tokens issued by Supabase Auth. Clients must include the token in the `Authorization: Bearer <token>` header for all endpoints.

- **Authorization**: Role-based access is enforced using Row-Level Security (RLS) at the database level. Endpoints are protected such that users can only access and modify their own data. Certain administrative endpoints (e.g., creating new exercises) may require elevated privileges.

## 4. Validation and Business Logic

- **Input Validation**: Each endpoint will validate the incoming payloads against the database constraints. For example:
  - `expected_reps`, `expected_weight`, and `actual_reps`, `actual_weight` must be greater than 0.
  - `order_index`, `set_index`, and other numeric fields are validated to ensure uniqueness and proper sequencing.

- **Business Logic**:
  - **Reordering**: For list-based entities like `Training Plan Days` (within a plan), `Training Plan Exercises` (within a day), and `Training Plan Exercise Sets` (within an exercise), the API will automatically manage the `order_index` (or `set_index` for sets) to ensure a dense, sequential order.
    - On **creation (POST)**, if an `order_index` is provided, the item will be inserted at that position, and subsequent items in the same list will have their `order_index` incremented. If no `order_index` is provided, the item will be appended to the end of the list.
    - On **update (PUT)** where an item's `order_index` is changed, the API will adjust the `order_index` of other items in the list to maintain sequence.
    - On **deletion (DELETE)**, the `order_index` of subsequent items in the same list will be decremented to close any gaps.
    This simplifies client-side logic and maintains data integrity.
  - **Automated Weight Progression**: Marking a training session as complete (via `POST /training-sessions/{sessionId}/complete`) will trigger an update to the corresponding `training_plan_exercise_progression` for each exercise in that session. This involves increasing the weight by the defined `weight_increment` if the exercise was completed successfully, or applying deload logic (e.g., 10% deload after three consecutive failures based on `deload_percentage` and `deload_strategy`).
  - **Active Session Tracking**: As users mark sets as completed or failed (via the PATCH session set endpoints), the session's overall status and related metrics are updated in real-time.
  - **AI Integration**: The `/training-plans/{planId}/suggest` endpoint wraps the external AI service to provide tailored training suggestions.

- **Error Handling**: The API will return appropriate HTTP status codes and error messages:
  - 400 Bad Request for validation errors.
  - 401 Unauthorized when authentication fails.
  - 403 Forbidden for access violations.
  - 404 Not Found when resources do not exist.
  - 500 Internal Server Error for unexpected issues.
