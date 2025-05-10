-- Migration: Create RPC functions for training_plan_exercises ordering
-- Description: Adds RPC functions to manage training_plan_exercises and their order_index.
-- Author: AI Assistant
-- Created: 2025-05-10 13:02:02 UTC

-- function to create a training plan exercise and handle reordering
create or replace function create_training_plan_exercise(
    p_user_id uuid,
    p_day_id uuid,
    p_exercise_id uuid,
    p_target_order_index smallint default null -- if null, appends to the end
)
returns setof training_plan_exercises -- returns the created row
language plpgsql
security definer
as $$
declare
    v_new_exercise_id uuid;
    v_actual_order_index smallint;
    v_max_order_index smallint;
    v_row record;
    v_plan_id uuid;
begin
    -- Verify ownership of the training plan day
    select tpd.training_plan_id into v_plan_id
    from training_plan_days tpd
    join training_plans tp on tpd.training_plan_id = tp.id
    where tpd.id = p_day_id and tp.user_id = p_user_id;

    if not found then
        raise exception 'training plan day not found or user does not have access. user_id: %, day_id: %', p_user_id, p_day_id;
    end if;

    -- Determine actual order_index to use
    if p_target_order_index is null then
        -- Append to the end
        select coalesce(max(order_index), 0) + 1 into v_actual_order_index
        from training_plan_exercises
        where training_plan_day_id = p_day_id;
    else
        -- Get the current count of exercises for the day
        select count(*) into v_max_order_index
        from training_plan_exercises
        where training_plan_day_id = p_day_id;

        -- Validate the target index
        if p_target_order_index < 1 then
            v_actual_order_index := 1;
        elsif p_target_order_index > v_max_order_index + 1 then
            v_actual_order_index := v_max_order_index + 1;
        else
            v_actual_order_index := p_target_order_index;
        end if;

        -- Shift existing items
        for v_row in (
            select id, order_index
            from training_plan_exercises
            where training_plan_day_id = p_day_id and order_index >= v_actual_order_index
            order by order_index desc
        ) loop
            update training_plan_exercises
            set order_index = v_row.order_index + 1
            where id = v_row.id;
        end loop;
    end if;

    -- Insert the new exercise
    insert into training_plan_exercises (training_plan_day_id, exercise_id, order_index)
    values (p_day_id, p_exercise_id, v_actual_order_index)
    returning id into v_new_exercise_id;

    -- Return the newly created exercise
    return query select * from training_plan_exercises where id = v_new_exercise_id;
exception
    when unique_violation then
        -- Fallback: append to the end if there was a unique constraint violation
        select coalesce(max(order_index), 0) + 1 into v_actual_order_index
        from training_plan_exercises
        where training_plan_day_id = p_day_id;

        insert into training_plan_exercises (training_plan_day_id, exercise_id, order_index)
        values (p_day_id, p_exercise_id, v_actual_order_index)
        returning id into v_new_exercise_id;

        return query select * from training_plan_exercises where id = v_new_exercise_id;
end;
$$;

-- function to update a training plan exercise's order
create or replace function update_training_plan_exercise_order(
    p_user_id uuid,
    p_plan_exercise_id uuid,
    p_target_order_index smallint
)
returns setof training_plan_exercises -- returns the updated row
language plpgsql
security definer
as $$
declare
    v_current_day_id uuid;
    v_current_order_index smallint;
    v_max_order_index smallint;
    v_updated_exercise record;
    v_row record;
begin
    -- Verify ownership and get current day_id and order_index
    select tpe.training_plan_day_id, tpe.order_index into v_current_day_id, v_current_order_index
    from training_plan_exercises tpe
    join training_plan_days tpd on tpe.training_plan_day_id = tpd.id
    join training_plans tp on tpd.training_plan_id = tp.id
    where tpe.id = p_plan_exercise_id and tp.user_id = p_user_id;

    if not found then
        raise exception 'training plan exercise not found or user does not have access. user_id: %, plan_exercise_id: %', p_user_id, p_plan_exercise_id;
    end if;

    -- Handle order_index change (it must be provided and different)
    if p_target_order_index is null or p_target_order_index = v_current_order_index then
        -- If target is null or same as current, nothing to do for reordering
        -- Return the current state of the exercise
        return query select * from training_plan_exercises where id = p_plan_exercise_id;
        return;
    end if;

    -- Get count of exercises for the day
    select count(*) into v_max_order_index
    from training_plan_exercises
    where training_plan_day_id = v_current_day_id;

    -- Validate the target index
    if p_target_order_index < 1 then
        p_target_order_index := 1;
    elsif p_target_order_index > v_max_order_index then
        p_target_order_index := v_max_order_index;
    end if;

    -- Temporarily remove the exercise from ordering sequence
    update training_plan_exercises set order_index = -1 where id = p_plan_exercise_id;

    -- Process based on move direction
    if p_target_order_index < v_current_order_index then
        -- Moving earlier
        for v_row in (
            select id, order_index
            from training_plan_exercises
            where training_plan_day_id = v_current_day_id
              and order_index >= p_target_order_index
              and order_index < v_current_order_index
            order by order_index desc
        ) loop
            update training_plan_exercises
            set order_index = v_row.order_index + 1
            where id = v_row.id;
        end loop;
    else -- Moving later
        for v_row in (
            select id, order_index
            from training_plan_exercises
            where training_plan_day_id = v_current_day_id
              and order_index > v_current_order_index
              and order_index <= p_target_order_index
            order by order_index asc
        ) loop
            update training_plan_exercises
            set order_index = v_row.order_index - 1
            where id = v_row.id;
        end loop;
    end if;

    -- Update the moved exercise to its target position
    update training_plan_exercises
    set order_index = p_target_order_index
    where id = p_plan_exercise_id
    returning * into v_updated_exercise;

    if not found then
        raise exception 'failed to update training plan exercise: exercise not found after reordering';
    end if;

    -- Return the updated exercise
    return query select * from training_plan_exercises where id = v_updated_exercise.id;
exception
    when unique_violation then
        -- Fallback: if a unique constraint violation occurs, it implies a concurrency issue or logic flaw.
        -- Attempt to restore the original order_index if possible.
        if exists (select 1 from training_plan_exercises where id = p_plan_exercise_id and order_index = -1) then
             update training_plan_exercises
             set order_index = v_current_order_index -- Restore original index
             where id = p_plan_exercise_id;
        end if;
        -- Re-raise the original exception as this shouldn't happen with the cursor logic if ownership is correct
        raise;
    when others then
        -- Attempt to recover the row if it was set to -1 but not restored
        if exists (select 1 from training_plan_exercises where id = p_plan_exercise_id and order_index = -1) then
            begin
                update training_plan_exercises
                set order_index = v_current_order_index -- try to restore original
                where id = p_plan_exercise_id and order_index = -1;
                raise; -- re-raise original error
            exception
                when others then
                    -- Last resort: append to end
                    select coalesce(max(order_index), 0) + 1 into v_current_order_index
                    from training_plan_exercises
                    where training_plan_day_id = v_current_day_id;

                    update training_plan_exercises
                    set order_index = v_current_order_index
                    where id = p_plan_exercise_id and order_index = -1;
                    raise; -- re-raise original error
            end;
        else
            raise;
        end if;
end;
$$;

-- function to delete a training plan exercise and handle reordering
create or replace function delete_training_plan_exercise(
    p_user_id uuid,
    p_plan_exercise_id uuid
)
returns void -- does not return data, only performs action
language plpgsql
security definer
as $$
declare
    v_deleted_day_id uuid;
    v_deleted_order_index smallint;
    v_row record;
begin
    -- Verify ownership and get day_id and order_index of the exercise to be deleted
    select tpe.training_plan_day_id, tpe.order_index into v_deleted_day_id, v_deleted_order_index
    from training_plan_exercises tpe
    join training_plan_days tpd on tpe.training_plan_day_id = tpd.id
    join training_plans tp on tpd.training_plan_id = tp.id
    where tpe.id = p_plan_exercise_id and tp.user_id = p_user_id;

    if not found then
        raise exception 'training plan exercise not found or user does not have access. user_id: %, plan_exercise_id: %', p_user_id, p_plan_exercise_id;
    end if;

    -- Delete the exercise
    delete from training_plan_exercises where id = p_plan_exercise_id;

    -- Shift subsequent items up
    for v_row in (
        select id, order_index
        from training_plan_exercises
        where training_plan_day_id = v_deleted_day_id and order_index > v_deleted_order_index
        order by order_index asc
    ) loop
        update training_plan_exercises
        set order_index = v_row.order_index - 1
        where id = v_row.id;
    end loop;

    return;
exception
    when others then
        -- Re-raise any exception
        raise;
end;
$$;
