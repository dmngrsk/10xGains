-- Migration: Add an optional secondary scope filter to replace_collection
-- Description: `replace_collection` identifies a collection by a single parent column. That is
--   sufficient for plan collections (a day belongs to exactly one plan), but wrong for session sets:
--   they were scoped by `plan_exercise_id` alone, which is shared by *every session ever trained
--   from that plan day*. The delete phase, the order normalization and the SELECT-back therefore all
--   operated on sets belonging to other - including completed, historical - sessions, silently
--   renumbering and rewriting past workouts whenever a set was added to the current one.
--
--   This migration adds an optional second filter (`p_scope_column` / `p_scope_id`) that is ANDed
--   with the parent filter across all three phases, so a caller can express a compound collection
--   key such as "the sets of plan exercise X *within session Y*".
--
--   Special consideration: the function is dropped and recreated rather than extended in place.
--   Adding defaulted parameters via `create or replace` would leave the old 5-argument overload in
--   place, making named-argument calls from PostgREST ambiguous. All callers pass the new arguments
--   explicitly (null where no secondary scope applies).
-- Author: AI Assistant
-- Created: 2026-07-19

-- Drop the 5-argument version. Safe: the only callers are the API's collection helpers, which are
-- updated in the same change to pass the new argument list.
drop function if exists public.replace_collection(text, text, uuid, text, jsonb);

create or replace function replace_collection(
    p_table_name text,
    p_parent_column text,
    p_parent_id uuid,
    p_order_column text,
    p_records jsonb,
    p_scope_column text default null,
    p_scope_id uuid default null
)
returns jsonb
language plpgsql
set search_path = ''
security invoker
as $$
declare
    result jsonb;
    scope_predicate text := '';
    delete_query text;
    upsert_query text;
    new_ids uuid[];
    record_count int;
    operation_mode text;
    update_columns text;
begin
    -- Guard: only the collection tables the API manages through this function are accepted.
    -- Keep this list in sync with the call sites in apps/api/src/repositories/*.repository.ts.
    if p_table_name is null or p_table_name not in (
        'sessions',
        'session_sets',
        'plan_days',
        'plan_exercises',
        'plan_exercise_sets',
        'plan_exercise_progressions'
    ) then
        raise exception 'Table % is not a managed collection', coalesce(p_table_name, '<null>');
    end if;

    -- A secondary scope only makes sense alongside a parent filter, and both of its halves are
    -- required together - a column without an id (or vice versa) is a caller bug, not a no-op.
    if (p_scope_column is null) <> (p_scope_id is null) then
        raise exception 'p_scope_column and p_scope_id must be provided together';
    end if;

    -- Built once and appended to every statement below, so the delete, the order offset and the
    -- select-back all see exactly the same collection. The scope id is always bound as $2, and the
    -- predicate is omitted entirely when no scope is given (an unreferenced USING argument is
    -- harmless, which keeps the parameter positions identical across all three statements).
    if p_scope_column is not null then
        scope_predicate := format(' AND %I = $2', p_scope_column);
    end if;

    -- Get count of records to process
    select jsonb_array_length(p_records) into record_count;

    -- Phase 1: Delete items that are not in the new collection (only if parent column/id provided)
    if p_parent_column is not null and p_parent_id is not null then
        -- Extract IDs from the new records (handle null IDs for new records)
        select array_agg((value->>'id')::uuid)
        into new_ids
        from jsonb_array_elements(p_records)
        where value->>'id' is not null and value->>'id' != '';

        -- Rows carried over by the new collection are excluded from the delete. An empty array makes
        -- `id <> ALL($3)` true for every row, which is exactly the "replace everything" case, so the
        -- clause is always present and the parameter positions never shift.
        delete_query := format(
            'DELETE FROM public.%I WHERE %I = $1',
            p_table_name,
            p_parent_column
        ) || scope_predicate || ' AND id <> ALL($3)';

        execute delete_query using p_parent_id, p_scope_id, coalesce(new_ids, '{}'::uuid[]);
    end if;

    -- Phase 2: Upsert the new/updated records
    if record_count > 0 then
        -- Temporarily offset existing order column values to prevent conflicts during upsert.
        -- Negating rather than adding a fixed amount keeps this collision-free for collections of
        -- any size, since order columns are 1-based.
        if p_order_column is not null and p_parent_column is not null and p_parent_id is not null then
            execute format(
                'UPDATE public.%I SET %I = -%I WHERE %I = $1',
                p_table_name,
                p_order_column,
                p_order_column,
                p_parent_column
            ) || scope_predicate
            using p_parent_id, p_scope_id;
        end if;

        -- Build dynamic upsert query
        -- Only build UPDATE SET for columns that exist in the target table

        -- Get the columns that exist in the target table (excluding system columns)
        select string_agg(column_name || ' = EXCLUDED.' || column_name, ', ')
        into update_columns
        from information_schema.columns
        where table_schema = 'public'
        and table_name = p_table_name
        and column_name not in ('id', 'created_at');

        -- If no updateable columns found, just do insert with conflict resolution on id
        if update_columns is null or update_columns = '' then
            upsert_query := format(
                'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(null::public.%I, $1)
                 ON CONFLICT (id) DO NOTHING',
                p_table_name,
                p_table_name
            );
        else
            upsert_query := format(
                'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(null::public.%I, $1)
                 ON CONFLICT (id) DO UPDATE SET %s',
                p_table_name,
                p_table_name,
                update_columns
            );
        end if;

        -- Execute upsert
        execute upsert_query using p_records;

        -- Get the results by querying the updated records
        if p_parent_column is not null and p_parent_id is not null then
            -- Collection replacement mode: return all records for the parent (and scope)
            execute format(
                'SELECT jsonb_agg(to_jsonb(t.*)) FROM public.%I t WHERE %I = $1',
                p_table_name,
                p_parent_column
            ) || scope_predicate
            using p_parent_id, p_scope_id into result;
        else
            -- Upsert-only mode: return the upserted records
            execute format(
                'SELECT jsonb_agg(to_jsonb(t.*)) FROM public.%I t WHERE id = ANY($1)',
                p_table_name
            ) using (select array_agg((value->>'id')::uuid) from jsonb_array_elements(p_records)) into result;
        end if;
    else
        -- No records to upsert, return empty array
        result := '[]'::jsonb;
    end if;

    return coalesce(result, '[]'::jsonb);

exception
    when others then
        operation_mode := case
            when p_parent_column is not null and p_parent_id is not null then 'COLLECTION_REPLACEMENT'
            else 'UPSERT_ONLY'
        end;

        raise exception '[REPLACE_COLLECTION] ERROR in % operation on table public.%: % (SQLSTATE: %)', operation_mode, p_table_name, SQLERRM, SQLSTATE;
end;
$$;

-- The batch wrapper forwards the optional scope for each operation.
create or replace function replace_collections_batch(
    p_operations jsonb
)
returns void
language plpgsql
set search_path = ''
security invoker
as $$
declare
    operation jsonb;
    table_name text;
    parent_column text;
    parent_id uuid;
    order_column text;
    scope_column text;
    scope_id uuid;
    records jsonb;
begin
    -- Validate that p_operations is an array
    if jsonb_typeof(p_operations) != 'array' then
        raise exception 'Operations parameter must be an array';
    end if;

    -- Process each operation
    for operation in select * from jsonb_array_elements(p_operations)
    loop
        -- Extract operation parameters
        table_name := operation->>'table_name';
        parent_column := operation->>'parent_column';
        parent_id := (operation->>'parent_id')::uuid;
        order_column := operation->>'order_column';
        scope_column := operation->>'scope_column';
        scope_id := (operation->>'scope_id')::uuid;
        records := operation->'records';

        -- Validate required fields
        if table_name is null or records is null then
            raise exception 'Each operation must have table_name and records';
        end if;

        -- Call the replace_collection function (ignore result)
        perform public.replace_collection(
            table_name,
            parent_column,
            parent_id,
            order_column,
            coalesce(records, '[]'::jsonb),
            scope_column,
            scope_id
        );
    end loop;
end;
$$;

-- Re-apply the privilege lockdown: the dropped-and-recreated function starts again with the default
-- EXECUTE grant to PUBLIC, which would silently undo the previous migration's hardening.
revoke execute on function public.replace_collection(text, text, uuid, text, jsonb, text, uuid) from public, anon;
revoke execute on function public.replace_collections_batch(jsonb) from public, anon;

grant execute on function public.replace_collection(text, text, uuid, text, jsonb, text, uuid) to authenticated, service_role;
grant execute on function public.replace_collections_batch(jsonb) to authenticated, service_role;

comment on function replace_collection(text, text, uuid, text, jsonb, text, uuid) is
'Generic function supporting two modes: 1) Collection replacement when parent_column and parent_id are provided (deletes items not in new collection and upserts all provided items), 2) Upsert-only mode when parent_column or parent_id is null (only upserts without deletions). An optional scope_column/scope_id pair narrows the collection further, for compound keys such as a session''s sets for one plan exercise. Optional order_column parameter handles unique constraint conflicts during order swapping by temporarily negating existing values. Runs as security invoker, so the caller''s RLS policies apply, and only accepts the whitelisted collection tables. Returns the updated records.';
