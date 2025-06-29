-- Migration: Replace RPC functions with generic collection management
-- Description: This migration modernizes the training plan collection management system by:
-- 1. Dropping 9 legacy RPC functions for individual CRUD operations on training plan collections
-- 2. Replacing them with 2 generic, reusable collection management functions
-- 3. Enabling client-side normalization with database-side transactional guarantees
-- 4. Supporting both single and batch collection operations in atomic transactions
-- Author: AI Assistant
-- Created: 2025-06-28
--
-- Background:
-- The original system used separate RPC functions for each CRUD operation on training plan days,
-- exercises, and sets. This created 9 functions with duplicated logic and limited flexibility.
-- The new system uses client-side normalization (e.g. via insertAndNormalizeOrder) combined with
-- generic database functions for transactional collection replacement.
--
-- Benefits:
-- - Reduced database function count from 9 to 2
-- - Improved performance through batch operations
-- - Better type safety with client-side normalization
-- - Atomic multi-collection updates
-- - Simplified maintenance and testing

-- ========================================
-- PHASE 1: Drop legacy RPC functions
-- ========================================

-- Drop RPC functions for training plan days ordering
-- These functions handled individual CRUD operations with automatic order_index management
drop function if exists create_training_plan_day(uuid, uuid, text, text, smallint);
drop function if exists update_training_plan_day(uuid, uuid, text, text, smallint);
drop function if exists delete_training_plan_day(uuid, uuid);

-- Drop RPC functions for training plan exercises ordering
-- These functions handled individual CRUD operations with automatic order_index management
drop function if exists create_training_plan_exercise(uuid, uuid, uuid, smallint);
drop function if exists update_training_plan_exercise_order(uuid, uuid, smallint);
drop function if exists delete_training_plan_exercise(uuid, uuid);

-- Drop RPC functions for training plan exercise sets ordering
-- These functions handled individual CRUD operations with automatic set_index management
drop function if exists create_training_plan_exercise_set(uuid, uuid, integer, numeric, smallint);
drop function if exists update_training_plan_exercise_set(uuid, uuid, integer, numeric, smallint);
drop function if exists delete_training_plan_exercise_set(uuid, uuid);

-- ========================================
-- PHASE 2: Create generic collection management functions
-- ========================================

-- Generic transactional collection replacement function
-- This function supports two modes:
-- 1. Collection replacement: when p_parent_column and p_parent_id are provided, replaces entire collections atomically
-- 2. Upsert-only: when p_parent_column or p_parent_id is null, only performs upserts without deletions
create or replace function replace_collection(
    p_table_name text,
    p_parent_column text,
    p_parent_id uuid,
    p_records jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
    delete_query text;
    upsert_query text;
    new_ids uuid[];
    record_count int;
begin
    -- Get count of records to process
    select jsonb_array_length(p_records) into record_count;

    -- Phase 1: Delete items that are not in the new collection (only if parent column/id provided)
    if p_parent_column is not null and p_parent_id is not null then
        -- Extract IDs from the new records (handle null IDs for new records)
        select array_agg((value->>'id')::uuid)
        into new_ids
        from jsonb_array_elements(p_records)
        where value->>'id' is not null and value->>'id' != '';

        delete_query := format(
            'DELETE FROM %I WHERE %I = $1',
            p_table_name,
            p_parent_column
        );

        -- Add condition to exclude items that are in the new collection
        if array_length(new_ids, 1) > 0 then
            delete_query := delete_query || ' AND id <> ALL($2)';
            execute delete_query using p_parent_id, new_ids;
        else
            -- No new records, delete all existing records for this parent
            execute delete_query using p_parent_id;
        end if;
    end if;

    -- Phase 2: Upsert the new/updated records
    if record_count > 0 then
        -- Build dynamic upsert query
        upsert_query := format(
            'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(null::%I, $1)
             ON CONFLICT (id) DO UPDATE SET %s',
            p_table_name,
            p_table_name,
            (select string_agg(column_name || ' = EXCLUDED.' || column_name, ', ')
             from information_schema.columns
             where table_name = p_table_name
             and column_name not in ('id', 'created_at') -- don't update id or created_at
            )
        );

        -- Execute upsert
        execute upsert_query using p_records;

        -- Get the results by querying the updated records
        if p_parent_column is not null and p_parent_id is not null then
            -- Collection replacement mode: return all records for the parent
            execute format(
                'SELECT jsonb_agg(to_jsonb(t.*)) FROM %I t WHERE %I = $1',
                p_table_name,
                p_parent_column
            ) using p_parent_id into result;
        else
            -- Upsert-only mode: return the upserted records
            execute format(
                'SELECT jsonb_agg(to_jsonb(t.*)) FROM %I t WHERE id = ANY($1)',
                p_table_name
            ) using (select array_agg((value->>'id')::uuid) from jsonb_array_elements(p_records)) into result;
        end if;
    else
        -- No records to upsert, return empty array
        result := '[]'::jsonb;
    end if;

    return coalesce(result, '[]'::jsonb);
end;
$$;

-- Batch transactional collection replacement function
-- This function allows multiple collection operations to be executed atomically
-- in a single transaction, providing better performance and data consistency
create or replace function replace_collections_batch(
    p_operations jsonb
)
returns void
language plpgsql
security definer
as $$
declare
    operation jsonb;
    table_name text;
    parent_column text;
    parent_id uuid;
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
        records := operation->'records';

        -- Validate required fields
        if table_name is null or records is null then
            raise exception 'Each operation must have table_name and records';
        end if;

        -- Call the replace_collection function (ignore result)
        perform replace_collection(
            table_name,
            parent_column,
            parent_id,
            coalesce(records, '[]'::jsonb)
        );
    end loop;
end;
$$;

-- ========================================
-- PHASE 3: Add function documentation
-- ========================================

-- Document the single collection replacement function
comment on function replace_collection(text, text, uuid, jsonb) is
'Generic function supporting two modes: 1) Collection replacement when parent_column and parent_id are provided (deletes items not in new collection and upserts all provided items), 2) Upsert-only mode when parent_column or parent_id is null (only upserts without deletions). Returns the updated records.';

-- Document the batch collection replacement function
comment on function replace_collections_batch(jsonb) is
'Batch version of replace_collection that processes multiple operations in a single transaction. Automatically detects mode based on presence of parent_column and parent_id. Input format: [{"table_name": "...", "parent_column": "..." (optional), "parent_id": "..." (optional), "records": [...]}]. Returns void.';

-- ========================================
-- MIGRATION SUMMARY
-- ========================================
--
-- This migration modernizes the collection management system:
--
-- REMOVED (9 functions):
-- - create_training_plan_day
-- - update_training_plan_day
-- - delete_training_plan_day
-- - create_training_plan_exercise
-- - update_training_plan_exercise_order
-- - delete_training_plan_exercise
-- - create_training_plan_exercise_set
-- - update_training_plan_exercise_set
-- - delete_training_plan_exercise_set
--
-- ADDED (2 functions):
-- - replace_collection: Atomic collection replacement for single collections
-- - replace_collections_batch: Atomic batch operations for multiple collections
--
-- The new system provides:
-- - Better performance through reduced database round-trips
-- - Improved data consistency with atomic transactions
-- - Enhanced flexibility with client-side normalization
-- - Simplified maintenance with generic, reusable functions
