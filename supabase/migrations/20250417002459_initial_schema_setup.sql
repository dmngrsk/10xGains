-- Migration: Initial 10xGains Schema Setup
-- Description: Creates the core tables for the fitness tracking application
-- Author: AI Assistant
-- Created: 2025-04-17

-- -----------------------------------------------------
-- Table users
-- -----------------------------------------------------
create table "public"."users" (
    id uuid primary key default gen_random_uuid(),
    login varchar(255) not null unique,
    display_name varchar(255) not null,
    password_hash text not null,
    active_training_plan_id uuid null
);

comment on table "public"."users" is 'Stores user account information';

-- Create index for faster login lookup
create index users_login_idx on public.users(login);

-- Enable RLS on users table
alter table "public"."users" enable row level security;

-- RLS Policy for anon role (no access)
create policy "users_anon_no_access" on "public"."users"
    for all to anon
    using (false);

-- RLS Policy for authenticated role
create policy "users_authenticated_select" on "public"."users"
    for select to authenticated
    using (id = auth.uid());

create policy "users_authenticated_update" on "public"."users"
    for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

-- -----------------------------------------------------
-- Table exercises
-- -----------------------------------------------------
create table "public"."exercises" (
    id uuid primary key default gen_random_uuid(),
    name varchar(255) not null,
    metadata jsonb
);

comment on table "public"."exercises" is 'Exercise library with metadata like muscle groups, equipment, etc.';

-- Enable RLS on exercises table
alter table "public"."exercises" enable row level security;

-- Exercises are accessible to all users
-- RLS Policy for anon role
create policy "exercises_anon_select" on "public"."exercises"
    for select to anon
    using (true);

-- RLS Policy for authenticated role
create policy "exercises_authenticated_select" on "public"."exercises"
    for select to authenticated
    using (true);

-- -----------------------------------------------------
-- Table training_plans
-- -----------------------------------------------------
create table "public"."training_plans" (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    name varchar(255) not null,
    created_at timestamp without time zone default current_timestamp,
    foreign key (user_id) references users(id) on delete cascade
);

comment on table "public"."training_plans" is 'Contains workout plans created by users';

-- Fix foreign key reference in users table to training_plans
alter table "public"."users" add constraint users_active_training_plan_fkey
    foreign key (active_training_plan_id) references training_plans(id);

-- Create index for user's plans lookup
create index training_plans_user_id_idx on public.training_plans(user_id);

-- Enable RLS on training_plans table
alter table "public"."training_plans" enable row level security;

-- RLS Policy for anon role (no access)
create policy "training_plans_anon_no_access" on "public"."training_plans"
    for all to anon
    using (false);

-- RLS Policy for authenticated role
create policy "training_plans_authenticated_select" on "public"."training_plans"
    for select to authenticated
    using (user_id = auth.uid());


create policy "training_plans_authenticated_insert" on "public"."training_plans"
    for insert to authenticated
    with check (user_id = auth.uid());

create policy "training_plans_authenticated_update" on "public"."training_plans"
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "training_plans_authenticated_delete" on "public"."training_plans"
    for delete to authenticated
    using (user_id = auth.uid());

-- -----------------------------------------------------
-- Table training_plan_exercises
-- -----------------------------------------------------
create table "public"."training_plan_exercises" (
    id uuid primary key default gen_random_uuid(),
    training_plan_id uuid not null,
    exercise_id uuid not null,
    order_index smallint not null,
    foreign key (training_plan_id) references training_plans(id) on delete cascade,
    foreign key (exercise_id) references exercises(id) on delete cascade,
    unique(training_plan_id, order_index)
);

comment on table "public"."training_plan_exercises" is 'Junction table linking exercises to training plans with ordering';

-- Create index for looking up exercises in a plan
create index training_plan_exercises_plan_id_idx on public.training_plan_exercises(training_plan_id);

-- Enable RLS on training_plan_exercises table
alter table "public"."training_plan_exercises" enable row level security;

-- RLS Policy for anon role (no access)
create policy "training_plan_exercises_anon_no_access" on "public"."training_plan_exercises"
    for all to anon
    using (false);

-- RLS Policy for authenticated role - using a join to check ownership
create policy "training_plan_exercises_authenticated_select" on "public"."training_plan_exercises"
    for select to authenticated
    using (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercises.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercises_authenticated_insert" on "public"."training_plan_exercises"
    for insert to authenticated
    with check (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercises.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercises_authenticated_update" on "public"."training_plan_exercises"
    for update to authenticated
    using (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercises.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercises.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercises_authenticated_delete" on "public"."training_plan_exercises"
    for delete to authenticated
    using (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercises.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------
-- Table training_plan_exercise_sets
-- -----------------------------------------------------
create table "public"."training_plan_exercise_sets" (
    id uuid primary key default gen_random_uuid(),
    training_plan_exercise_id uuid not null,
    set_index smallint not null,
    expected_reps smallint not null check (expected_reps > 0),
    expected_weight numeric(7,3) not null check (expected_weight > 0),
    foreign key (training_plan_exercise_id) references training_plan_exercises(id) on delete cascade,
    unique(training_plan_exercise_id, set_index)
);

comment on table "public"."training_plan_exercise_sets" is 'Defines the individual sets for each exercise in a training plan';

-- Create index for looking up sets for a specific exercise
create index training_plan_exercise_sets_exercise_id_idx on public.training_plan_exercise_sets(training_plan_exercise_id);

-- Enable RLS on training_plan_exercise_sets table
alter table "public"."training_plan_exercise_sets" enable row level security;

-- RLS Policy for anon role (no access)
create policy "training_plan_exercise_sets_anon_no_access" on "public"."training_plan_exercise_sets"
    for all to anon
    using (false);

-- RLS Policy for authenticated role - using nested joins to check ownership
create policy "training_plan_exercise_sets_authenticated_select" on "public"."training_plan_exercise_sets"
    for select to authenticated
    using (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = training_plan_exercise_sets.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercise_sets_authenticated_insert" on "public"."training_plan_exercise_sets"
    for insert to authenticated
    with check (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = training_plan_exercise_sets.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercise_sets_authenticated_update" on "public"."training_plan_exercise_sets"
    for update to authenticated
    using (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = training_plan_exercise_sets.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = training_plan_exercise_sets.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercise_sets_authenticated_delete" on "public"."training_plan_exercise_sets"
    for delete to authenticated
    using (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = training_plan_exercise_sets.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------
-- Table exercise_progression_rules
-- -----------------------------------------------------
create table "public"."exercise_progression_rules" (
    id uuid primary key default gen_random_uuid(),
    training_plan_exercise_id uuid not null unique,
    weight_increment numeric(7,3) not null check (weight_increment > 0),
    failure_count_for_deload smallint not null default 3 check (failure_count_for_deload > 0),
    deload_percentage numeric(4,2) not null default 10.00 check (deload_percentage > 0),
    deload_strategy varchar(20) not null default 'PROPORTIONAL' check (deload_strategy in ('PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM')),
    reference_set_index smallint null,
    foreign key (training_plan_exercise_id) references training_plan_exercises(id) on delete cascade
);

comment on table "public"."exercise_progression_rules" is 'Rules for automatic weight progression and deload for each exercise';

-- Enable RLS on exercise_progression_rules table
alter table "public"."exercise_progression_rules" enable row level security;

-- RLS Policy for anon role (no access)
create policy "exercise_progression_rules_anon_no_access" on "public"."exercise_progression_rules"
    for all to anon
    using (false);

-- RLS Policy for authenticated role - using nested joins to check ownership
create policy "exercise_progression_rules_authenticated_select" on "public"."exercise_progression_rules"
    for select to authenticated
    using (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = exercise_progression_rules.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "exercise_progression_rules_authenticated_insert" on "public"."exercise_progression_rules"
    for insert to authenticated
    with check (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = exercise_progression_rules.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "exercise_progression_rules_authenticated_update" on "public"."exercise_progression_rules"
    for update to authenticated
    using (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = exercise_progression_rules.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = exercise_progression_rules.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "exercise_progression_rules_authenticated_delete" on "public"."exercise_progression_rules"
    for delete to authenticated
    using (
        exists (
            select 1 from training_plan_exercises
            join training_plans on training_plan_exercises.training_plan_id = training_plans.id
            where training_plan_exercises.id = exercise_progression_rules.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------
-- Table training_sessions
-- -----------------------------------------------------
create table "public"."training_sessions" (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    training_plan_id uuid not null,
    session_date timestamp without time zone not null default current_timestamp,
    status varchar(20) not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    foreign key (user_id) references users(id) on delete cascade,
    foreign key (training_plan_id) references training_plans(id) on delete cascade
);

comment on table "public"."training_sessions" is 'Records individual workout sessions performed by users';

-- Create index for looking up a user's training sessions by date
create index training_sessions_user_id_date_idx on public.training_sessions(user_id, session_date);

-- Enable RLS on training_sessions table
alter table "public"."training_sessions" enable row level security;

-- RLS Policy for anon role (no access)
create policy "training_sessions_anon_no_access" on "public"."training_sessions"
    for all to anon
    using (false);

-- RLS Policy for authenticated role
create policy "training_sessions_authenticated_select" on "public"."training_sessions"
    for select to authenticated
    using (user_id = auth.uid());

create policy "training_sessions_authenticated_insert" on "public"."training_sessions"
    for insert to authenticated
    with check (user_id = auth.uid());

create policy "training_sessions_authenticated_update" on "public"."training_sessions"
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "training_sessions_authenticated_delete" on "public"."training_sessions"
    for delete to authenticated
    using (user_id = auth.uid());

-- -----------------------------------------------------
-- Table session_series
-- -----------------------------------------------------
create table "public"."session_series" (
    id uuid primary key default gen_random_uuid(),
    training_session_id uuid not null,
    training_plan_exercise_id uuid not null,
    set_index smallint not null,
    actual_weight numeric(7,3) not null check (actual_weight > 0),
    actual_reps smallint not null check (actual_reps > 0),
    status varchar(20) not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'FAILED', 'SKIPPED')),
    completed_at timestamp without time zone null,
    foreign key (training_session_id) references training_sessions(id) on delete cascade,
    foreign key (training_plan_exercise_id) references training_plan_exercises(id) on delete cascade
);

comment on table "public"."session_series" is 'Records the actual performance of each set during a training session';

-- Create index for looking up sets in a session
create index session_series_session_id_idx on public.session_series(training_session_id);

-- Enable RLS on session_series table
alter table "public"."session_series" enable row level security;

-- RLS Policy for anon role (no access)
create policy "session_series_anon_no_access" on "public"."session_series"
    for all to anon
    using (false);

-- RLS Policy for authenticated role - using a join to check ownership
create policy "session_series_authenticated_select" on "public"."session_series"
    for select to authenticated
    using (
        exists (
            select 1 from training_sessions
            where training_sessions.id = session_series.training_session_id
            and training_sessions.user_id = auth.uid()
        )
    );

create policy "session_series_authenticated_insert" on "public"."session_series"
    for insert to authenticated
    with check (
        exists (
            select 1 from training_sessions
            where training_sessions.id = session_series.training_session_id
            and training_sessions.user_id = auth.uid()
        )
    );

create policy "session_series_authenticated_update" on "public"."session_series"
    for update to authenticated
    using (
        exists (
            select 1 from training_sessions
            where training_sessions.id = session_series.training_session_id
            and training_sessions.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from training_sessions
            where training_sessions.id = session_series.training_session_id
            and training_sessions.user_id = auth.uid()
        )
    );

create policy "session_series_authenticated_delete" on "public"."session_series"
    for delete to authenticated
    using (
        exists (
            select 1 from training_sessions
            where training_sessions.id = session_series.training_session_id
            and training_sessions.user_id = auth.uid()
        )
    );
