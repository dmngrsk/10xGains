-- Migration: Create RPC functions for training_plan_exercise_sets ordering
-- Description: Adds RPC functions to manage training_plan_exercise_sets and their set_index.
-- Author: AI Assistant
-- Created: 2025-05-10 14:34:53 UTC

-- function to create a training plan exercise set and handle reordering
create or replace function create_training_plan_exercise_set(
    p_user_id uuid,
    p_training_plan_exercise_id uuid,
    p_expected_reps integer,
    p_expected_weight numeric,
    p_target_set_index smallint default null -- if null, appends to the end
)
returns setof training_plan_exercise_sets -- returns the created row
language plpgsql
security definer
as $$
declare
    v_new_set_id uuid;
    v_actual_set_index smallint;
    v_max_set_index smallint;
    v_row record;
begin
    -- Verify ownership of the training plan exercise
    if not exists (
        select 1
        from training_plan_exercises tpe
        join training_plan_days tpd on tpe.training_plan_day_id = tpd.id
        join training_plans tp on tpd.training_plan_id = tp.id
        where tpe.id = p_training_plan_exercise_id and tp.user_id = p_user_id
    ) then
        raise exception 'training plan exercise not found or user does not have access. user_id: %, exercise_id: %', p_user_id, p_training_plan_exercise_id;
    end if;

    -- Determine actual set_index to use
    if p_target_set_index is null then
        -- Append to the end: find the current max set_index for the exercise and add 1
        select coalesce(max(set_index), 0) + 1 into v_actual_set_index
        from training_plan_exercise_sets
        where training_plan_exercise_id = p_training_plan_exercise_id;
    else
        -- Get the current max index to validate the provided index
        select count(*) into v_max_set_index
        from training_plan_exercise_sets
        where training_plan_exercise_id = p_training_plan_exercise_id;

        -- Validate the target index is in range
        if p_target_set_index < 1 then
            v_actual_set_index := 1;
        elsif p_target_set_index > v_max_set_index + 1 then
            v_actual_set_index := v_max_set_index + 1;
        else
            v_actual_set_index := p_target_set_index;
        end if;

        -- Shift existing items with conflicting indices
        for v_row in (
            select id, set_index
            from training_plan_exercise_sets
            where training_plan_exercise_id = p_training_plan_exercise_id and set_index >= v_actual_set_index
            order by set_index desc
        ) loop
            update training_plan_exercise_sets
            set set_index = v_row.set_index + 1
            where id = v_row.id;
        end loop;
    end if;

    -- Insert the new set
    insert into training_plan_exercise_sets (training_plan_exercise_id, expected_reps, expected_weight, set_index)
    values (p_training_plan_exercise_id, p_expected_reps, p_expected_weight, v_actual_set_index)
    returning id into v_new_set_id;

    -- Return the newly created set
    return query select * from training_plan_exercise_sets where id = v_new_set_id;
exception
    when unique_violation then
        -- Fallback: append to the end if there was a unique constraint violation
        select coalesce(max(set_index), 0) + 1 into v_actual_set_index
        from training_plan_exercise_sets
        where training_plan_exercise_id = p_training_plan_exercise_id;

        insert into training_plan_exercise_sets (training_plan_exercise_id, expected_reps, expected_weight, set_index)
        values (p_training_plan_exercise_id, p_expected_reps, p_expected_weight, v_actual_set_index)
        returning id into v_new_set_id;

        return query select * from training_plan_exercise_sets where id = v_new_set_id;
end;
$$;

-- function to update a training plan exercise set and handle reordering
create or replace function update_training_plan_exercise_set(
    p_user_id uuid,
    p_set_id uuid,
    p_expected_reps integer default null,
    p_expected_weight numeric default null,
    p_target_set_index smallint default null
)
returns setof training_plan_exercise_sets -- returns the updated row
language plpgsql
security definer
as $$
declare
    v_current_exercise_id uuid;
    v_current_set_index smallint;
    v_max_set_index smallint;
    v_updated_set record;
    v_row record;
begin
    -- Verify ownership and get current exercise_id and set_index
    select tpes.training_plan_exercise_id, tpes.set_index into v_current_exercise_id, v_current_set_index
    from training_plan_exercise_sets tpes
    join training_plan_exercises tpe on tpes.training_plan_exercise_id = tpe.id
    join training_plan_days tpd on tpe.training_plan_day_id = tpd.id
    join training_plans tp on tpd.training_plan_id = tp.id
    where tpes.id = p_set_id and tp.user_id = p_user_id;

    if not found then
        raise exception 'training plan exercise set not found or user does not have access. user_id: %, set_id: %', p_user_id, p_set_id;
    end if;

    -- Handle set_index change if provided and different from current
    if p_target_set_index is not null and p_target_set_index != v_current_set_index then
        select count(*) into v_max_set_index
        from training_plan_exercise_sets
        where training_plan_exercise_id = v_current_exercise_id;

        if p_target_set_index < 1 then
            p_target_set_index := 1;
        elsif p_target_set_index > v_max_set_index then
            p_target_set_index := v_max_set_index;
        end if;

        -- Temporarily remove the set from ordering sequence (optional, but can prevent unique constraint issues during shifts)
        update training_plan_exercise_sets set set_index = -1 where id = p_set_id;

        if p_target_set_index < v_current_set_index then
            -- Moving earlier
            for v_row in (
                select id, set_index
                from training_plan_exercise_sets
                where training_plan_exercise_id = v_current_exercise_id
                  and set_index >= p_target_set_index
                  and set_index < v_current_set_index
                order by set_index desc
            ) loop
                update training_plan_exercise_sets
                set set_index = v_row.set_index + 1
                where id = v_row.id;
            end loop;
        else -- Moving later
            for v_row in (
                select id, set_index
                from training_plan_exercise_sets
                where training_plan_exercise_id = v_current_exercise_id
                  and set_index > v_current_set_index
                  and set_index <= p_target_set_index
                order by set_index asc
            ) loop
                update training_plan_exercise_sets
                set set_index = v_row.set_index - 1
                where id = v_row.id;
            end loop;
        end if;
        v_current_set_index := p_target_set_index; -- The set will be updated to this index
    end if;

    -- Update the set with new values
    update training_plan_exercise_sets
    set
        expected_reps = coalesce(p_expected_reps, expected_reps),
        expected_weight = coalesce(p_expected_weight, expected_weight),
        set_index = v_current_set_index -- This takes care of the -1 case and the new target index
    where id = p_set_id
    returning * into v_updated_set;

    if not found then
        raise exception 'Failed to update training plan exercise set: set not found after reordering or during update';
    end if;

    -- Return the updated set
    return query select * from training_plan_exercise_sets where id = v_updated_set.id;
exception
    when unique_violation then
        -- Fallback: update without changing the order
        update training_plan_exercise_sets
        set
            expected_reps = coalesce(p_expected_reps, expected_reps),
            expected_weight = coalesce(p_expected_weight, expected_weight)
            -- Intentionally omit set_index
        where id = p_set_id
        returning * into v_updated_set;

        if not found then
            raise exception 'Failed to update training plan exercise set: set not found during fallback';
        end if;
        return query select * from training_plan_exercise_sets where id = v_updated_set.id;
    when others then
        -- Attempt to recover the row if it was set to -1 but not restored
        if exists (select 1 from training_plan_exercise_sets where id = p_set_id and set_index = -1) then
            begin
                update training_plan_exercise_sets
                set set_index = v_current_set_index -- Try to restore to original or intended target
                where id = p_set_id and set_index = -1;
                raise; -- Re-raise the original exception
            exception
                when others then
                    -- Last resort: append to end if original position cannot be restored
                    select coalesce(max(set_index), 0) + 1 into v_current_set_index
                    from training_plan_exercise_sets
                    where training_plan_exercise_id = v_current_exercise_id;

                    update training_plan_exercise_sets
                    set set_index = v_current_set_index
                    where id = p_set_id and set_index = -1;
                    raise; -- Re-raise the original exception
            end;
        else
            raise; -- No recovery needed, just re-raise
        end if;
end;
$$;

-- function to delete a training plan exercise set and handle reordering
create or replace function delete_training_plan_exercise_set(
    p_user_id uuid,
    p_set_id uuid
)
returns void -- does not return data, only performs action
language plpgsql
security definer
as $$
declare
    v_deleted_exercise_id uuid;
    v_deleted_set_index smallint;
    v_row record;
begin
    -- Verify ownership and get exercise_id and set_index of the set to be deleted
    select tpes.training_plan_exercise_id, tpes.set_index into v_deleted_exercise_id, v_deleted_set_index
    from training_plan_exercise_sets tpes
    join training_plan_exercises tpe on tpes.training_plan_exercise_id = tpe.id
    join training_plan_days tpd on tpe.training_plan_day_id = tpd.id
    join training_plans tp on tpd.training_plan_id = tp.id
    where tpes.id = p_set_id and tp.user_id = p_user_id;

    if not found then
        raise exception 'training plan exercise set not found or user does not have access. user_id: %, set_id: %', p_user_id, p_set_id;
    end if;

    -- Delete the set
    delete from training_plan_exercise_sets where id = p_set_id;

    -- Shift subsequent items up
    for v_row in (
        select id, set_index
        from training_plan_exercise_sets
        where training_plan_exercise_id = v_deleted_exercise_id and set_index > v_deleted_set_index
        order by set_index asc
    ) loop
        update training_plan_exercise_sets
        set set_index = v_row.set_index - 1
        where id = v_row.id;
    end loop;

    return;
exception
    when others then
        raise; -- Re-raise any exception
end;
$$;
