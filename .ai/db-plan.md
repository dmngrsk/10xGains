# PostgreSQL Database Schema for 10xGains

## 1. Tables

### 1.1. profiles
- id: UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
- first_name: VARCHAR(255) NOT NULL
- active_plan_id: UUID NULL REFERENCES plans(id)
- ai_suggestions_remaining: INTEGER NOT NULL DEFAULT 0 CHECK (ai_suggestions_remaining >= 0)
- created_at: TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
- updated_at: TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP

### 1.2. plans
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id: UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- name: VARCHAR(255) NOT NULL
- description: TEXT
- created_at: TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP

### 1.3. exercises
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- name: VARCHAR(255) NOT NULL
- description: TEXT

### 1.4. plan_days
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- plan_id: UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE
- name: VARCHAR(255) NOT NULL
- description: TEXT
- order_index: SMALLINT NOT NULL  -- Specifies the order of days in the plan
- UNIQUE(plan_id, order_index)

### 1.5. plan_exercises
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- plan_day_id: UUID NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE
- exercise_id: UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE
- order_index: SMALLINT NOT NULL  -- Specifies the order of exercises in the day
- UNIQUE(plan_day_id, order_index)

### 1.6. plan_exercise_sets
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- plan_exercise_id: UUID NOT NULL REFERENCES plan_exercises(id) ON DELETE CASCADE
- set_index: SMALLINT NOT NULL  -- Specifies the order of sets within an exercise
- expected_reps: SMALLINT NOT NULL CHECK (expected_reps >= 0)
- expected_weight: NUMERIC(7,3) NOT NULL CHECK (expected_weight >= 0)
- UNIQUE(plan_exercise_id, set_index)

### 1.7. plan_exercise_progressions
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- plan_id: UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE
- exercise_id: UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE
- weight_increment: NUMERIC(7,3) NOT NULL CHECK (weight_increment >= 0)
- failure_count_for_deload: SMALLINT NOT NULL DEFAULT 3 CHECK (failure_count_for_deload > 0)
- deload_percentage: NUMERIC(4,2) NOT NULL DEFAULT 10.00 CHECK (deload_percentage >= 0)
- deload_strategy: VARCHAR(20) NOT NULL DEFAULT 'PROPORTIONAL' CHECK (deload_strategy IN ('PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM'))
- reference_set_index: SMALLINT NULL
- consecutive_failures: SMALLINT NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0)
- last_updated: TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
- UNIQUE(plan_id, exercise_id)

### 1.8. sessions
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id: UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- plan_id: UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE
- plan_day_id: UUID REFERENCES plan_days(id)
- session_date: TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
- status: VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))

### 1.9. session_sets
- id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- session_id: UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
- plan_exercise_id: UUID NOT NULL REFERENCES plan_exercises(id) ON DELETE CASCADE
- set_index: SMALLINT NOT NULL
- actual_weight: NUMERIC(7,3) NOT NULL CHECK (actual_weight >= 0)
- actual_reps: SMALLINT NOT NULL CHECK (actual_reps >= 0)
- status: VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'SKIPPED'))
- completed_at: TIMESTAMP WITHOUT TIME ZONE NULL

## 2. Relationships Between Tables

- User authentication is managed by Supabase Auth (`auth.users`)
- Each user (`auth.users`) has one profile (`profiles`) with additional profile data
- Each user (`auth.users`) can have many plans (`plans`), and each plan belongs to a single user
- Each plan (`plans`) contains multiple days (`plan_days`), each with a specific order
- Each day (`plan_days`) contains multiple entries in the junction table `plan_exercises`, which defines the exercises and their order
- Each entry in `plan_exercises` refers to a single exercise in the `exercises` table
- Each exercise in a plan (`plan_exercises`) has multiple sets defined in `plan_exercise_sets` with individual weights and rep counts
- Each exercise in a plan has progression rules defined in `plan_exercise_progressions` (one progression per exercise per plan)
- Each plan (`plans`) can be used in many sessions (`sessions`), with each session assigned to a specific user and day
- Each session (`sessions`) contains multiple sets recorded in the `session_sets` table for the respective exercises included in the plan
- Each set in `session_sets` refers to an entry in `plan_exercises` and records the actual performance

## 3. Indexes

- Index on `profiles(id)` for fast user lookup
- Index on `plans(user_id)` to optimize queries related to user plans
- Index on `plan_days(plan_id)` for efficient lookup of days in a plan
- Index on `plan_exercises(plan_day_id)` and a unique index on `(plan_day_id, order_index)` to ensure unique exercise order in a day
- Index on `plan_exercise_sets(plan_exercise_id)` for efficient set lookup
- Index on `plan_exercise_progressions(plan_id, exercise_id)` for efficient progression lookup
- Index on `sessions(user_id, session_date)` for efficient queries of a user's sessions
- Index on `session_sets(session_id)` for optimized lookup of sets for a given session

## 4. PostgreSQL and RLS Policies

- Row-Level Security (RLS) is enabled on all tables containing user data
- All tables have appropriate RLS policies to restrict access based on user identity
- Example RLS policy:
  ```sql
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "profiles_authenticated_select" ON profiles
      FOR SELECT TO authenticated
      USING (id = auth.uid());
  ```

## 5. Additional Notes

- Authentication is managed by Supabase's auth schema
- The schema has been designed in accordance with the PRD requirements and the decisions made during the planning session
- The chosen data types (NUMERIC(7,3) for weights and SMALLINT for sets and reps) ensure precise data storage
- All NOT NULL constraints, CHECK conditions, and foreign key relationships have been applied to ensure data integrity and to support RLS mechanisms in the system
