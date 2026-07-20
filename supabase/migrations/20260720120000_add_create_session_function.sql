-- Migration: Add a serialised session creation function
-- Description: Creating a session is a read-modify-write: the API reads the outstanding
--   (PENDING / IN_PROGRESS) sessions for a plan, decides in JavaScript which plan day comes next
--   and which sessions to cancel, then writes the cancellations and the new session together.
--   Nothing held the user's sessions between the read and the write, so two concurrent creates -
--   two tabs, a double tap, a retry after a timeout - each saw the other's session as not yet
--   existing, cancelled nothing, and both inserted a PENDING row. That breaks the "one open
--   session per plan" invariant the surrounding code works hard to preserve. It self-heals on the
--   next create, but until then the home screen offers two open workouts.
--
--   This wraps the write in a transaction-scoped advisory lock keyed on (user, plan), and
--   re-reads the outstanding sessions under that lock. If the set differs from what the caller
--   based its decisions on, those decisions are stale - the plan day and the cancellation list
--   were computed against a world that no longer exists - so the write is refused rather than
--   applied. The API retries, and the retry sees the first caller's session and cancels it, which
--   is exactly the sequential outcome.
--
--   An advisory lock is used rather than a row lock because there is no single row representing
--   "this user's sessions for this plan" to take one on; locking the plan row instead would make
--   starting a workout contend with editing the plan.
--
--   Special consideration: `security invoker`, so RLS decides which sessions the caller can see
--   and write - this adds serialisation, not privilege. The advisory key includes auth.uid(), so
--   users never contend with each other.
-- Author: AI Assistant
-- Created: 2026-07-20

create or replace function create_session(
    p_plan_id uuid,
    p_outstanding_session_ids uuid[],
    p_operations jsonb
)
returns void
language plpgsql
set search_path = ''
security invoker
as $$
declare
    observed_ids uuid[];
    current_ids uuid[];
begin
    -- Held until the transaction ends, so the re-read below and the write that follows it cannot
    -- be interleaved by another creation for the same user and plan.
    perform pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':' || p_plan_id::text, 0));

    select coalesce(array_agg(id order by id), '{}'::uuid[])
    into current_ids
    from public.sessions
    where user_id = auth.uid()
      and plan_id = p_plan_id
      and status in ('PENDING', 'IN_PROGRESS');

    -- Sorted the same way, so the comparison is over the set rather than the caller's ordering.
    select coalesce(array_agg(id order by id), '{}'::uuid[])
    into observed_ids
    from pg_catalog.unnest(coalesce(p_outstanding_session_ids, '{}'::uuid[])) as id;

    if current_ids is distinct from observed_ids then
        raise exception 'SESSION_CREATE_CONFLICT' using errcode = 'P0001';
    end if;

    perform public.replace_collections_batch(p_operations);
end;
$$;

-- Same lockdown as the other collection functions: no blanket EXECUTE for anonymous callers.
revoke execute on function public.create_session(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.create_session(uuid, uuid[], jsonb) to authenticated, service_role;

comment on function create_session(uuid, uuid[], jsonb) is
'Atomically creates a training session: serialises on a (user, plan) advisory lock, re-reads the outstanding sessions under it, and refuses the write when they differ from the set the caller computed against. Preserves the "one open session per plan" invariant against concurrent creates. Runs as security invoker, so RLS governs which rows are visible. Raises SESSION_CREATE_CONFLICT (P0001).';
