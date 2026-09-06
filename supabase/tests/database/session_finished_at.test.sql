/*
 * pgTAP tests for `sessions.finished_at`, added in migration 20260905171409.
 *
 * Two things are worth pinning down here rather than leaving to the API's own tests: the check
 * constraint that keeps a session from finishing before it started, and the shape of the backfill
 * that migration ran - the inference every client used to make in its own code (the latest
 * recorded set, falling back to the session's start). The backfill itself cannot be re-run against
 * already-migrated rows, so it is reproduced verbatim here over freshly seeded rows in the states
 * it had to handle.
 *
 * Everything is inside begin/rollback, so nothing persists.
 */

begin;

select plan(6);

-- ============================================================================
-- SETUP: a user, a minimal plan, and completed sessions in the states the backfill had to cover
-- ============================================================================

insert into auth.users (id) values ('000000fa-0000-0000-0000-000000000001');

insert into public.exercises (id, name)
  values ('000000fb-0000-0000-0000-000000000001', 'Squat');

insert into public.plans (id, user_id, name)
  values ('000000fc-0000-0000-0000-000000000001', '000000fa-0000-0000-0000-000000000001', 'Finished At Test Plan');

insert into public.plan_days (id, plan_id, name, order_index)
  values ('000000fd-0000-0000-0000-000000000001', '000000fc-0000-0000-0000-000000000001', 'Day 1', 1);

insert into public.plan_exercises (id, plan_day_id, exercise_id, order_index)
  values ('000000fe-0000-0000-0000-000000000001', '000000fd-0000-0000-0000-000000000001', '000000fb-0000-0000-0000-000000000001', 1);

-- S1: completed, with recorded sets - the ordinary case.
insert into public.sessions (id, user_id, plan_id, plan_day_id, status, session_date)
  values ('000000ff-0000-0000-0000-000000000001', '000000fa-0000-0000-0000-000000000001',
          '000000fc-0000-0000-0000-000000000001', '000000fd-0000-0000-0000-000000000001',
          'COMPLETED', '2026-06-01 18:00:00');

insert into public.session_sets (session_id, plan_exercise_id, set_index, expected_weight, expected_reps, actual_weight, actual_reps, status, completed_at)
  values ('000000ff-0000-0000-0000-000000000001', '000000fe-0000-0000-0000-000000000001', 1, 100, 5, 100, 5, 'COMPLETED', '2026-06-01 18:20:00'),
         ('000000ff-0000-0000-0000-000000000001', '000000fe-0000-0000-0000-000000000001', 2, 100, 5, 100, 5, 'COMPLETED', '2026-06-01 19:25:00'),
         ('000000ff-0000-0000-0000-000000000001', '000000fe-0000-0000-0000-000000000001', 3, 100, 5, 100, 5, 'SKIPPED', null);

-- S2: completed, but no set carries a timestamp - the fallback case.
insert into public.sessions (id, user_id, plan_id, plan_day_id, status, session_date)
  values ('000000ff-0000-0000-0000-000000000002', '000000fa-0000-0000-0000-000000000001',
          '000000fc-0000-0000-0000-000000000001', '000000fd-0000-0000-0000-000000000001',
          'COMPLETED', '2026-06-03 18:00:00');

insert into public.session_sets (session_id, plan_exercise_id, set_index, expected_weight, expected_reps, actual_weight, actual_reps, status, completed_at)
  values ('000000ff-0000-0000-0000-000000000002', '000000fe-0000-0000-0000-000000000001', 1, 100, 5, 100, 0, 'SKIPPED', null);

-- S3: still in progress - nothing to backfill.
insert into public.sessions (id, user_id, plan_id, plan_day_id, status, session_date)
  values ('000000ff-0000-0000-0000-000000000003', '000000fa-0000-0000-0000-000000000001',
          '000000fc-0000-0000-0000-000000000001', '000000fd-0000-0000-0000-000000000001',
          'IN_PROGRESS', '2026-06-04 18:00:00');

-- ============================================================================
-- The check constraint
-- ============================================================================

select lives_ok(
  $$ update public.sessions set finished_at = '2026-06-01 19:30:00'
     where id = '000000ff-0000-0000-0000-000000000001' $$,
  'a finish after the session start is accepted'
);

select throws_ok(
  $$ update public.sessions set finished_at = '2026-06-01 17:59:00'
     where id = '000000ff-0000-0000-0000-000000000001' $$,
  '23514',
  null,
  'a finish before the session start is rejected by the check constraint'
);

select lives_ok(
  $$ update public.sessions set finished_at = null
     where id = '000000ff-0000-0000-0000-000000000001' $$,
  'a session with no recorded finish is accepted, which is every unfinished one'
);

-- ============================================================================
-- The backfill, reproduced over the rows above
-- ============================================================================

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

select is(
  (select finished_at from public.sessions where id = '000000ff-0000-0000-0000-000000000001'),
  '2026-06-01 19:25:00'::timestamp,
  'the backfill takes the latest recorded set as the finish'
);

select is(
  (select finished_at from public.sessions where id = '000000ff-0000-0000-0000-000000000002'),
  '2026-06-03 18:00:00'::timestamp,
  'a completed session whose sets carry no timestamps falls back to its own start'
);

select is(
  (select finished_at from public.sessions where id = '000000ff-0000-0000-0000-000000000003'),
  null::timestamp,
  'a session that has not finished is left alone'
);

select * from finish();
rollback;
