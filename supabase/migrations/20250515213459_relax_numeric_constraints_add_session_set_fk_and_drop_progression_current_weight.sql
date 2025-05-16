-- Migration: relax_numeric_constraints_add_session_set_fk_and_drop_progression_current_weight
-- Author: AI Assistant
-- Created: 2025-05-15

-- Modify check constraints for various columns to be non-negative or less restrictive
-- Affected tables and columns:
--   - public.training_plan_exercise_sets: expected_reps, expected_weight
--   - public.training_plan_exercise_progressions: weight_increment, deload_percentage
--   - public.session_sets: actual_weight, actual_reps
alter table "public"."training_plan_exercise_sets"
  drop constraint if exists training_plan_exercise_sets_expected_reps_check,
  add constraint training_plan_exercise_sets_expected_reps_check check (expected_reps >= 0);

alter table "public"."training_plan_exercise_sets"
  drop constraint if exists training_plan_exercise_sets_expected_weight_check,
  add constraint training_plan_exercise_sets_expected_weight_check check (expected_weight >= 0.0);

alter table "public"."training_plan_exercise_progressions"
  drop constraint if exists training_plan_exercise_progressions_weight_increment_check,
  add constraint training_plan_exercise_progressions_weight_increment_check check (weight_increment >= 0.0);

alter table "public"."training_plan_exercise_progressions"
  drop constraint if exists training_plan_exercise_progressions_deload_percentage_check,
  add constraint training_plan_exercise_progressions_deload_percentage_check check (deload_percentage >= 0.0);

alter table "public"."session_sets"
  drop constraint if exists session_series_actual_weight_check,
  add constraint session_sets_actual_weight_check check (actual_weight >= 0.0);

alter table "public"."session_sets"
  drop constraint if exists session_series_actual_reps_check,
  add constraint session_sets_actual_reps_check check (actual_reps >= 0);

-- Add foreign key reference in session_sets table to training_plan_exercises
-- No on delete cascade, prevent deletion of training exercises with existing training sessions
alter table "public"."session_sets" add constraint session_sets_training_plan_exercise_id_fkey
    foreign key (training_plan_exercise_id) references "public"."training_plan_exercises"(id);

-- Drop the current_weight column from training_plan_exercise_progressions
alter table "public"."training_plan_exercise_progressions" drop column current_weight;
