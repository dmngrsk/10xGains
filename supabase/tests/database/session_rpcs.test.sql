/*
 * pgTAP tests for the atomic session RPCs added alongside the collection-function hardening:
 *   - patch_session_set(uuid, uuid, jsonb)
 *   - complete_session(uuid, jsonb)
 *   - create_session(uuid, uuid[], jsonb)
 *
 * Unlike replace_collection, these functions read the real `sessions` / `session_sets` tables by
 * name and (for create_session) call auth.uid() directly, so they cannot be exercised against
 * ephemeral tables as a superuser. Instead this suite seeds a throwaway auth user and a minimal plan
 * as the owner, then runs the assertions as that authenticated user (set role + a jwt-claims stub),
 * which is what makes auth.uid() resolve and RLS apply - the context these `security invoker`
 * functions are written for. Everything is inside begin/rollback, so nothing persists.
 *
 * Note: the concurrency these functions guard against (the row lock in patch/complete, the advisory
 * lock in create) cannot be reproduced from a single pgTAP connection. What is covered here is the
 * deterministic, single-caller behaviour: the status transitions, the sentinel errors, and - for
 * create_session - the stale-outstanding-set check that the advisory lock exists to make reliable.
 */

begin;

select plan(18);

-- ============================================================================
-- SETUP: a user, a plan they own, and a few sessions in known states (superuser)
-- ============================================================================

-- Fixed ids so the assertions can reference them. Only auth.users.id is required; every other
-- column on it is nullable or defaulted.
insert into auth.users (id) values ('000000aa-0000-0000-0000-000000000001');

insert into public.exercises (id, name)
  values ('000000bb-0000-0000-0000-000000000001', 'Squat');

insert into public.plans (id, user_id, name)
  values ('000000cc-0000-0000-0000-000000000001', '000000aa-0000-0000-0000-000000000001', 'RPC Test Plan');

insert into public.plan_days (id, plan_id, name, order_index)
  values ('000000dd-0000-0000-0000-000000000001', '000000cc-0000-0000-0000-000000000001', 'Day 1', 1);

insert into public.plan_exercises (id, plan_day_id, exercise_id, order_index)
  values ('000000ee-0000-0000-0000-000000000001', '000000dd-0000-0000-0000-000000000001', '000000bb-0000-0000-0000-000000000001', 1);

-- S1: PENDING session with one PENDING set - drives the patch happy path, then completion.
insert into public.sessions (id, user_id, plan_id, plan_day_id, status)
  values ('000000f1-0000-0000-0000-000000000001', '000000aa-0000-0000-0000-000000000001', '000000cc-0000-0000-0000-000000000001', '000000dd-0000-0000-0000-000000000001', 'PENDING');
insert into public.session_sets (id, session_id, plan_exercise_id, set_index, actual_weight, expected_reps, status)
  values ('000000f1-0000-0000-0000-000000001001', '000000f1-0000-0000-0000-000000000001', '000000ee-0000-0000-0000-000000000001', 1, 100, 5, 'PENDING');

-- S2: a second PENDING session - stays open, so it is the "outstanding" set create_session must see.
insert into public.sessions (id, user_id, plan_id, plan_day_id, status)
  values ('000000f2-0000-0000-0000-000000000002', '000000aa-0000-0000-0000-000000000001', '000000cc-0000-0000-0000-000000000001', '000000dd-0000-0000-0000-000000000001', 'PENDING');

-- S3: an already COMPLETED session with a set - the terminal state patch must refuse.
insert into public.sessions (id, user_id, plan_id, plan_day_id, status)
  values ('000000f3-0000-0000-0000-000000000003', '000000aa-0000-0000-0000-000000000001', '000000cc-0000-0000-0000-000000000001', '000000dd-0000-0000-0000-000000000001', 'COMPLETED');
insert into public.session_sets (id, session_id, plan_exercise_id, set_index, actual_weight, expected_reps, status)
  values ('000000f3-0000-0000-0000-000000001003', '000000f3-0000-0000-0000-000000000003', '000000ee-0000-0000-0000-000000000001', 1, 100, 5, 'COMPLETED');

-- Become the owner. auth.uid() now resolves to their id, and every statement below is under RLS.
set local role authenticated;
set local request.jwt.claims = '{"sub":"000000aa-0000-0000-0000-000000000001"}';

-- ============================================================================
-- patch_session_set
-- ============================================================================

select throws_ok(
  $$ select patch_session_set('000000f0-0000-0000-0000-00000000ffff', '000000f1-0000-0000-0000-000000001001', '{"status":"PENDING"}'::jsonb) $$,
  'P0002', 'SESSION_NOT_FOUND',
  'patch_session_set rejects a session that does not exist or is not the caller''s'
);

select throws_ok(
  $$ select patch_session_set('000000f1-0000-0000-0000-000000000001', '000000f0-0000-0000-0000-00000000ffff', '{"status":"PENDING"}'::jsonb) $$,
  'P0002', 'SESSION_SET_NOT_FOUND',
  'patch_session_set rejects a set that does not belong to the session'
);

select throws_ok(
  $$ select patch_session_set('000000f3-0000-0000-0000-000000000003', '000000f3-0000-0000-0000-000000001003', '{"status":"PENDING"}'::jsonb) $$,
  'P0001', 'SESSION_COMPLETED',
  'patch_session_set refuses to touch a set on a COMPLETED session'
);

select is(
  (select status from public.sessions where id = '000000f1-0000-0000-0000-000000000001'),
  'PENDING',
  'S1 starts PENDING, before any set is recorded'
);

select is(
  patch_session_set('000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001001',
    '{"status":"COMPLETED","actual_reps":5,"completed_at":"2026-07-20T10:00:00.000Z"}'::jsonb) ->> 'status',
  'COMPLETED',
  'patch_session_set returns the updated set with its new status'
);

select is(
  (select status from public.sessions where id = '000000f1-0000-0000-0000-000000000001'),
  'IN_PROGRESS',
  'recording the first set promotes a PENDING session to IN_PROGRESS'
);

select ok(
  (select session_date is not null from public.sessions where id = '000000f1-0000-0000-0000-000000000001'),
  'the promotion also stamps session_date'
);

select is(
  (select completed_at from public.session_sets where id = '000000f1-0000-0000-0000-000000001001'),
  '2026-07-20 10:00:00'::timestamp,
  'completed_at stores the UTC instant the client sent, not a timezone-shifted one'
);

select is(
  patch_session_set('000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001001',
    '{"actual_reps":3}'::jsonb) ->> 'status',
  'COMPLETED',
  'a partial patch leaves the columns it does not mention untouched'
);

select is(
  (select actual_reps from public.session_sets where id = '000000f1-0000-0000-0000-000000001001'),
  3::smallint,
  'the partial patch still applies the column it does supply'
);

-- ============================================================================
-- complete_session
-- ============================================================================

select throws_ok(
  $$ select complete_session('000000f0-0000-0000-0000-00000000ffff', '[]'::jsonb) $$,
  'P0002', 'SESSION_NOT_FOUND',
  'complete_session rejects a session that does not exist or is not the caller''s'
);

select throws_ok(
  $$ select complete_session('000000f2-0000-0000-0000-000000000002', '[]'::jsonb) $$,
  'P0001', 'SESSION_NOT_IN_PROGRESS',
  'complete_session refuses a session that is not IN_PROGRESS'
);

select is(
  (select status from public.sessions where id = '000000f1-0000-0000-0000-000000000001'),
  'IN_PROGRESS',
  'S1 is IN_PROGRESS and therefore completable'
);

select lives_ok(
  $$ select complete_session('000000f1-0000-0000-0000-000000000001',
       '[{"table_name":"sessions","records":[{"id":"000000f1-0000-0000-0000-000000000001","user_id":"000000aa-0000-0000-0000-000000000001","plan_id":"000000cc-0000-0000-0000-000000000001","plan_day_id":"000000dd-0000-0000-0000-000000000001","status":"COMPLETED"}]}]'::jsonb) $$,
  'complete_session applies the batch for an IN_PROGRESS session'
);

select is(
  (select status from public.sessions where id = '000000f1-0000-0000-0000-000000000001'),
  'COMPLETED',
  'the batch flips the session to COMPLETED'
);

-- ============================================================================
-- create_session
-- ============================================================================
-- Outstanding sessions for this user and plan are now exactly {S2}: S1 and S3 are COMPLETED.

select throws_ok(
  $$ select create_session('000000cc-0000-0000-0000-000000000001'::uuid, '{}'::uuid[],
       '[{"table_name":"sessions","records":[{"id":"000000f9-0000-0000-0000-000000000009","user_id":"000000aa-0000-0000-0000-000000000001","plan_id":"000000cc-0000-0000-0000-000000000001","plan_day_id":"000000dd-0000-0000-0000-000000000001","status":"PENDING"}]}]'::jsonb) $$,
  'P0001', 'SESSION_CREATE_CONFLICT',
  'create_session refuses the write when the outstanding set it was given is stale'
);

select lives_ok(
  $$ select create_session('000000cc-0000-0000-0000-000000000001'::uuid, array['000000f2-0000-0000-0000-000000000002']::uuid[],
       '[{"table_name":"sessions","records":[
           {"id":"000000f2-0000-0000-0000-000000000002","user_id":"000000aa-0000-0000-0000-000000000001","plan_id":"000000cc-0000-0000-0000-000000000001","plan_day_id":"000000dd-0000-0000-0000-000000000001","status":"CANCELLED"},
           {"id":"000000f9-0000-0000-0000-000000000009","user_id":"000000aa-0000-0000-0000-000000000001","plan_id":"000000cc-0000-0000-0000-000000000001","plan_day_id":"000000dd-0000-0000-0000-000000000001","status":"PENDING"}
         ]}]'::jsonb) $$,
  'create_session applies the write when the outstanding set matches reality'
);

select is(
  (select status from public.sessions where id = '000000f9-0000-0000-0000-000000000009'),
  'PENDING',
  'the new session was created'
);

-- ============================================================================
-- FINALIZE
-- ============================================================================

reset role;
select * from finish();

rollback;
