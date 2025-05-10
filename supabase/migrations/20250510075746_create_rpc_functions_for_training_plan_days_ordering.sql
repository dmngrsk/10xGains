-- Migration: Create RPC functions for training_plan_days ordering
-- Description: Adds RPC functions to manage training_plan_days and their order_index.
-- Author: AI Assistant
-- Created: 2025-05-10

-- function to create a training plan day and handle reordering
create or replace function create_training_plan_day(
    p_user_id uuid,
    p_plan_id uuid,
    p_name text,
    p_description text default null,
    p_target_order_index smallint default null -- if null, appends to the end
)
returns setof training_plan_days -- returns the created row
language plpgsql
security definer -- required to modify multiple rows which might be restricted by rls otherwise.
as $$
declare
    v_new_day_id uuid;
    v_actual_order_index smallint;
    v_max_order_index smallint;
    v_row record;
begin
    -- Verify ownership of the plan
    if not exists (select 1 from training_plans where id = p_plan_id and user_id = p_user_id) then
        raise exception 'training plan not found or user does not have access. user_id: %, plan_id: %', p_user_id, p_plan_id;
    end if;

    -- Determine actual order_index to use
    if p_target_order_index is null then
        -- Append to the end: find the current max order_index for the plan and add 1
        select coalesce(max(order_index), 0) + 1 into v_actual_order_index
        from training_plan_days
        where training_plan_id = p_plan_id;
    else
        -- Get the current max index to validate the provided index
        select count(*) into v_max_order_index
        from training_plan_days
        where training_plan_id = p_plan_id;

        -- Validate the target index is in range
        if p_target_order_index < 1 then
            -- If target index is less than 1, force it to 1
            v_actual_order_index := 1;
        elsif p_target_order_index > v_max_order_index + 1 then
            -- If target index is beyond the end, append it to the end
            v_actual_order_index := v_max_order_index + 1;
        else
            -- Otherwise use the specified index
            v_actual_order_index := p_target_order_index;
        end if;

        -- Shift existing items with conflicting indices
        for v_row in (
            select id, order_index
            from training_plan_days
            where training_plan_id = p_plan_id and order_index >= v_actual_order_index
            order by order_index desc
        ) loop
            update training_plan_days
            set order_index = v_row.order_index + 1
            where id = v_row.id;
        end loop;
    end if;

    -- Insert the new day
    insert into training_plan_days (training_plan_id, name, description, order_index)
    values (p_plan_id, p_name, p_description, v_actual_order_index)
    returning id into v_new_day_id;

    -- Return the newly created day
    return query select * from training_plan_days where id = v_new_day_id;
exception
    when unique_violation then
        -- Fallback: append to the end if there was a unique constraint violation
        select coalesce(max(order_index), 0) + 1 into v_actual_order_index
        from training_plan_days
        where training_plan_id = p_plan_id;

        insert into training_plan_days (training_plan_id, name, description, order_index)
        values (p_plan_id, p_name, p_description, v_actual_order_index)
        returning id into v_new_day_id;

        return query select * from training_plan_days where id = v_new_day_id;
end;
$$;

-- function to update a training plan day and handle reordering
create or replace function update_training_plan_day(
    p_user_id uuid,
    p_day_id uuid,
    p_name text default null,         -- keep existing if null
    p_description text default null,  -- keep existing if null
    p_target_order_index smallint default null -- keep existing if null
)
returns setof training_plan_days -- returns the updated row
language plpgsql
security definer -- required to modify multiple rows which might be restricted by rls otherwise.
as $$
declare
    v_current_plan_id uuid;
    v_current_order_index smallint;
    v_max_order_index smallint;
    v_updated_day record;
    v_row record;
begin
    -- Verify ownership and get current plan_id and order_index
    select tpd.training_plan_id, tpd.order_index into v_current_plan_id, v_current_order_index
    from training_plan_days tpd
    join training_plans tp on tpd.training_plan_id = tp.id
    where tpd.id = p_day_id and tp.user_id = p_user_id;

    if not found then
        raise exception 'training plan day not found or user does not have access. user_id: %, day_id: %', p_user_id, p_day_id;
    end if;

    -- Handle order_index change if provided and different from current
    if p_target_order_index is not null and p_target_order_index != v_current_order_index then
        -- Get count of days to validate target index
        select count(*) into v_max_order_index
        from training_plan_days
        where training_plan_id = v_current_plan_id;

        -- Validate the target index
        if p_target_order_index < 1 then
            p_target_order_index := 1;
        elsif p_target_order_index > v_max_order_index then
            p_target_order_index := v_max_order_index;
        end if;

        -- Temporarily remove the day from ordering sequence
        update training_plan_days set order_index = -1 where id = p_day_id;

        -- Process based on move direction
        if p_target_order_index < v_current_order_index then
            -- Moving earlier: need to shift items at or after target, but before current, DOWN
            -- For example: if moving from position 5 to position 2,
            -- items at positions 2,3,4 need to be shifted to 3,4,5

            -- Process in descending order to avoid conflicts
            for v_row in (
                select id, order_index
                from training_plan_days
                where training_plan_id = v_current_plan_id
                  and order_index >= p_target_order_index
                  and order_index < v_current_order_index
                order by order_index desc
            ) loop
                update training_plan_days
                set order_index = v_row.order_index + 1
                where id = v_row.id;
            end loop;
        else -- Moving later
            -- Moving later: need to shift items after current, but at or before target, UP
            -- For example: if moving from position 2 to position 5,
            -- items at positions 3,4,5 need to be shifted to 2,3,4

            -- Process in ascending order to avoid conflicts
            for v_row in (
                select id, order_index
                from training_plan_days
                where training_plan_id = v_current_plan_id
                  and order_index > v_current_order_index
                  and order_index <= p_target_order_index
                order by order_index asc
            ) loop
                update training_plan_days
                set order_index = v_row.order_index - 1
                where id = v_row.id;
            end loop;
        end if;

        -- Finally, update the moved day to its target position
        v_current_order_index := p_target_order_index;
    end if;

    -- Update the day with new values
    update training_plan_days
    set
        name = coalesce(p_name, name),
        description = coalesce(p_description, description),
        order_index = v_current_order_index
    where id = p_day_id
    returning * into v_updated_day;

    if not found then
        raise exception 'Failed to update training plan day: day not found after reordering';
    end if;

    -- Return the updated day
    return query select * from training_plan_days where id = v_updated_day.id;
exception
    when unique_violation then
        -- Fallback: update without changing the order
        update training_plan_days
        set
            name = coalesce(p_name, name),
            description = coalesce(p_description, description)
            -- Intentionally omit order_index
        where id = p_day_id
        returning * into v_updated_day;

        if not found then
            raise exception 'Failed to update training plan day: day not found during fallback';
        end if;

        return query select * from training_plan_days where id = v_updated_day.id;
    when others then
        -- Attempt to recover the row if it was set to -1 but not restored
        -- This is a safeguard in case an error occurred after removing it from sequence
        if exists (select 1 from training_plan_days where id = p_day_id and order_index = -1) then
            -- Restore original position or append to end if that fails
            begin
                update training_plan_days
                set order_index = v_current_order_index
                where id = p_day_id and order_index = -1;

                -- Re-raise the original exception
                raise;
            exception
                when others then
                    -- Last resort: append to end
                    select coalesce(max(order_index), 0) + 1 into v_current_order_index
                    from training_plan_days
                    where training_plan_id = v_current_plan_id;

                    update training_plan_days
                    set order_index = v_current_order_index
                    where id = p_day_id and order_index = -1;

                    -- Re-raise the original exception
                    raise;
            end;
        else
            -- No recovery needed, just re-raise
            raise;
        end if;
end;
$$;

-- function to delete a training plan day and handle reordering
create or replace function delete_training_plan_day(
    p_user_id uuid,
    p_day_id uuid
)
returns void -- does not return data, only performs action
language plpgsql
security definer -- required to modify multiple rows which might be restricted by rls otherwise.
as $$
declare
    v_deleted_plan_id uuid;
    v_deleted_order_index smallint;
    v_row record;
begin
    -- Verify ownership and get plan_id and order_index of the day to be deleted
    select tpd.training_plan_id, tpd.order_index into v_deleted_plan_id, v_deleted_order_index
    from training_plan_days tpd
    join training_plans tp on tpd.training_plan_id = tp.id
    where tpd.id = p_day_id and tp.user_id = p_user_id;

    if not found then
        raise exception 'training plan day not found or user does not have access. user_id: %, day_id: %', p_user_id, p_day_id;
    end if;

    -- Delete the day
    delete from training_plan_days where id = p_day_id;

    -- Shift subsequent items up, using cursor approach for safety
    for v_row in (
        select id, order_index
        from training_plan_days
        where training_plan_id = v_deleted_plan_id and order_index > v_deleted_order_index
        order by order_index asc
    ) loop
        update training_plan_days
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
