/*
 * pgTAP tests for the session action token path added in 20260905092620:
 *   - complete_session_set_with_action_token(text, uuid, uuid)
 *   - internal_patch_session_set(uuid, uuid, uuid, jsonb) - reachability only
 *   - complete_session(uuid, jsonb) - token revocation
 *
 * The function exists to run for a caller with no JWT, so most of it is exercised as `anon`, the
 * role a service worker's request arrives under; seeding is done as superuser first.
 *
 * The property under test is narrowness: a token completes one set in one session for one user, and
 * every way of holding the wrong token fails identically. The privilege check on
 * internal_patch_session_set matters as much - it takes the owning user id as an argument.
 */

begin;

select plan(18);

-- ============================================================================
-- SETUP (superuser)
-- ============================================================================

insert into auth.users (id) values
  ('000000aa-0000-0000-0000-000000000001'),
  ('000000aa-0000-0000-0000-000000000002');

insert into public.exercises (id, name) values
  ('000000bb-0000-0000-0000-000000000001', 'Bench Press'),
  ('000000bb-0000-0000-0000-000000000002', 'Squat');

insert into public.plans (id, user_id, name)
  values ('000000cc-0000-0000-0000-000000000001', '000000aa-0000-0000-0000-000000000001', 'Token Test Plan');

insert into public.plan_days (id, plan_id, name, order_index)
  values ('000000dd-0000-0000-0000-000000000001', '000000cc-0000-0000-0000-000000000001', 'Day 1', 1);

-- Two exercises, so "next pending set" has to order across them and not just within one.
insert into public.plan_exercises (id, plan_day_id, exercise_id, order_index) values
  ('000000ee-0000-0000-0000-000000000001', '000000dd-0000-0000-0000-000000000001', '000000bb-0000-0000-0000-000000000001', 1),
  ('000000ee-0000-0000-0000-000000000002', '000000dd-0000-0000-0000-000000000001', '000000bb-0000-0000-0000-000000000002', 2);

-- S1: the session under test - two bench sets, then one squat set.
insert into public.sessions (id, user_id, plan_id, plan_day_id, status)
  values ('000000f1-0000-0000-0000-000000000001', '000000aa-0000-0000-0000-000000000001', '000000cc-0000-0000-0000-000000000001', '000000dd-0000-0000-0000-000000000001', 'PENDING');
insert into public.session_sets (id, session_id, plan_exercise_id, set_index, actual_weight, expected_reps, expected_weight, status) values
  ('000000f1-0000-0000-0000-000000001001', '000000f1-0000-0000-0000-000000000001', '000000ee-0000-0000-0000-000000000001', 1, 60, 8, 60, 'PENDING'),
  ('000000f1-0000-0000-0000-000000001002', '000000f1-0000-0000-0000-000000000001', '000000ee-0000-0000-0000-000000000001', 2, 60, 8, 60, 'PENDING'),
  ('000000f1-0000-0000-0000-000000001003', '000000f1-0000-0000-0000-000000000001', '000000ee-0000-0000-0000-000000000002', 1, 100, 5, 100, 'PENDING');

-- S2: a session owned by the *other* user, used to prove a token cannot reach across owners.
insert into public.sessions (id, user_id, plan_id, plan_day_id, status)
  values ('000000f2-0000-0000-0000-000000000002', '000000aa-0000-0000-0000-000000000002', '000000cc-0000-0000-0000-000000000001', '000000dd-0000-0000-0000-000000000001', 'IN_PROGRESS');
insert into public.session_sets (id, session_id, plan_exercise_id, set_index, actual_weight, expected_reps, expected_weight, status)
  values ('000000f2-0000-0000-0000-000000001001', '000000f2-0000-0000-0000-000000000002', '000000ee-0000-0000-0000-000000000001', 1, 60, 8, 60, 'PENDING');

-- Tokens. Only the hash is stored, so each is seeded with the same expression the function uses.
insert into public.session_action_tokens (user_id, session_id, token_hash, expires_at) values
  ('000000aa-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000000001',
   encode(sha256(convert_to('valid-token', 'UTF8')), 'hex'), now() + interval '12 hours'),
  ('000000aa-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000000001',
   encode(sha256(convert_to('revoked-token', 'UTF8')), 'hex'), now() + interval '12 hours');

update public.session_action_tokens
set revoked_at = now()
where token_hash = encode(sha256(convert_to('revoked-token', 'UTF8')), 'hex');

-- An expired token has to satisfy the 12 hour ceiling relative to its own creation, so it is dated
-- back rather than simply given a past expiry.
insert into public.session_action_tokens (user_id, session_id, token_hash, created_at, expires_at)
  values ('000000aa-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000000001',
   encode(sha256(convert_to('expired-token', 'UTF8')), 'hex'),
   now() - interval '13 hours', now() - interval '1 hour');

-- A token whose owner does not own the session it names. Not reachable through the API, but it is
-- what the ownership filter inside the shared patch function exists to stop.
insert into public.session_action_tokens (user_id, session_id, token_hash, expires_at)
  values ('000000aa-0000-0000-0000-000000000001', '000000f2-0000-0000-0000-000000000002',
   encode(sha256(convert_to('wrong-owner-token', 'UTF8')), 'hex'), now() + interval '12 hours');

-- ============================================================================
-- Spending a token, as the roleless caller a service worker actually is
-- ============================================================================

set local role anon;

select throws_ok(
  $$ select complete_session_set_with_action_token('no-such-token', '000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001001') $$,
  'P0001', 'ACTION_TOKEN_INVALID',
  'an unknown token is rejected'
);

select throws_ok(
  $$ select complete_session_set_with_action_token('revoked-token', '000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001001') $$,
  'P0001', 'ACTION_TOKEN_INVALID',
  'a revoked token is rejected'
);

select throws_ok(
  $$ select complete_session_set_with_action_token('expired-token', '000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001001') $$,
  'P0001', 'ACTION_TOKEN_INVALID',
  'an expired token is rejected'
);

select throws_ok(
  $$ select complete_session_set_with_action_token('valid-token', '000000f2-0000-0000-0000-000000000002', '000000f2-0000-0000-0000-000000001001') $$,
  'P0001', 'ACTION_TOKEN_INVALID',
  'a token minted for one session cannot be spent on another'
);

-- The function hashes what it is given, so the stored hash is just an unknown token - which is what
-- makes a leak of the table useless on its own.
select throws_ok(
  format(
    $$ select complete_session_set_with_action_token(%L, '000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001001') $$,
    encode(sha256(convert_to('valid-token', 'UTF8')), 'hex')
  ),
  'P0001', 'ACTION_TOKEN_INVALID',
  'the stored hash is not itself a usable credential'
);

select throws_ok(
  $$ select complete_session_set_with_action_token('wrong-owner-token', '000000f2-0000-0000-0000-000000000002', '000000f2-0000-0000-0000-000000001001') $$,
  'P0002', 'SESSION_NOT_FOUND',
  'a token cannot reach a session its owner does not own'
);

-- ---------------------------------------------------------------------------
-- The happy path
-- ---------------------------------------------------------------------------

select is(
  complete_session_set_with_action_token('valid-token', '000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001001')
    -> 'set' ->> 'status',
  'COMPLETED',
  'spending a token completes the named set'
);

-- anon holds no grant on these tables, by design, so state assertions step back to the session role.
reset role;

select is(
  (select status from public.sessions where id = '000000f1-0000-0000-0000-000000000001'),
  'IN_PROGRESS',
  'completing the first set promotes the session, exactly as the authenticated path does'
);

select ok(
  (select completed_at is not null from public.session_sets where id = '000000f1-0000-0000-0000-000000001001'),
  'the completed set is stamped'
);

-- A set completed from a notification has to look identical to one completed in the app, or
-- progress and history read the two differently.
select is(
  (select actual_reps from public.session_sets where id = '000000f1-0000-0000-0000-000000001001'),
  8::smallint,
  'the completed set records the prescribed reps as performed, as the in-app path does'
);

set local role anon;

-- ---------------------------------------------------------------------------
-- What comes back for the notification to redraw itself
-- ---------------------------------------------------------------------------

select is(
  complete_session_set_with_action_token('valid-token', '000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001002')
    -> 'next_set' ->> 'exercise_name',
  'Squat',
  'the next set moves on to the following exercise once one is worked through'
);

select is(
  complete_session_set_with_action_token('valid-token', '000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001003')
    -> 'next_set',
  'null'::jsonb,
  'no next set is reported once every set is done'
);

reset role;

select is(
  (select status from public.session_sets where id = '000000f1-0000-0000-0000-000000001003'),
  'COMPLETED',
  'the same token completes each set in turn, rather than being single-use'
);

-- ---------------------------------------------------------------------------
-- A finished session refuses further spending
-- ---------------------------------------------------------------------------

update public.sessions set status = 'COMPLETED' where id = '000000f1-0000-0000-0000-000000000001';

set local role anon;

select throws_ok(
  $$ select complete_session_set_with_action_token('valid-token', '000000f1-0000-0000-0000-000000000001', '000000f1-0000-0000-0000-000000001001') $$,
  'P0001', 'SESSION_COMPLETED',
  'a token is worthless once the session it belongs to is closed'
);

-- ============================================================================
-- The shared patch function must be out of reach of client roles
-- ============================================================================

reset role;

select ok(
  not has_function_privilege('anon', 'public.internal_patch_session_set(uuid, uuid, uuid, jsonb)', 'execute'),
  'anon cannot execute internal_patch_session_set directly'
);

select ok(
  not has_function_privilege('authenticated', 'public.internal_patch_session_set(uuid, uuid, uuid, jsonb)', 'execute'),
  'authenticated cannot execute internal_patch_session_set directly, so it cannot name another user'
);

-- ============================================================================
-- Completing a session revokes its tokens
-- ============================================================================

insert into public.sessions (id, user_id, plan_id, plan_day_id, status)
  values ('000000f4-0000-0000-0000-000000000004', '000000aa-0000-0000-0000-000000000001', '000000cc-0000-0000-0000-000000000001', '000000dd-0000-0000-0000-000000000001', 'IN_PROGRESS');
insert into public.session_action_tokens (user_id, session_id, token_hash, expires_at)
  values ('000000aa-0000-0000-0000-000000000001', '000000f4-0000-0000-0000-000000000004',
   encode(sha256(convert_to('finishing-token', 'UTF8')), 'hex'), now() + interval '12 hours');

set local role authenticated;
set local request.jwt.claims = '{"sub":"000000aa-0000-0000-0000-000000000001"}';

select lives_ok(
  $$ select complete_session('000000f4-0000-0000-0000-000000000004', '[]'::jsonb) $$,
  'completing a session succeeds'
);

select ok(
  (select revoked_at is not null from public.session_action_tokens
    where token_hash = encode(sha256(convert_to('finishing-token', 'UTF8')), 'hex')),
  'completing a session revokes its live tokens'
);

select finish();
rollback;
