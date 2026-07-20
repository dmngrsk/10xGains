-- Migration: Extend the managed-collection whitelist and make it maintainable
-- Description: The whitelist added in 20260719084500 was derived from the API's repositories, and
--   so omitted two tables the Cypress test-data seeder legitimately drives through
--   `replace_collections_batch`: `plans` and `profiles`. Seeding a test user therefore failed with
--   "Table plans is not a managed collection".
--
--   Both belong on the list: they are ordinary user-owned tables, fully covered by RLS, and the
--   function runs as security invoker - so for an `authenticated` caller RLS still restricts every
--   statement to their own rows. The whitelist is defence in depth against an arbitrary table name
--   reaching the dynamic SQL, not the primary access control.
--
--   The list is moved into `public.is_managed_collection` so that extending it in future is a
--   one-line change rather than a full recreation of a 150-line function body.
-- Author: AI Assistant
-- Created: 2026-07-20

-- The single source of truth for which tables replace_collection may touch.
create or replace function is_managed_collection(p_table_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select p_table_name in (
        'profiles',
        'plans',
        'plan_days',
        'plan_exercises',
        'plan_exercise_sets',
        'plan_exercise_progressions',
        'sessions',
        'session_sets'
    );
$$;

comment on function is_managed_collection(text) is
'Whitelist of the tables public.replace_collection is permitted to manage. Keep in sync with the collection call sites in apps/api/src/repositories and the Cypress seeder in cypress/support/test-data/scaffold.ts.';

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
    -- Guard: only the tables this function is meant to manage are accepted. The list lives in
    -- public.is_managed_collection so it can be extended without recreating this whole function.
    if not public.is_managed_collection(p_table_name) then
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

-- The recreated function keeps the privilege lockdown from 20260719084500.
revoke execute on function public.replace_collection(text, text, uuid, text, jsonb, text, uuid) from public, anon;
grant execute on function public.replace_collection(text, text, uuid, text, jsonb, text, uuid) to authenticated, service_role;
