-- Migration: Decouple session history from plan edits
-- Description: One migration for one invariant: **a plan is free to change, and nothing a user has
--   already trained changes with it.** Editing a plan currently reaches into finished workouts three
--   different ways - through cascading deletes, through the live lookups a session performs at
--   completion time, and through `replace_collection`'s delete-by-exclusion - so the fixes are
--   deliberately deployed together. Any subset leaves the schema in a state where one hole is
--   plugged and another is not, and the plan editor this supports is only safe once all of them are.
--
--   Affected: `session_sets` (two new columns, one foreign key), `plan_days` and `plan_exercises`
--   (soft delete, ordering constraints), `sessions` (one foreign key), `replace_collection` and
--   `replace_collections_batch` (new optional parameter, so a new signature).
--
--   The four phases below were developed as separate migrations and are merged here because none of
--   them has been deployed anywhere yet; the history is not worth four files.
-- Author: AI Assistant
-- Created: 2026-08-24

-- ========================================
-- PHASE 1: Make a session self-describing
-- ========================================

-- A session set records what the user did (`actual_reps`, `actual_weight`) and, since 20250519213316,
-- what the plan asked of them in reps (`expected_reps`). Two things it has never recorded are the
-- prescribed *weight* and whether the plan prescribed the set at all. Both were read back from the
-- live plan whenever they were needed, which makes a session's verdict depend on the plan holding
-- still - and the plan does not hold still, since `resolveExerciseProgressions` rewrites
-- `plan_exercise_sets.expected_weight` on every completion even when the user never touches it.

alter table "public"."session_sets"
    add column if not exists expected_weight numeric(7,3);

-- Matches the existing `session_sets_actual_weight_check`. A bodyweight movement is prescribed at
-- 0 kg, so zero is permitted; negative weight is not.
alter table "public"."session_sets"
    drop constraint if exists session_sets_expected_weight_check;
alter table "public"."session_sets"
    add constraint session_sets_expected_weight_check check (expected_weight >= 0.0);

-- Backfill. For a PENDING set `actual_weight` is still exactly the value seeded from the plan by
-- `buildSessionSets`, so this is precise. For a COMPLETED, FAILED or SKIPPED set the user may have
-- overridden the weight during the workout, so this is the closest recoverable approximation - the
-- prescribed value was not recorded anywhere at the time and cannot be reconstructed. Historical
-- progression decisions are unaffected either way: they were taken when the session was completed,
-- against the plan as it then stood, and are already durable in `plan_exercise_progressions`.
--
-- The column is added nullable, backfilled, and only then marked NOT NULL, rather than being given a
-- `default 0`. A default would silently record a prescription of zero for every existing row, which
-- the progression comparison would read as "any weight succeeds".
update "public"."session_sets"
    set expected_weight = actual_weight
    where expected_weight is null;

alter table "public"."session_sets"
    alter column expected_weight set not null;

-- Whether the plan prescribed this set, or the user added it mid-workout. Deleting a session set
-- renumbers the ones that remain, and completion pairs a session's sets to the plan's by `set_index`
-- and skips a planned set the session does not hold - reading it as one the plan gained after the
-- session started. A deleted prescribed set is indistinguishable from that, so the failure it
-- recorded silently stops counting and the exercise progresses instead of deloading.
--
-- Until now the API inferred this by counting the plan's current sets for the exercise and asking
-- whether `set_index` fell within it. That inference is only as stable as the plan: shrinking an
-- exercise from three sets to two reclassifies the third session set as ad hoc, and a set the user
-- had already failed became deletable again. Recording the answer when the set is created is what
-- makes it true permanently, in the same way `expected_weight` above makes the prescription durable.
alter table "public"."session_sets"
    add column if not exists is_prescribed boolean not null default false;

-- Backfill with the same inference the API made at runtime, which is the only reconstruction
-- available for rows that predate the column - but performed once, so it can no longer drift as the
-- plan moves. `plan_exercise_sets.set_index` is contiguous from 1, maintained by
-- `replace_collection`'s order normalization, so "the plan still has a set at this index" and the
-- API's old "within the plan's set count" are the same statement over this data.
update "public"."session_sets" s
    set is_prescribed = true
    where exists (
        select 1
        from "public"."plan_exercise_sets" p
        where p.plan_exercise_id = s.plan_exercise_id
          and p.set_index = s.set_index
    );

comment on column "public"."session_sets".expected_weight is
'The weight the plan prescribed for this set, snapshotted when the session was created. Written once and never edited by the client - the pair (expected_reps, expected_weight) is what the session is judged against, so that editing the plan afterwards cannot change the verdict on a workout already in progress or complete.';

comment on column "public"."session_sets".is_prescribed is
'True when the set was seeded from the plan at session creation, false when the user added it mid-workout. Server-assigned and never accepted from the client. A prescribed set can never be deleted - removing it would make the failure it recorded disappear from the progression - while an ad hoc set may be, while still PENDING. The default of false applies only to a plain INSERT: writes that go through replace_collection use jsonb_populate_recordset, which supplies an explicit NULL for an absent key and therefore fails loudly on the NOT NULL rather than quietly recording a prescribed set as ad hoc.';

-- ========================================
-- PHASE 2: Soft-delete for plan days and plan exercises
-- ========================================

-- Removing a day or an exercise from a plan currently destroys history, because both cascades run
-- through structures that session data points at (see PHASE 3 for the foreign keys themselves). The
-- application's answer so far has been to lock the whole editor once a plan has been trained, which
-- is enforced in the Angular client alone and blocks a great deal that was never dangerous.
-- Archiving replaces that: the row stays, the history stays pointed at it, and the editor and
-- session creation simply stop seeing it.
--
-- `archived_at` is timestamptz, unlike the older `timestamp without time zone` columns in this
-- schema. It records when the server archived something rather than when a workout happened in the
-- user's own day, so an absolute instant is the right type; the existing columns are left alone.

alter table "public"."plan_days"
    add column if not exists archived_at timestamptz;

alter table "public"."plan_exercises"
    add column if not exists archived_at timestamptz;

comment on column "public"."plan_days".archived_at is
'When set, this day has been removed from the plan by the user but is retained because sessions reference it. Filtered out of the plan editor and out of session creation; still resolved when rendering history.';

comment on column "public"."plan_exercises".archived_at is
'When set, this exercise has been removed from the plan by the user but is retained because session sets reference it. Filtered out of the plan editor and out of session creation; still resolved when rendering history.';

-- The `(plan_id, order_index)` and `(plan_day_id, order_index)` unique constraints MUST become
-- partial. An archived row keeps the `order_index` it had, while the rows still live are renumbered
-- 1..n around it, so the very first reorder after an archive would collide.
--
-- Destructive step: drops two UNIQUE CONSTRAINTs. Each is immediately replaced by a partial UNIQUE
-- INDEX over the same columns, restricted to the live rows. This is not a weakening - uniqueness
-- among the rows that can actually be ordered is exactly the invariant the original constraint was
-- expressing, and the only one that was ever true. No data is touched, and no ordering that is valid
-- today becomes invalid: a plan with no archived rows behaves identically.
alter table "public"."plan_days"
    drop constraint if exists plan_days_plan_id_order_index_key;
create unique index if not exists plan_days_plan_id_order_index_active_key
    on "public"."plan_days" (plan_id, order_index)
    where archived_at is null;

alter table "public"."plan_exercises"
    drop constraint if exists plan_exercises_plan_day_id_order_index_key;
create unique index if not exists plan_exercises_plan_day_id_order_index_active_key
    on "public"."plan_exercises" (plan_day_id, order_index)
    where archived_at is null;

-- Every editor read and every session creation now filters on `archived_at is null`, which is true
-- of nearly every row, so a partial index keeps those reads on the same access path they had before
-- the column existed.
create index if not exists plan_days_plan_id_active_idx
    on "public"."plan_days" (plan_id)
    where archived_at is null;

create index if not exists plan_exercises_plan_day_id_active_idx
    on "public"."plan_exercises" (plan_day_id)
    where archived_at is null;

-- ========================================
-- PHASE 3: Stop plan deletes from cascading into session history
-- ========================================

-- Defence in depth behind PHASE 2. The application no longer hard-deletes a day or an exercise that
-- has been trained, but nothing in the database said it could not, and two foreign keys turned such
-- a delete into silent data loss:
--   - `session_sets.plan_exercise_id -> plan_exercises` ON DELETE CASCADE removed every set ever
--     recorded against an exercise.
--   - `sessions.plan_day_id -> plan_days` ON DELETE CASCADE removed the sessions themselves.
-- Both are repointed to ON DELETE NO ACTION, so a delete that would orphan history fails loudly
-- instead of succeeding quietly.
--
-- NO ACTION rather than RESTRICT, and the difference is load-bearing. RESTRICT is checked
-- immediately, row by row, and cannot be deferred. Deleting a whole plan is a legitimate operation
-- that must keep working, and it removes plan_days -> plan_exercises and sessions -> session_sets
-- within a single statement; under RESTRICT the check would fire while the referencing session_sets
-- rows still existed and abort a delete that is in fact valid. NO ACTION is checked at the end of
-- the statement, by which point the cascade has already removed everything that referenced the
-- deleted rows. The result is precisely the intended pair of behaviours: deleting a plan succeeds;
-- deleting one exercise that has history fails.
--
-- `sessions.plan_id -> plans` is deliberately left ON DELETE CASCADE. It is what makes deleting a
-- plan remove its sessions, and therefore what makes the paragraph above true.

-- Destructive-looking but non-destructive: dropping a foreign key constraint and immediately
-- recreating it over the same columns validates the existing rows and changes only the delete action.
alter table "public"."session_sets"
    drop constraint if exists session_sets_plan_exercise_id_fkey;
alter table "public"."session_sets"
    add constraint session_sets_plan_exercise_id_fkey
    foreign key (plan_exercise_id) references "public"."plan_exercises"(id)
    on delete no action;

alter table "public"."sessions"
    drop constraint if exists sessions_plan_day_id_fkey;
alter table "public"."sessions"
    add constraint sessions_plan_day_id_fkey
    foreign key (plan_day_id) references "public"."plan_days"(id)
    on delete no action;

-- ========================================
-- PHASE 4: Teach replace_collection to leave archived rows alone
-- ========================================

-- `replace_collection` deletes by exclusion - every row of the parent collection whose id is absent
-- from the incoming payload is removed. That is correct while every row of a collection is something
-- the client holds, and it stops being correct the moment a row can be archived (PHASE 2): an
-- archived day or exercise is deliberately not in the payload the editor sends, so the next reorder
-- would hard-delete it. After PHASE 3 that delete fails loudly on a foreign key rather than
-- destroying history quietly, which turns the bug from data loss into a 500 on an ordinary reorder -
-- better, but still broken.
--
-- The order-normalisation phase has the same problem from the other direction: it negates
-- `order_index` for every row of the collection, and only the rows in the payload are written back
-- with their new values, so an archived row would be left with a permanently negative index.
--
-- This adds an optional `p_active_only_column`, following the extension pattern `p_scope_column`
-- established in 20260719084500. When supplied, `AND <column> IS NULL` is appended to the same
-- `scope_predicate` the function already threads through all three phases, so the delete, the
-- negation and the select-back agree on what the collection contains - which is what that predicate
-- exists to guarantee. Callers that pass nothing are entirely unaffected.
--
-- As in 20260719084500, the previous overload must be dropped rather than replaced. Adding a
-- defaulted parameter creates a new signature, so `create or replace` would leave the 7-argument
-- version in place - still callable, and ambiguous for PostgREST's named-argument dispatch.

drop function if exists public.replace_collection(text, text, uuid, text, jsonb, text, uuid);

create or replace function replace_collection(
    p_table_name text,
    p_parent_column text,
    p_parent_id uuid,
    p_order_column text,
    p_records jsonb,
    p_scope_column text default null,
    p_scope_id uuid default null,
    p_active_only_column text default null
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

    -- Soft-deleted rows are not part of the collection the caller is replacing. They are absent from
    -- the payload by design, so without this they would be deleted by exclusion in phase 1 and left
    -- with a negated order_index by phase 2. Appending to the same predicate rather than to the
    -- individual statements is what keeps all three phases in agreement.
    if p_active_only_column is not null then
        scope_predicate := scope_predicate || format(' AND %I IS NULL', p_active_only_column);
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
        -- This handles scenarios like order swapping where unique constraints would be violated.
        -- The offset negates the current value rather than adding a fixed amount: order columns are
        -- 1-based, so a negated value can never collide with an incoming one, regardless of how
        -- large the collection is. (A previous `+ 100` offset collided once a collection exceeded
        -- 100 items, because item 101 landed on shifted item 1.)
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

-- Forward the new parameter from the batch wrapper.
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
    active_only_column text;
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
        active_only_column := operation->>'active_only_column';
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
            scope_id,
            active_only_column
        );
    end loop;
end;
$$;

-- The signature changed, so the grants from 20260719084500 do not carry over: a newly created
-- function gets the default blanket EXECUTE to PUBLIC again.
revoke execute on function public.replace_collection(text, text, uuid, text, jsonb, text, uuid, text) from public, anon;
grant execute on function public.replace_collection(text, text, uuid, text, jsonb, text, uuid, text) to authenticated, service_role;

comment on function replace_collection(text, text, uuid, text, jsonb, text, uuid, text) is
'Generic function supporting two modes: 1) Collection replacement when parent_column and parent_id are provided (deletes items not in new collection and upserts all provided items), 2) Upsert-only mode when parent_column or parent_id is null (only upserts without deletions). An optional scope_column/scope_id pair narrows the collection further, for compound keys such as a session''s sets for one plan exercise. An optional active_only_column names a nullable timestamp whose non-null rows are soft-deleted and therefore excluded from the collection entirely, so they are neither deleted by exclusion nor caught by the order normalization. Optional order_column parameter handles unique constraint conflicts during order swapping by temporarily negating existing values. Runs as security invoker, so the caller''s RLS policies apply, and only accepts the whitelisted collection tables. Returns the updated records.';

comment on function replace_collections_batch(jsonb) is
'Batch version of replace_collection that processes multiple operations in a single transaction. Automatically detects mode based on presence of parent_column and parent_id, and forwards optional scope_column/scope_id and active_only_column. Input format: [{"table_name": "...", "parent_column": "..." (optional), "parent_id": "..." (optional), "scope_column": "..." (optional), "scope_id": "..." (optional), "active_only_column": "..." (optional), "records": [...]}]. Runs as security invoker and inherits replace_collection''s table whitelist. Returns void.';
