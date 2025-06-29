-- Migration: Rename tables to remove unnecessary prefixes and fix related constraints
-- Description: Comprehensive table renaming and constraint cleanup
-- Author: AI Assistant
-- Created: 2025-06-29
--
-- This migration performs the following operations:
-- 1. Renames tables to remove training_ and user_ prefixes
-- 2. Updates foreign key column names to match new table structure
-- 3. Renames primary key constraints to match new table names
-- 4. Recreates indexes with updated names
-- 5. Fixes foreign key constraints that were broken by renaming
-- 6. Drops obsolete test scaffold RPC function
-- 7. Updates table comments to reflect new naming structure
-- 
-- Affected tables:
--   - training_sessions → sessions
--   - user_profiles → profiles
--   - training_plans → plans
--   - training_plan_days → plan_days
--   - training_plan_exercises → plan_exercises
--   - training_plan_exercise_sets → plan_exercise_sets
--   - training_plan_exercise_progressions → plan_exercise_progressions
-- 
-- Special considerations:
--   - This migration includes destructive operations (dropping constraints/indexes)
--   - Foreign key constraints are recreated to maintain referential integrity
--   - All operations use IF EXISTS/IF NOT EXISTS for safety

-- ============================================================================
-- STEP 1: RENAME TABLES TO REMOVE PREFIXES
-- ============================================================================

-- Rename training_sessions to sessions
alter table training_sessions rename to sessions;

-- Rename user_profiles to profiles
alter table user_profiles rename to profiles;

-- Rename training_plans to plans
alter table training_plans rename to plans;

-- Rename training_plan_days to plan_days
alter table training_plan_days rename to plan_days;

-- Rename training_plan_exercises to plan_exercises
alter table training_plan_exercises rename to plan_exercises;

-- Rename training_plan_exercise_sets to plan_exercise_sets
alter table training_plan_exercise_sets rename to plan_exercise_sets;

-- Rename training_plan_exercise_progressions to plan_exercise_progressions
alter table training_plan_exercise_progressions rename to plan_exercise_progressions;

-- ============================================================================
-- STEP 2: UPDATE FOREIGN KEY COLUMN NAMES
-- ============================================================================

-- Update sessions table foreign key column names
alter table sessions rename column training_plan_id to plan_id;
alter table sessions rename column training_plan_day_id to plan_day_id;

-- Update session_sets table foreign key column names
alter table session_sets rename column training_session_id to session_id;
alter table session_sets rename column training_plan_exercise_id to plan_exercise_id;

-- Update plan_days table foreign key column names
alter table plan_days rename column training_plan_id to plan_id;

-- Update plan_exercises table foreign key column names
alter table plan_exercises rename column training_plan_day_id to plan_day_id;

-- Update plan_exercise_sets table foreign key column names
alter table plan_exercise_sets rename column training_plan_exercise_id to plan_exercise_id;

-- Update plan_exercise_progressions table foreign key column names
alter table plan_exercise_progressions rename column training_plan_id to plan_id;

-- Update profiles table foreign key column names
alter table profiles rename column active_training_plan_id to active_plan_id;

-- ============================================================================
-- STEP 3: RENAME PRIMARY KEY CONSTRAINTS TO MATCH NEW TABLE NAMES
-- ============================================================================

-- DESTRUCTIVE: Renaming primary key constraints to match new table names
-- PostgreSQL automatically creates primary key constraints with pattern {table_name}_pkey
-- After table renaming, we need to update the constraint names for consistency

-- Rename sessions primary key constraint
alter table sessions rename constraint training_sessions_pkey to sessions_pkey;

-- Rename profiles primary key constraint  
alter table profiles rename constraint user_profiles_pkey to profiles_pkey;

-- Rename plans primary key constraint
alter table plans rename constraint training_plans_pkey to plans_pkey;

-- Rename plan_days primary key constraint
alter table plan_days rename constraint training_plan_days_pkey to plan_days_pkey;

-- Rename plan_exercises primary key constraint
alter table plan_exercises rename constraint training_plan_exercises_pkey to plan_exercises_pkey;

-- Rename plan_exercise_sets primary key constraint
alter table plan_exercise_sets rename constraint training_plan_exercise_sets_pkey to plan_exercise_sets_pkey;

-- Rename plan_exercise_progressions primary key constraint
alter table plan_exercise_progressions rename constraint training_plan_exercise_progressions_pkey to plan_exercise_progressions_pkey;

-- ============================================================================
-- STEP 4: UPDATE INDEXES TO REFLECT NEW TABLE AND COLUMN NAMES
-- ============================================================================

-- Drop old indexes and create new ones with updated names
-- DESTRUCTIVE: Dropping existing indexes - they will be recreated with new names
drop index if exists training_plans_user_id_idx;
create index if not exists plans_user_id_idx on plans(user_id);

drop index if exists training_plan_days_plan_id_idx;
create index if not exists plan_days_plan_id_idx on plan_days(plan_id);

drop index if exists training_plan_exercises_day_id_idx;
create index if not exists plan_exercises_day_id_idx on plan_exercises(plan_day_id);

drop index if exists training_plan_exercise_sets_exercise_id_idx;
create index if not exists plan_exercise_sets_exercise_id_idx on plan_exercise_sets(plan_exercise_id);

drop index if exists training_plan_exercise_progressions_idx;
create index if not exists plan_exercise_progressions_plan_id_exercise_id_idx on plan_exercise_progressions(plan_id, exercise_id);

drop index if exists training_sessions_user_id_date_idx;
create index if not exists sessions_user_id_date_idx on sessions(user_id, session_date);

drop index if exists user_profiles_id_idx;
create index if not exists profiles_id_idx on profiles(id);

-- Rename unique constraints (this will automatically rename their supporting indexes)
-- DESTRUCTIVE: Renaming unique constraints to match new table and column names
alter table plan_days rename constraint training_plan_days_training_plan_id_order_index_key to plan_days_plan_id_order_index_key;
alter table plan_exercise_progressions rename constraint training_plan_exercise_progres_training_plan_id_exercise_id_key to plan_exercise_progressions_plan_id_exercise_id_key;
alter table plan_exercise_sets rename constraint training_plan_exercise_sets_training_plan_exercise_id_set_i_key to plan_exercise_sets_plan_exercise_id_set_index_key;
alter table plan_exercises rename constraint training_plan_exercises_training_plan_day_id_order_index_key to plan_exercises_plan_day_id_order_index_key;

-- Create missing indexes for foreign key constraints to improve performance
-- These indexes support foreign key constraints that were previously unindexed
create index if not exists session_sets_plan_exercise_id_idx on session_sets(plan_exercise_id);
create index if not exists plan_exercise_progressions_plan_id_idx on plan_exercise_progressions(plan_id);
create index if not exists plan_exercise_progressions_exercise_id_idx on plan_exercise_progressions(exercise_id);
create index if not exists plan_exercises_exercise_id_idx on plan_exercises(exercise_id);
create index if not exists sessions_plan_id_idx on sessions(plan_id);
create index if not exists sessions_plan_day_id_idx on sessions(plan_day_id);
create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists profiles_active_plan_id_idx on profiles(active_plan_id);

-- ============================================================================
-- STEP 5: FIX FOREIGN KEY CONSTRAINTS AFTER TABLE RENAMING
-- ============================================================================

-- DESTRUCTIVE: Dropping and recreating foreign key constraints to fix naming
-- This is necessary because constraint names weren't automatically updated during table renaming

-- Fix session_sets constraints
alter table session_sets drop constraint if exists session_sets_training_plan_exercise_id_fkey;
alter table session_sets add constraint session_sets_plan_exercise_id_fkey 
    foreign key (plan_exercise_id) references plan_exercises(id) on delete cascade;

alter table session_sets drop constraint if exists session_sets_training_session_id_fkey;
alter table session_sets add constraint session_sets_session_id_fkey 
    foreign key (session_id) references sessions(id) on delete cascade;

-- Fix sessions constraints
alter table sessions drop constraint if exists training_sessions_training_plan_day_id_fkey;
alter table sessions add constraint sessions_plan_day_id_fkey 
    foreign key (plan_day_id) references plan_days(id) on delete cascade;

alter table sessions drop constraint if exists training_sessions_training_plan_id_fkey;
alter table sessions add constraint sessions_plan_id_fkey 
    foreign key (plan_id) references plans(id) on delete cascade;

alter table sessions drop constraint if exists training_sessions_user_id_fkey;
alter table sessions add constraint sessions_user_id_fkey 
    foreign key (user_id) references auth.users(id) on delete cascade;

-- Fix plan_* table constraints
alter table plan_days drop constraint if exists training_plan_days_training_plan_id_fkey;
alter table plan_days add constraint plan_days_plan_id_fkey 
    foreign key (plan_id) references plans(id) on delete cascade;

alter table plan_exercises drop constraint if exists training_plan_exercises_training_plan_day_id_fkey;
alter table plan_exercises add constraint plan_exercises_plan_day_id_fkey 
    foreign key (plan_day_id) references plan_days(id) on delete cascade;

alter table plan_exercises drop constraint if exists training_plan_exercises_exercise_id_fkey;
alter table plan_exercises add constraint plan_exercises_exercise_id_fkey 
    foreign key (exercise_id) references exercises(id) on delete cascade;

alter table plan_exercise_sets drop constraint if exists training_plan_exercise_sets_training_plan_exercise_id_fkey;
alter table plan_exercise_sets add constraint plan_exercise_sets_plan_exercise_id_fkey 
    foreign key (plan_exercise_id) references plan_exercises(id) on delete cascade;

alter table plan_exercise_progressions drop constraint if exists training_plan_exercise_progressions_training_plan_id_fkey;
alter table plan_exercise_progressions add constraint plan_exercise_progressions_plan_id_fkey 
    foreign key (plan_id) references plans(id) on delete cascade;

alter table plan_exercise_progressions drop constraint if exists training_plan_exercise_progressions_exercise_id_fkey;
alter table plan_exercise_progressions add constraint plan_exercise_progressions_exercise_id_fkey 
    foreign key (exercise_id) references exercises(id) on delete cascade;

-- Fix profiles constraint
alter table profiles drop constraint if exists user_profiles_active_training_plan_fkey;
alter table profiles add constraint profiles_active_plan_id_fkey 
    foreign key (active_plan_id) references plans(id) on delete set null;

-- Fix plans constraint
alter table plans drop constraint if exists training_plans_user_id_fkey;
alter table plans add constraint plans_user_id_fkey 
    foreign key (user_id) references auth.users(id) on delete cascade;

-- ============================================================================
-- STEP 6: CLEANUP OBSOLETE FUNCTIONS
-- ============================================================================

-- DESTRUCTIVE: Drop the obsolete test scaffold RPC function
-- This function has been replaced with TypeScript-based test data generation
-- for better maintainability and type safety
drop function if exists public.test_scaffold_user_data();

-- ============================================================================
-- STEP 7: UPDATE TABLE COMMENTS AND DOCUMENTATION
-- ============================================================================

-- Update table comments to reflect new naming structure
comment on table sessions is 'Tracks individual workout sessions';
comment on table profiles is 'Stores additional user profile information';
comment on table plans is 'Stores training plan definitions';
comment on table plan_days is 'Stores individual days within training plans';
comment on table plan_exercises is 'Links exercises to training plan days';
comment on table plan_exercise_sets is 'Defines sets for exercises in training plans';
comment on table plan_exercise_progressions is 'Defines progression rules for exercises in training plans';
