-- Migration: 20250608180843_create_rpc_test_scaffold_user_data.sql
-- Description: Creates an RPC function to scaffold test data for the authenticated user.
-- Author: AI Assistant
-- Created: 2025-06-08

--
-- 1. create rpc function `test_scaffold_user_data`
--
-- This function encapsulates the logic for seeding a complete set of test data,
-- including a training plan, historical sessions, and user profile information
-- for the currently authenticated user.
--
-- It is defined with `security definer` to allow it to insert data into tables
-- on behalf of the user, bypassing rls temporarily for the seeding process.
--
create or replace function public.test_scaffold_user_data()
returns void
language plpgsql
security definer
as $$
declare
    squat_id uuid;
    bench_press_id uuid;
    deadlift_id uuid;
    v_user_id uuid := auth.uid(); -- dynamically get the authenticated user's id.
    v_plan_id uuid;
    v_day_a_id uuid;
    v_day_b_id uuid;
    v_squat_exercise_a_id uuid;
    v_bench_press_exercise_id uuid;
    v_squat_exercise_b_id uuid;
    v_deadlift_exercise_id uuid;
    v_session_id uuid;
    v_session_date timestamp;
    v_squat_weight numeric(7,3);
    v_bench_press_weight numeric(7,3);
    v_deadlift_weight numeric(7,3);
    v_days_gap integer;
begin
    --
    -- >> START: ROBUST ENVIRONMENT CHECK
    -- Raise an exception if the custom 'app.environment' setting is 'production'.
    -- This is a safeguard to prevent running test seeders on the live database.
    -- This setting must be configured manually on the production database.
    -- Command: ALTER DATABASE postgres SET app.environment = 'production';
    if current_setting('app.environment', true) = 'production' then
        raise exception 'The "test_scaffold_user_data" function is for testing only and cannot be run in the production environment.';
    end if;
    -- << END: ROBUST ENVIRONMENT CHECK

    --
    -- Upsert base exercises to ensure they exist for the test data.
    --
    -- check if squat exists, if not create it
    select id into squat_id from exercises where name = 'Squat' limit 1;
    if squat_id is null then
        insert into exercises (id, name, description)
        values (gen_random_uuid(), 'Squat', null)
        returning id into squat_id;
    end if;

    -- check if bench press exists, if not create it
    select id into bench_press_id from exercises where name = 'Bench Press' limit 1;
    if bench_press_id is null then
        insert into exercises (id, name, description)
        values (gen_random_uuid(), 'Bench Press', null)
        returning id into bench_press_id;
    end if;

    -- check if deadlift exists, if not create it
    select id into deadlift_id from exercises where name = 'Deadlift' limit 1;
    if deadlift_id is null then
        insert into exercises (id, name, description)
        values (gen_random_uuid(), 'Deadlift', null)
        returning id into deadlift_id;
    end if;

    --
    -- Create the training plan with all its components
    --
    -- create training plan
    insert into training_plans (id, user_id, name, description, created_at)
    values (gen_random_uuid(), v_user_id, 'Test Training Plan', 'Scaffolded training plan for testing.', '2025-04-27t10:00:00.000')
    returning id into v_plan_id;

    -- create day a
    insert into training_plan_days (id, training_plan_id, name, description, order_index)
    values (gen_random_uuid(), v_plan_id, 'Workout A', 'Scaffolded workout a for testing.', 1)
    returning id into v_day_a_id;

    -- create day b
    insert into training_plan_days (id, training_plan_id, name, description, order_index)
    values (gen_random_uuid(), v_plan_id, 'Workout B', 'Scaffolded workout b for testing.', 2)
    returning id into v_day_b_id;

    --
    -- Create exercises for day a
    --
    -- squat
    insert into training_plan_exercises (id, training_plan_day_id, exercise_id, order_index)
    values (gen_random_uuid(), v_day_a_id, squat_id, 1)
    returning id into v_squat_exercise_a_id;

    -- insert squat sets
    insert into training_plan_exercise_sets (training_plan_exercise_id, set_index, expected_reps, expected_weight)
    values
        (v_squat_exercise_a_id, 1, 5, 100),
        (v_squat_exercise_a_id, 2, 5, 100),
        (v_squat_exercise_a_id, 3, 5, 100);

    -- bench press
    insert into training_plan_exercises (id, training_plan_day_id, exercise_id, order_index)
    values (gen_random_uuid(), v_day_a_id, bench_press_id, 2)
    returning id into v_bench_press_exercise_id;

    -- insert bench press sets
    insert into training_plan_exercise_sets (training_plan_exercise_id, set_index, expected_reps, expected_weight)
    values
        (v_bench_press_exercise_id, 1, 5, 70),
        (v_bench_press_exercise_id, 2, 5, 70),
        (v_bench_press_exercise_id, 3, 5, 70);

    --
    -- Create exercises for day b
    --
    -- squat
    insert into training_plan_exercises (id, training_plan_day_id, exercise_id, order_index)
    values (gen_random_uuid(), v_day_b_id, squat_id, 1)
    returning id into v_squat_exercise_b_id;

    -- insert squat sets
    insert into training_plan_exercise_sets (training_plan_exercise_id, set_index, expected_reps, expected_weight)
    values
        (v_squat_exercise_b_id, 1, 5, 100),
        (v_squat_exercise_b_id, 2, 5, 100),
        (v_squat_exercise_b_id, 3, 5, 100);

    -- deadlift
    insert into training_plan_exercises (id, training_plan_day_id, exercise_id, order_index)
    values (gen_random_uuid(), v_day_b_id, deadlift_id, 2)
    returning id into v_deadlift_exercise_id;

    -- insert deadlift set
    insert into training_plan_exercise_sets (training_plan_exercise_id, set_index, expected_reps, expected_weight)
    values (v_deadlift_exercise_id, 1, 5, 120);

    --
    -- Create progression rules
    --
    -- squat progression
    insert into training_plan_exercise_progressions (
        id, training_plan_id, exercise_id, weight_increment, failure_count_for_deload,
        deload_percentage, deload_strategy, reference_set_index, consecutive_failures, last_updated
    )
    values (gen_random_uuid(), v_plan_id, squat_id, 2.5, 3, 10, 'PROPORTIONAL', null, 0, '2025-04-27t10:00:00.000');

    -- bench press progression
    insert into training_plan_exercise_progressions (
        id, training_plan_id, exercise_id, weight_increment, failure_count_for_deload,
        deload_percentage, deload_strategy, reference_set_index, consecutive_failures, last_updated
    )
    values (gen_random_uuid(), v_plan_id, bench_press_id, 2.5, 3, 10, 'PROPORTIONAL', null, 0, '2025-04-27t10:00:00.000');

    -- deadlift progression
    insert into training_plan_exercise_progressions (
        id, training_plan_id, exercise_id, weight_increment, failure_count_for_deload,
        deload_percentage, deload_strategy, reference_set_index, consecutive_failures, last_updated
    )
    values (gen_random_uuid(), v_plan_id, deadlift_id, 5, 3, 10, 'PROPORTIONAL', null, 0, '2025-04-27t10:00:00.000');

    --
    -- Handle user profile - update if exists, create if doesn't
    -- This also sets the newly created plan as the user's active plan.
    --
    insert into user_profiles (id, first_name, active_training_plan_id, created_at, updated_at)
    values (v_user_id, 'Test User', v_plan_id, '2025-04-27t10:00:00.000', '2025-04-27t10:00:00.000')
    on conflict (id) do update
    set active_training_plan_id = v_plan_id, updated_at = '2025-04-27t10:00:00.000'
    returning id into v_user_id;

    --
    -- Initialize weights for progression and create a pending session.
    --
    v_squat_weight := 100;
    v_bench_press_weight := 70;
    v_deadlift_weight := 120;
    v_session_date := '2025-06-01t12:00:00.000'::timestamp;

    -- create current (pending) session
    insert into training_sessions (id, user_id, training_plan_id, training_plan_day_id, session_date, status)
    values (gen_random_uuid(), v_user_id, v_plan_id, v_day_a_id, null, 'PENDING')
    returning id into v_session_id;

    -- insert pending sets for workout a (squat)
    insert into session_sets (training_session_id, training_plan_exercise_id, set_index, actual_weight, actual_reps, expected_reps, status, completed_at)
    values
        (v_session_id, v_squat_exercise_a_id, 1, v_squat_weight, null, 5, 'PENDING', null),
        (v_session_id, v_squat_exercise_a_id, 2, v_squat_weight, null, 5, 'PENDING', null),
        (v_session_id, v_squat_exercise_a_id, 3, v_squat_weight, null, 5, 'PENDING', null);

    -- insert pending sets for workout a (bench press)
    insert into session_sets (training_session_id, training_plan_exercise_id, set_index, actual_weight, actual_reps, expected_reps, status, completed_at)
    values
        (v_session_id, v_bench_press_exercise_id, 1, v_bench_press_weight, null, 5, 'PENDING', null),
        (v_session_id, v_bench_press_exercise_id, 2, v_bench_press_weight, null, 5, 'PENDING', null),
        (v_session_id, v_bench_press_exercise_id, 3, v_bench_press_weight, null, 5, 'PENDING', null);

    --
    -- Decrement weights to create a believable history of progression.
    --
    v_squat_weight := v_squat_weight - 2.5;
    v_bench_press_weight := v_bench_press_weight - 2.5;
    v_deadlift_weight := v_deadlift_weight - 5;

    --
    -- Create 14 historic sessions alternating between workout a and b
    --
    for i in 1..14 loop
        v_days_gap := case when i % 3 = 0 then 3 else 2 end;
        v_session_date := v_session_date - (v_days_gap || ' days')::interval;

        insert into training_sessions (id, user_id, training_plan_id, training_plan_day_id, session_date, status)
        values (gen_random_uuid(), v_user_id, v_plan_id, case when i % 2 = 0 then v_day_a_id else v_day_b_id end, v_session_date, 'COMPLETED')
        returning id into v_session_id;

        if i % 2 = 0 then
            -- workout a sets
            insert into session_sets (training_session_id, training_plan_exercise_id, set_index, actual_weight, actual_reps, expected_reps, status, completed_at)
            values
                (v_session_id, v_squat_exercise_a_id, 1, v_squat_weight, 5, 5, 'COMPLETED', v_session_date),
                (v_session_id, v_squat_exercise_a_id, 2, v_squat_weight, 5, 5, 'COMPLETED', v_session_date + '5 minutes'::interval),
                (v_session_id, v_squat_exercise_a_id, 3, v_squat_weight, 5, 5, 'COMPLETED', v_session_date + '10 minutes'::interval);

            insert into session_sets (training_session_id, training_plan_exercise_id, set_index, actual_weight, actual_reps, expected_reps, status, completed_at)
            values
                (v_session_id, v_bench_press_exercise_id, 1, v_bench_press_weight, 5, 5, 'COMPLETED', v_session_date + '15 minutes'::interval),
                (v_session_id, v_bench_press_exercise_id, 2, v_bench_press_weight, 5, 5, 'COMPLETED', v_session_date + '20 minutes'::interval),
                (v_session_id, v_bench_press_exercise_id, 3, v_bench_press_weight, 5, 5, 'COMPLETED', v_session_date + '25 minutes'::interval);

            v_squat_weight := v_squat_weight - 2.5;
            v_bench_press_weight := v_bench_press_weight - 2.5;
        else
            -- workout b sets
            insert into session_sets (training_session_id, training_plan_exercise_id, set_index, actual_weight, actual_reps, expected_reps, status, completed_at)
            values
                (v_session_id, v_squat_exercise_b_id, 1, v_squat_weight, 5, 5, 'COMPLETED', v_session_date),
                (v_session_id, v_squat_exercise_b_id, 2, v_squat_weight, 5, 5, 'COMPLETED', v_session_date + '5 minutes'::interval),
                (v_session_id, v_squat_exercise_b_id, 3, v_squat_weight, 5, 5, 'COMPLETED', v_session_date + '10 minutes'::interval);

            insert into session_sets (training_session_id, training_plan_exercise_id, set_index, actual_weight, actual_reps, expected_reps, status, completed_at)
            values
              (v_session_id, v_deadlift_exercise_id, 1, v_deadlift_weight, 5, 5, 'COMPLETED', v_session_date + '15 minutes'::interval);

            v_squat_weight := v_squat_weight - 2.5;
            v_deadlift_weight := v_deadlift_weight - 5;
        end if;
    end loop;
end;
$$;


--
-- 2. grant execute permissions
--
-- allow the `authenticated` role to execute this function.
--
grant execute on function public.test_scaffold_user_data() to authenticated;
