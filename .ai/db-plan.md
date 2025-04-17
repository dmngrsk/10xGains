# PostgreSQL Database Schema for 10xGains

## 1. Tables

### 1.1. users
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- login: VARCHAR(255) NOT NULL UNIQUE
- display_name: VARCHAR(255) NOT NULL
- password_hash: TEXT NOT NULL
- active_training_plan_id: UUID NULL REFERENCES training_plans(id)

### 1.2. training_plans
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- name: VARCHAR(255) NOT NULL
- created_at: TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP

### 1.3. exercises
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- name: VARCHAR(255) NOT NULL
- description: TEXT

### 1.4. training_plan_days
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- training_plan_id: UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE
- name: VARCHAR(255) NOT NULL
- description: TEXT
- order_index: SMALLINT NOT NULL  -- Specifies the order of days in the training plan
- UNIQUE(training_plan_id, order_index)

### 1.5. training_plan_exercises
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- training_plan_day_id: UUID NOT NULL REFERENCES training_plan_days(id) ON DELETE CASCADE
- exercise_id: UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE
- order_index: SMALLINT NOT NULL  -- Specifies the order of exercises in the training day
- UNIQUE(training_plan_day_id, order_index)

### 1.6. training_plan_exercise_sets
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- training_plan_exercise_id: UUID NOT NULL REFERENCES training_plan_exercises(id) ON DELETE CASCADE
- set_index: SMALLINT NOT NULL  -- Specifies the order of sets within an exercise
- expected_reps: SMALLINT NOT NULL CHECK (expected_reps > 0)
- expected_weight: NUMERIC(7,3) NOT NULL CHECK (expected_weight > 0)
- UNIQUE(training_plan_exercise_id, set_index)

### 1.7. training_plan_exercise_progressions
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- training_plan_id: UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE
- exercise_id: UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE
- weight_increment: NUMERIC(7,3) NOT NULL CHECK (weight_increment > 0)
- failure_count_for_deload: SMALLINT NOT NULL DEFAULT 3 CHECK (failure_count_for_deload > 0)
- deload_percentage: NUMERIC(4,2) NOT NULL DEFAULT 10.00 CHECK (deload_percentage > 0)
- deload_strategy: VARCHAR(20) NOT NULL DEFAULT 'PROPORTIONAL' CHECK (deload_strategy IN ('PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM'))
- reference_set_index: SMALLINT NULL
- current_weight: NUMERIC(7,3) NOT NULL CHECK (current_weight > 0)
- consecutive_failures: SMALLINT NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0)
- last_updated: TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
- UNIQUE(training_plan_id, exercise_id)

### 1.8. training_sessions
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- training_plan_id: UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE
- training_plan_day_id: UUID REFERENCES training_plan_days(id)
- session_date: TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
- status: VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED'))

### 1.9. session_series
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- training_session_id: UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE
- training_plan_exercise_id: UUID NOT NULL REFERENCES training_plan_exercises(id) ON DELETE CASCADE
- set_index: SMALLINT NOT NULL
- actual_weight: NUMERIC(7,3) NOT NULL CHECK (actual_weight > 0)
- actual_reps: SMALLINT NOT NULL CHECK (actual_reps > 0)
- status: VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'SKIPPED'))
- completed_at: TIMESTAMP WITHOUT TIME ZONE NULL

## 2. Relationships Between Tables

- Each user (`users`) can have many training plans (`training_plans`), and each plan belongs to a single user.
- Each training plan (`training_plans`) contains multiple training days (`training_plan_days`), each with a specific order.
- Each training day (`training_plan_days`) contains multiple entries in the junction table `training_plan_exercises`, which defines the exercises and their order.
- Each entry in `training_plan_exercises` refers to a single exercise in the `exercises` table.
- Each exercise in a training plan (`training_plan_exercises`) has multiple sets defined in `training_plan_exercise_sets` with individual weights and rep counts.
- Each exercise in a training plan has progression rules defined in `training_plan_exercise_progressions` (one progression per exercise per training plan).
- Each training plan (`training_plans`) can be used in many training sessions (`training_sessions`), with each session assigned to a specific user and training day.
- Each training session (`training_sessions`) contains multiple sets recorded in the `session_series` table for the respective exercises included in the plan.
- Each set in `session_series` refers to an entry in `training_plan_exercises` and records the actual performance.

## 3. Indexes

- Index on `users(login)` for fast user lookup.
- Index on `training_plans(user_id)` to optimize queries related to user plans.
- Index on `training_plan_days(training_plan_id)` for efficient lookup of days in a plan.
- Index on `training_plan_exercises(training_plan_day_id)` and a unique index on `(training_plan_day_id, order_index)` to ensure unique exercise order in a day.
- Index on `training_plan_exercise_sets(training_plan_exercise_id)` for efficient set lookup.
- Index on `training_plan_exercise_progressions(training_plan_id, exercise_id)` for efficient progression lookup.
- Index on `training_sessions(user_id, session_date)` for efficient queries of a user's training sessions.
- Index on `session_series(training_session_id)` for optimized lookup of sets for a given session.

## 4. PostgreSQL and RLS Policies

- Row-Level Security (RLS) should be configured for tables containing user data, such as `training_plans`, `training_plan_days`, `training_sessions`, and `session_series`. RLS policies should restrict data access based on `user_id`, ensuring that users can only access their own data.
- Example RLS policy (to be implemented separately):
  ```sql
  ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY user_training_sessions ON training_sessions
      USING (user_id = auth.uid());
  ```

## 5. Additional Notes

- The schema has been designed in accordance with the PRD requirements and the decisions made during the planning session.
- The chosen data types (NUMERIC(7,3) for weights and SMALLINT for sets and reps) ensure precise data storage.
- All NOT NULL constraints, CHECK conditions, and foreign key relationships have been applied to ensure data integrity and to support RLS mechanisms in the system. 
