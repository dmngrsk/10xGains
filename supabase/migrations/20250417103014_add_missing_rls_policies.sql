-- Migration: Add training days and update exercise progression model
-- Description: Adds support for multiple training days per plan and makes exercise progression training plan & exercise specific
-- Author: AI Assistant
-- Created: 2025-04-17

-- Add missing RLS policies for exercises
create policy "exercises_authenticated_insert" on "public"."exercises"
    for insert to authenticated
    with check (true);

create policy "exercises_authenticated_update" on "public"."exercises"
    for update to authenticated
    using (
        -- Check that no other users have training plans containing this exercise
        NOT EXISTS (
            select 1
            from training_plan_exercises
            join training_plan_days on training_plan_exercises.training_plan_day_id = training_plan_days.id
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_exercises.exercise_id = exercises.id
            and training_plans.user_id != auth.uid()
        )
    )
    with check (true);

create policy "exercises_authenticated_delete" on "public"."exercises"
    for delete to authenticated
    using (
        -- Check that no training plans contain this exercise
        NOT EXISTS (
            select 1
            from training_plan_exercises
            where training_plan_exercises.exercise_id = exercises.id
        )
    );

-- Add missing RLS policies for training_plan_exercise_sets
create policy "training_plan_exercise_sets_authenticated_select" on "public"."training_plan_exercise_sets"
    for select to authenticated
    using (
        exists (
            select 1
            from training_plan_exercises
            join training_plan_days on training_plan_exercises.training_plan_day_id = training_plan_days.id
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_exercises.id = training_plan_exercise_sets.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercise_sets_authenticated_insert" on "public"."training_plan_exercise_sets"
    for insert to authenticated
    with check (
        exists (
            select 1
            from training_plan_exercises
            join training_plan_days on training_plan_exercises.training_plan_day_id = training_plan_days.id
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_exercises.id = training_plan_exercise_sets.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );

create policy "training_plan_exercise_sets_authenticated_update" on "public"."training_plan_exercise_sets"
    for update to authenticated
    using (
        exists (
            select 1
            from training_plan_exercises
            join training_plan_days on training_plan_exercises.training_plan_day_id = training_plan_days.id
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_exercises.id = training_plan_exercise_sets.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    )
    with check (true);

create policy "training_plan_exercise_sets_authenticated_delete" on "public"."training_plan_exercise_sets"
    for delete to authenticated
    using (
        exists (
            select 1
            from training_plan_exercises
            join training_plan_days on training_plan_exercises.training_plan_day_id = training_plan_days.id
            join training_plans on training_plan_days.training_plan_id = training_plans.id
            where training_plan_exercises.id = training_plan_exercise_sets.training_plan_exercise_id
            and training_plans.user_id = auth.uid()
        )
    );
