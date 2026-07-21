-- Migration: Add an atomic session completion function
-- Description: Completing a session used to be a read-modify-write spread across the API: read the
--   session and assert it is IN_PROGRESS, compute the weight progressions in JavaScript, then write
--   everything through `replace_collections_batch`. Nothing held the session between the check and
--   the write, so two concurrent completions - a double tap, a retry after a timeout, two open tabs -
--   both passed the assertion and both applied the progressions. The plan's target weights advanced
--   twice for one workout, and the batch never rechecked that the session was still in progress.
--
--   `patch_session_set` (migration 20260720093000) already closed the patch-vs-complete race with a
--   row lock on the session. This closes the complete-vs-complete one the same way: take the same
--   lock, re-verify the status *inside* the transaction, and only then apply the batch. The second
--   caller blocks on the lock, then sees the COMPLETED status the first one wrote and is rejected.
--
--   Special consideration: `security invoker`, so RLS decides which session the caller can lock and
--   which rows the batch may touch - this adds atomicity, not privilege. The lock is taken on the
--   session row, the same resource `patch_session_set` contends for, so the two serialise against
--   each other rather than only against themselves.
-- Author: AI Assistant
-- Created: 2026-07-20

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

-- Same lockdown as the other collection functions: no blanket EXECUTE for anonymous callers.
revoke execute on function public.complete_session(uuid, jsonb) from public, anon;
grant execute on function public.complete_session(uuid, jsonb) to authenticated, service_role;

comment on function complete_session(uuid, jsonb) is
'Atomically completes a training session: locks the session row, re-verifies under the lock that it is still IN_PROGRESS, then applies the supplied replace_collections_batch operations. Serialises concurrent completions against each other and against patch_session_set, which takes the same lock. Runs as security invoker, so RLS governs which rows are visible. Raises SESSION_NOT_FOUND (P0002) or SESSION_NOT_IN_PROGRESS (P0001).';
