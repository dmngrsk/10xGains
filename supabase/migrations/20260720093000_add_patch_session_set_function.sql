-- Migration: Add an atomic session-set patch function
-- Description: Patching a set (complete / fail / reset) used to be three independent statements from
--   the API: read the session to check its status, update the session PENDING -> IN_PROGRESS, then
--   update the set. Nothing tied them together, so a concurrent POST /sessions/:id/complete landing
--   between the check and the write updated a set on an already-completed session, and a set update
--   that failed left the session IN_PROGRESS with a session_date and nothing else done.
--
--   This function performs the whole transition in a single statement, and takes a row lock on the
--   session (`for update`) so a concurrent completion has to wait rather than interleave.
--
--   Special consideration: `security invoker`, so RLS decides which session and set the caller can
--   see - the function adds atomicity, not privilege. The lock is taken on the session row, which is
--   the resource both this function and session completion contend for.
--
--   Timestamp handling: `completed_at` and `session_date` are `timestamp without time zone` columns
--   that the application reads back as UTC. The client sends `completed_at` as an ISO instant with an
--   offset (e.g. `...Z`), so it is cast with `::timestamptz at time zone 'utc'`: the `::timestamptz`
--   parses the offset that is in the string, and `at time zone 'utc'` reduces it to the UTC wall
--   clock the column stores - independent of the database session's timezone. (A bare `::timestamp`
--   would silently drop the offset, and a bare `::timestamptz` assigned to a naive column would be
--   re-interpreted in the session timezone; both are only correct while the server happens to run at
--   UTC.) `session_date` is written the same way via `timezone('utc', now())`.
-- Author: AI Assistant
-- Created: 2026-07-20

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

-- Same lockdown as the collection functions: no blanket EXECUTE for anonymous callers.
revoke execute on function public.patch_session_set(uuid, uuid, jsonb) from public, anon;
grant execute on function public.patch_session_set(uuid, uuid, jsonb) to authenticated, service_role;

comment on function patch_session_set(uuid, uuid, jsonb) is
'Atomically applies a partial update to a session set: locks the parent session, rejects a completed one, promotes a PENDING session to IN_PROGRESS, and updates only the supplied columns. Runs as security invoker, so RLS governs which rows are visible. Raises SESSION_NOT_FOUND / SESSION_SET_NOT_FOUND (P0002) or SESSION_COMPLETED (P0001).';
