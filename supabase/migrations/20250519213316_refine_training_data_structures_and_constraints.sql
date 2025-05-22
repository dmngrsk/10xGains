-- Migration: Refine Training Data Structures and Constraints
-- Author: dmngrsk
-- Created: 2025-05-19
-- Description:
--
-- This migration updates several tables related to training plans, exercises, and sessions. It refines check constraints for non-negative values in:
-- - `training_plan_exercise_sets` (expected_reps, expected_weight)
-- - `training_plan_exercise_progressions` (weight_increment, deload_percentage)
-- - `training_sessions` (status)
-- - `session_sets` (actual_weight, actual_reps)
-- It also removes the `current_weight` column from `training_plan_exercise_progressions`.
-- For `training_sessions`, it updates the status check constraint, sets a default status to 'PENDING', and makes `session_date` nullable.
-- For `session_sets`, it refines checks for `actual_weight` and `actual_reps`, makes `actual_reps` nullable, adds a new column and `expected_reps` with non-negative checks, and establishes a foreign key relationship to `training_plan_exercises`.

alter table "public"."training_plan_exercise_sets"
  drop constraint if exists training_plan_exercise_sets_expected_reps_check;
alter table "public"."training_plan_exercise_sets"
  add constraint training_plan_exercise_sets_expected_reps_check check (expected_reps >= 0);

alter table "public"."training_plan_exercise_sets"
  drop constraint if exists training_plan_exercise_sets_expected_weight_check;
alter table "public"."training_plan_exercise_sets"
  add constraint training_plan_exercise_sets_expected_weight_check check (expected_weight >= 0.0);



alter table "public"."training_plan_exercise_progressions"
  drop constraint if exists training_plan_exercise_progressions_weight_increment_check;
alter table "public"."training_plan_exercise_progressions"
  add constraint training_plan_exercise_progressions_weight_increment_check check (weight_increment >= 0.0);

alter table "public"."training_plan_exercise_progressions"
  drop constraint if exists training_plan_exercise_progressions_deload_percentage_check;
alter table "public"."training_plan_exercise_progressions"
  add constraint training_plan_exercise_progressions_deload_percentage_check check (deload_percentage >= 0.0);

alter table "public"."training_plan_exercise_progressions" drop column if exists current_weight;



alter table "public"."training_sessions" drop constraint if exists training_sessions_status_check;

alter table "public"."training_sessions" add constraint training_sessions_status_check
  check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

alter table "public"."training_sessions" alter column status set default 'PENDING';

alter table "public"."training_sessions" alter column session_date drop not null;



alter table "public"."session_sets"
  drop constraint if exists session_series_actual_weight_check;
alter table "public"."session_sets"
  add constraint session_sets_actual_weight_check check (actual_weight >= 0.0);

alter table "public"."session_sets"
  drop constraint if exists session_series_actual_reps_check;
alter table "public"."session_sets"
  add constraint session_sets_actual_reps_check check (actual_reps >= 0);
alter table "public"."session_sets"
  alter column actual_reps drop not null;

alter table "public"."session_sets"
  add column if not exists expected_reps integer;
alter table "public"."session_sets"
  add constraint session_sets_expected_reps_check check (expected_reps >= 0);

alter table "public"."session_sets" add constraint session_sets_training_plan_exercise_id_fkey
  foreign key (training_plan_exercise_id) references "public"."training_plan_exercises"(id);
