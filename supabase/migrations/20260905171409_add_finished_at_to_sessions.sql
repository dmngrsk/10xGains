-- Migration: Record when a session finished
-- Description: `sessions` has only ever carried `session_date`, the moment training *started* (the
--   first set to be recorded stamps it). When a session ended was never stored: the UI inferred it
--   by taking the latest `completed_at` across the session's sets, which costs a join wherever a
--   session's duration is shown, and is wrong whenever the sets are not the last thing that
--   happened - a session finished after a rest, or one closed at a time the user typed in.
--
--   This adds `finished_at` and backfills it from exactly the inference the clients were making, so
--   existing history reads identically before and after.
--
--   Special consideration: like every other timestamp here, `finished_at` is `timestamp without
--   time zone` holding UTC (see migration 20260720093000 on how the API writes these). It stays
--   null until a session is completed, and a cancelled session never gets one - it was abandoned,
--   not finished.
-- Author: AI Assistant
-- Created: 2026-09-05

-- The column itself. Nullable by necessity: PENDING and IN_PROGRESS sessions have not finished,
-- and CANCELLED ones never will.
alter table public.sessions
    add column if not exists finished_at timestamp without time zone null;

comment on column public.sessions.finished_at is
'When training ended, in UTC. Null until the session is completed; a cancelled session never gets one. Set from the client-supplied end when a session is finished at a chosen time, otherwise from the moment the completion was requested. Always at or after session_date.';

-- Backfill: the latest recorded set is what the clients treated as the end, so history keeps the
-- times it has always shown. `greatest` guards the pathological row whose sets predate its own
-- start, which the check constraint below would otherwise reject; `coalesce` covers a completed
-- session whose sets carry no timestamps at all.
update public.sessions s
set finished_at = coalesce(
    greatest(
        (select max(ss.completed_at) from public.session_sets ss where ss.session_id = s.id),
        s.session_date
    ),
    s.session_date
)
where s.status = 'COMPLETED'
  and s.finished_at is null;

-- A session cannot finish before it started. Written as a constraint rather than left to the
-- application because both writers of this column (the completion path and this backfill) derive
-- it from other timestamps, and a silent inversion would surface as a negative duration in the UI.
alter table public.sessions
    add constraint sessions_finished_at_after_session_date
    check (finished_at is null or session_date is null or finished_at >= session_date);
