-- Migration: Add training days and update exercise progression model
-- Description: Adds support for multiple training days per plan and makes exercise progression training plan & exercise specific
-- Author: AI Assistant
-- Created: 2025-04-17

-- -----------------------------------------------------
-- Update exercises table - drop metadata and add description
-- -----------------------------------------------------
-- First add the description column
alter table "public"."exercises" add column description text;

-- Then drop the metadata column since it's not being used
alter table "public"."exercises" drop column metadata;

-- -----------------------------------------------------
-- Table training_plan_days
-- -----------------------------------------------------
create table "public"."training_plan_days" (
    id uuid primary key default gen_random_uuid(),
    training_plan_id uuid not null,
    name varchar(255) not null,
    description text,
    order_index smallint not null,
    foreign key (training_plan_id) references training_plans(id) on delete cascade,
    unique(training_plan_id, order_index)
);

comment on table "public"."training_plan_days" is 'Defines different training days within a training plan (e.g., Push, Pull, Legs)';

-- Create index for looking up days in a plan
create index training_plan_days_plan_id_idx on public.training_plan_days(training_plan_id);

-- Enable RLS on training_plan_days table
alter table "public"."training_plan_days" enable row level security;

-- RLS Policy for anon role (no access)
create policy "training_plan_days_anon_no_access" on "public"."training_plan_days"
    for all to anon
    using (false);

-- RLS Policy for authenticated role - using a join to check ownership
create policy "training_plan_days_authenticated_select" on "public"."training_plan_days"
    for select to authenticated
    using (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_days.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_days_authenticated_insert" on "public"."training_plan_days"
    for insert to authenticated
    with check (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_days.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_days_authenticated_update" on "public"."training_plan_days"
    for update to authenticated
    using (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_days.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_days.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_days_authenticated_delete" on "public"."training_plan_days"
    for delete to authenticated
    using (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_days.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------
-- Create training_plan_exercise_progressions table
-- -----------------------------------------------------
create table "public"."training_plan_exercise_progressions" (
    id uuid primary key default gen_random_uuid(),
    training_plan_id uuid not null,
    exercise_id uuid not null,
    weight_increment numeric(7,3) not null check (weight_increment > 0),
    failure_count_for_deload smallint not null default 3 check (failure_count_for_deload > 0),
    deload_percentage numeric(4,2) not null default 10.00 check (deload_percentage > 0),
    deload_strategy varchar(20) not null default 'PROPORTIONAL' check (deload_strategy in ('PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM')),
    reference_set_index smallint null,
    current_weight numeric(7,3) not null check (current_weight > 0),
    consecutive_failures smallint not null default 0 check (consecutive_failures >= 0),
    last_updated timestamp without time zone default current_timestamp,
    foreign key (training_plan_id) references training_plans(id) on delete cascade,
    foreign key (exercise_id) references exercises(id) on delete cascade,
    unique(training_plan_id, exercise_id)
);

comment on table "public"."training_plan_exercise_progressions" is 'Tracks exercise progression rules and current status per training plan and exercise';

-- Create index for efficient lookups
create index training_plan_exercise_progressions_idx on public.training_plan_exercise_progressions(training_plan_id, exercise_id);

-- Enable RLS on training_plan_exercise_progressions table
alter table "public"."training_plan_exercise_progressions" enable row level security;

-- RLS Policy for anon role (no access)
create policy "training_plan_exercise_progressions_anon_no_access" on "public"."training_plan_exercise_progressions"
    for all to anon
    using (false);

-- RLS Policy for authenticated role - using a join to check ownership
create policy "training_plan_exercise_progressions_authenticated_select" on "public"."training_plan_exercise_progressions"
    for select to authenticated
    using (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercise_progressions.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercise_progressions_authenticated_insert" on "public"."training_plan_exercise_progressions"
    for insert to authenticated
    with check (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercise_progressions.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercise_progressions_authenticated_update" on "public"."training_plan_exercise_progressions"
    for update to authenticated
    using (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercise_progressions.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercise_progressions.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercise_progressions_authenticated_delete" on "public"."training_plan_exercise_progressions"
    for delete to authenticated
    using (
        exists (
            select 1 from training_plans
            where training_plans.id = training_plan_exercise_progressions.training_plan_id
            and training_plans.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------
-- Alter training_plan_exercises to link to training_plan_days
-- -----------------------------------------------------

-- First, create a temporary table to hold existing data
create temporary table temp_training_plan_exercises as
select * from training_plan_exercises;

-- Add training_plan_day_id to training_sessions
alter table "public"."training_sessions" add column training_plan_day_id uuid null;
comment on column "public"."training_sessions"."training_plan_day_id" is 'References the specific training day being performed';

-- Drop foreign key constraint from training_plan_exercise_sets to allow dropping training_plan_exercises
alter table "public"."training_plan_exercise_sets" drop constraint if exists training_plan_exercise_sets_training_plan_exercise_id_fkey;

-- Now drop the existing tables (cascade will handle other dependencies)
drop table "public"."exercise_progression_rules" cascade;
drop table "public"."training_plan_exercises" cascade;

-- Create the modified version of the table
create table "public"."training_plan_exercises" (
    id uuid primary key default gen_random_uuid(),
    training_plan_day_id uuid not null,
    exercise_id uuid not null,
    order_index smallint not null,
    foreign key (training_plan_day_id) references training_plan_days(id) on delete cascade,
    foreign key (exercise_id) references exercises(id) on delete cascade,
    unique(training_plan_day_id, order_index)
);

comment on table "public"."training_plan_exercises" is 'Junction table linking exercises to training days with ordering';

-- Create index for looking up exercises in a training day
create index training_plan_exercises_day_id_idx on public.training_plan_exercises(training_plan_day_id);

-- Enable RLS on training_plan_exercises table
alter table "public"."training_plan_exercises" enable row level security;

-- RLS Policy for anon role (no access)
create policy "training_plan_exercises_anon_no_access" on "public"."training_plan_exercises"
    for all to anon
    using (false);

-- RLS Policy for authenticated role - using nested joins to check ownership
create policy "training_plan_exercises_authenticated_select" on "public"."training_plan_exercises"
    for select to authenticated
    using (
        exists (
            select 1 from training_plan_days
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_days.id = training_plan_exercises.training_plan_day_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercises_authenticated_insert" on "public"."training_plan_exercises"
    for insert to authenticated
    with check (
        exists (
            select 1 from training_plan_days
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_days.id = training_plan_exercises.training_plan_day_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercises_authenticated_update" on "public"."training_plan_exercises"
    for update to authenticated
    using (
        exists (
            select 1 from training_plan_days
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_days.id = training_plan_exercises.training_plan_day_id
            and training_plans.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from training_plan_days
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_days.id = training_plan_exercises.training_plan_day_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercises_authenticated_delete" on "public"."training_plan_exercises"
    for delete to authenticated
    using (
        exists (
            select 1 from training_plan_days
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_days.id = training_plan_exercises.training_plan_day_id
            and training_plans.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------
-- Update training_plan_exercise_sets to reference new training_plan_exercises
-- -----------------------------------------------------

-- Add foreign key constraint back to training_plan_exercise_sets
alter table "public"."training_plan_exercise_sets"
    add constraint training_plan_exercise_sets_training_plan_exercise_id_fkey
    foreign key (training_plan_exercise_id) references training_plan_exercises(id) on delete cascade;

-- -----------------------------------------------------
-- Update session_series table
-- -----------------------------------------------------
alter table "public"."session_series" add foreign key (training_session_id) references training_sessions(id) on delete cascade;

-- Update the foreign key of training_sessions to connect with training_plan_days
alter table "public"."training_sessions"
    add constraint training_sessions_training_plan_day_id_fkey
    foreign key (training_plan_day_id) references training_plan_days(id);

-- -----------------------------------------------------
-- Data Migration Strategy
-- -----------------------------------------------------
-- Note: For existing data, you'll need to run a separate data migration script that:
-- 1. Creates a default training day for each existing training plan
-- 2. Associates existing training_plan_exercises with these default training days
-- 3. Migrates existing exercise_progression_rules data to the new training_plan_exercise_progressions table
--
-- This is not included in this migration as it would depend on the actual data present
-- and should be executed as a separate process.
