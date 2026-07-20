-- Migration: Preserve the timezone when patching a session set's completed_at
-- Description: `patch_session_set` cast the incoming value with `::timestamp`, which parses an ISO
--   string like `2026-07-20T10:00:00.000Z` and then *discards* the `Z`. Assigning that
--   timezone-naive value to the `timestamptz` column reinterprets the wall-clock reading in the
--   database session's timezone, so the instant recorded is wrong by that offset. It happens to be
--   correct today only because the database runs at UTC - the bug is invisible until it is not.
--
--   `::timestamptz` parses the offset that is already in the string, which is what the column
--   stores. Every other timestamp in the schema is written this way.
--
--   Special consideration: this replaces the function body only. The signature, the row lock, the
--   sentinel errors and the grants from migration 20260720093000 are unchanged; the grants are
--   re-applied below because `create or replace` leaves them intact but a future drop would not.
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
        -- timestamptz, not timestamp: the client sends an ISO instant with an offset, and casting
        -- to a naive timestamp throws that offset away.
        completed_at = case when p_updates ? 'completed_at' then (p_updates->>'completed_at')::timestamptz else t.completed_at end
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
