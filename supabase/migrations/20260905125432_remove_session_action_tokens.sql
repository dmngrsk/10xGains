-- Migration: Remove session action tokens
-- Description: Reverts the session action token work from 20260905092620. Completing a set from a
--   notification could not be made to work on Android - Chrome never dispatched the action to the
--   service worker, so the request was never made - and the notification is now a read-only surface
--   with a link back into the session. The credential it existed to carry has no remaining use.
--
--   This is a migration rather than a deleted file because the original was already applied to an
--   environment. Dropping the table alone would leave `complete_session` referencing a table that no
--   longer exists, so both functions are restored to their pre-token definitions first, in order.
--
--   Affected: drops `session_action_tokens` and `complete_session_set_with_action_token`; restores
--   `patch_session_set` (back to `security invoker`) and `complete_session`; drops
--   `internal_patch_session_set`, which existed only so the token path could share them.
--
--   On a database that never had the original migration every statement here is a no-op or an
--   identical redefinition, so it is safe to apply anywhere.
-- Author: AI Assistant
-- Created: 2026-09-05

-- Dropped first: nothing else may call it once the shared implementation goes.
drop function if exists public.complete_session_set_with_action_token(text, uuid, uuid);

-- Restored to the definition from 20260720093000, before it became a wrapper. Back to
-- `security invoker`, so RLS decides which session and set the caller can see, and the caller no
-- longer needs the internal function to exist at all.
create or replace function patch_session_set(
    p_session_id uuid,
    p_set_id uuid,
    p_updates jsonb
)
returns jsonb
language plpgsql
set search_path = ''
security invoker
as $$
declare
    session_status text;
    updated_set jsonb;
begin
    -- Lock the session for the duration of the transaction. RLS restricts this to the caller's own
    -- sessions, so a missing row means "not found or not yours" - the same 404 either way.
    select status into session_status
    from public.sessions
    where id = p_session_id
    for update;

    if session_status is null then
        raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
    end if;

    if session_status = 'COMPLETED' then
        raise exception 'SESSION_COMPLETED' using errcode = 'P0001';
    end if;

    -- Starting to record sets is what moves a session from PENDING to IN_PROGRESS, and stamps the
    -- moment training actually began.
    if session_status = 'PENDING' then
        update public.sessions
        set status = 'IN_PROGRESS',
            session_date = timezone('utc', now())
        where id = p_session_id;
    end if;

    -- Only the columns a patch is allowed to touch are applied, and each is left alone unless the
    -- caller actually supplied it, so a partial patch cannot blank a field by omission.
    update public.session_sets t
    set status = case when p_updates ? 'status' then (p_updates->>'status')::varchar else t.status end,
        actual_reps = case when p_updates ? 'actual_reps' then (p_updates->>'actual_reps')::smallint else t.actual_reps end,
        actual_weight = case when p_updates ? 'actual_weight' then (p_updates->>'actual_weight')::numeric else t.actual_weight end,
        expected_reps = case when p_updates ? 'expected_reps' then (p_updates->>'expected_reps')::integer else t.expected_reps end,
        set_index = case when p_updates ? 'set_index' then (p_updates->>'set_index')::smallint else t.set_index end,
        -- Parse the offset the client sent, then reduce to the UTC wall clock the naive column stores.
        completed_at = case when p_updates ? 'completed_at' then (p_updates->>'completed_at')::timestamptz at time zone 'utc' else t.completed_at end
    where t.id = p_set_id
      and t.session_id = p_session_id
    returning to_jsonb(t.*) into updated_set;

    if updated_set is null then
        raise exception 'SESSION_SET_NOT_FOUND' using errcode = 'P0002';
    end if;

    return updated_set;
end;
$$;

revoke execute on function public.patch_session_set(uuid, uuid, jsonb) from public, anon;
grant execute on function public.patch_session_set(uuid, uuid, jsonb) to authenticated, service_role;

comment on function patch_session_set(uuid, uuid, jsonb) is
'Atomically applies a partial update to a session set: locks the parent session, rejects a completed one, promotes a PENDING session to IN_PROGRESS, and updates only the supplied columns. Runs as security invoker, so RLS governs which rows are visible. Raises SESSION_NOT_FOUND / SESSION_SET_NOT_FOUND (P0002) or SESSION_COMPLETED (P0001).';

-- Restored to the definition from 20260720110000, dropping the token revocation at the end. This
-- has to happen before the table goes, or the function would reference a table that is not there.
create or replace function complete_session(
    p_session_id uuid,
    p_operations jsonb
)
returns void
language plpgsql
set search_path = ''
security invoker
as $$
declare
    session_status text;
begin
    -- Lock the session for the duration of the transaction. RLS restricts this to the caller's own
    -- sessions, so a missing row means "not found or not yours" - the same 404 either way.
    select status into session_status
    from public.sessions
    where id = p_session_id
    for update;

    if session_status is null then
        raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
    end if;

    -- Re-checked under the lock rather than trusted from the caller's earlier read. This is the
    -- whole point of the function: the API's assertion happened before the progressions were
    -- computed, and a competing completion could have landed in between.
    if session_status <> 'IN_PROGRESS' then
        raise exception 'SESSION_NOT_IN_PROGRESS' using errcode = 'P0001';
    end if;

    -- The batch carries the session's own row with status COMPLETED, so the write that releases
    -- the next caller from the lock is the one that makes it fail the check above.
    perform public.replace_collections_batch(p_operations);
end;
$$;

revoke execute on function public.complete_session(uuid, jsonb) from public, anon;
grant execute on function public.complete_session(uuid, jsonb) to authenticated, service_role;

comment on function complete_session(uuid, jsonb) is
'Atomically completes a training session: locks the session row, re-verifies under the lock that it is still IN_PROGRESS, then applies the supplied replace_collections_batch operations. Serialises concurrent completions against each other and against patch_session_set, which takes the same lock. Runs as security invoker, so RLS governs which rows are visible. Raises SESSION_NOT_FOUND (P0002) or SESSION_NOT_IN_PROGRESS (P0001).';

-- Nothing calls it now that both entry points carry their own implementation again.
drop function if exists public.internal_patch_session_set(uuid, uuid, uuid, jsonb);

-- Last: no function references it any more. The tokens it held are unusable regardless, since the
-- endpoint that spent them is gone.
drop table if exists public.session_action_tokens;
