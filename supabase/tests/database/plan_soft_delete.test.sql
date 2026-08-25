/*
 * pgTAP tests for the plan soft-delete introduced in 20260824224700.
 *
 * This suite validates the five database guarantees the plan editor's tiered editability rests on:
 * 1. Deleting a plan_exercise or plan_day that history references fails, while deleting the whole
 *    plan still succeeds - the ON DELETE NO ACTION vs RESTRICT distinction, which is invisible in
 *    the schema and only shows up under exactly this pair of operations.
 * 2. Archiving a day leaves its sessions and their sets intact and readable.
 * 3. replace_collection with p_active_only_column leaves archived rows alone: it neither deletes
 *    them by exclusion nor negates their order_index.
 * 4. The partial unique indexes let an archived row and a live row share an order_index.
 * 5. The snapshot a session carries - its prescription, and whether the plan prescribed each set -
 *    is unaffected by the plan changing underneath it.
 *
 * Structured like replace_collection.test.sql: a throwaway auth user and their data are seeded as
 * superuser, then the assertions run as `authenticated` with a jwt-claims stub so RLS applies.
 * Everything is inside begin/rollback, so nothing persists.
 */

begin;

select plan(29);

-- ============================================================================
-- SETUP: a user, one plan, two days, two exercises, and a completed session
-- ============================================================================

insert into auth.users (id) values ('000000a2-0000-0000-0000-000000000001');

insert into public.exercises (id, name) values
    ('000000e1-0000-0000-0000-000000000001', 'Soft Delete Test Squat');

insert into public.plans (id, user_id, name) values
    ('000000c2-0000-0000-0000-000000000001', '000000a2-0000-0000-0000-000000000001', 'Soft Delete Plan');

insert into public.plan_days (id, plan_id, name, order_index) values
    ('000000d2-0000-0000-0000-000000000001', '000000c2-0000-0000-0000-000000000001', 'Trained Day', 1),
    ('000000d2-0000-0000-0000-000000000002', '000000c2-0000-0000-0000-000000000001', 'Untouched Day', 2);

insert into public.plan_exercises (id, plan_day_id, exercise_id, order_index) values
    ('000000f2-0000-0000-0000-000000000001', '000000d2-0000-0000-0000-000000000001', '000000e1-0000-0000-0000-000000000001', 1),
    ('000000f2-0000-0000-0000-000000000002', '000000d2-0000-0000-0000-000000000002', '000000e1-0000-0000-0000-000000000001', 1);

-- Only the first day has been trained. The second is the control: nothing references it, so it must
-- stay hard-deletable.
insert into public.sessions (id, user_id, plan_id, plan_day_id, status) values
    ('000000b2-0000-0000-0000-000000000001', '000000a2-0000-0000-0000-000000000001',
     '000000c2-0000-0000-0000-000000000001', '000000d2-0000-0000-0000-000000000001', 'COMPLETED');

insert into public.session_sets (id, session_id, plan_exercise_id, set_index, actual_weight, actual_reps, expected_reps, expected_weight, is_prescribed, status) values
    ('00000012-0000-0000-0000-000000000001', '000000b2-0000-0000-0000-000000000001',
     '000000f2-0000-0000-0000-000000000001', 1, 100, 5, 5, 100, true, 'COMPLETED');

set local role authenticated;
set local request.jwt.claims = '{"sub":"000000a2-0000-0000-0000-000000000001"}';

-- ============================================================================
-- TEST SUITE 1: The columns and indexes exist
-- ============================================================================

select has_column('public', 'plan_days', 'archived_at', 'plan_days should have an archived_at column');
select has_column('public', 'plan_exercises', 'archived_at', 'plan_exercises should have an archived_at column');
select has_column('public', 'session_sets', 'expected_weight', 'session_sets should have an expected_weight column');
select col_not_null('public', 'session_sets', 'expected_weight', 'session_sets.expected_weight should be NOT NULL');
select has_column('public', 'session_sets', 'is_prescribed', 'session_sets should have an is_prescribed column');
select col_not_null('public', 'session_sets', 'is_prescribed', 'session_sets.is_prescribed should be NOT NULL');
-- False, so that a plain insert that says nothing records an ad hoc set rather than silently
-- claiming the plan prescribed it. Writes through replace_collection state it explicitly.
select col_default_is('public', 'session_sets', 'is_prescribed', 'false', 'session_sets.is_prescribed should default to false');

-- ============================================================================
-- TEST SUITE 2: History cannot be deleted out from under itself
-- ============================================================================

select throws_ok(
    $$ delete from public.plan_exercises where id = '000000f2-0000-0000-0000-000000000001' $$,
    '23503',
    null,
    'Deleting a plan exercise that has recorded sets should fail on the foreign key'
);

select throws_ok(
    $$ delete from public.plan_days where id = '000000d2-0000-0000-0000-000000000001' $$,
    '23503',
    null,
    'Deleting a plan day that has sessions should fail on the foreign key'
);

-- The control: structure nothing has trained is still ordinary, deletable structure. If this ever
-- fails, the FKs have been made too strict and a plan can no longer be edited at all.
select lives_ok(
    $$ delete from public.plan_exercises where id = '000000f2-0000-0000-0000-000000000002' $$,
    'Deleting a plan exercise with no recorded sets should still succeed'
);

select lives_ok(
    $$ delete from public.plan_days where id = '000000d2-0000-0000-0000-000000000002' $$,
    'Deleting a plan day with no sessions should still succeed'
);

-- ============================================================================
-- TEST SUITE 3: Archiving keeps history readable
-- ============================================================================

select lives_ok(
    $$
    update public.plan_days set archived_at = now() where id = '000000d2-0000-0000-0000-000000000001';
    update public.plan_exercises set archived_at = now() where id = '000000f2-0000-0000-0000-000000000001';
    $$,
    'Archiving a day and its exercise should succeed'
);

select is(
    (select count(*)::int from public.sessions where plan_day_id = '000000d2-0000-0000-0000-000000000001'),
    1,
    'Archiving a day should leave its session in place'
);

select is(
    (select count(*)::int from public.session_sets where plan_exercise_id = '000000f2-0000-0000-0000-000000000001'),
    1,
    'Archiving an exercise should leave its recorded sets in place'
);

select is(
    (select expected_weight from public.session_sets where id = '00000012-0000-0000-0000-000000000001'),
    100::numeric(7,3),
    'The archived exercise''s recorded set should still carry the weight it was prescribed'
);

-- ============================================================================
-- TEST SUITE 4: The partial unique index tolerates a reused order_index
-- ============================================================================

-- The archived day above still holds order_index 1. A new live day must be able to take that
-- position, which the original UNIQUE(plan_id, order_index) constraint would have refused.
select lives_ok(
    $$
    insert into public.plan_days (id, plan_id, name, order_index)
    values ('000000d2-0000-0000-0000-000000000003', '000000c2-0000-0000-0000-000000000001', 'Replacement Day', 1)
    $$,
    'A live day should be able to take the order_index an archived day still holds'
);

select throws_ok(
    $$
    insert into public.plan_days (id, plan_id, name, order_index)
    values ('000000d2-0000-0000-0000-000000000004', '000000c2-0000-0000-0000-000000000001', 'Colliding Day', 1)
    $$,
    '23505',
    null,
    'Two live days should still not be able to share an order_index'
);

-- ============================================================================
-- TEST SUITE 5: replace_collection leaves archived rows alone
-- ============================================================================

-- The editor sends only the live days. Without p_active_only_column the archived day is absent from
-- the payload, so the delete-by-exclusion would remove it - taking the session with it, or now
-- failing the foreign key - and the order negation would leave it at -1.
select lives_ok(
    $$
    select replace_collection(
        'plan_days',
        'plan_id',
        '000000c2-0000-0000-0000-000000000001'::uuid,
        'order_index',
        '[
            {"id": "000000d2-0000-0000-0000-000000000003", "plan_id": "000000c2-0000-0000-0000-000000000001", "name": "Replacement Day", "order_index": 1}
        ]'::jsonb,
        null,
        null,
        'archived_at'
    )
    $$,
    'replace_collection with an active-only column should execute successfully'
);

select ok(
    exists(select 1 from public.plan_days where id = '000000d2-0000-0000-0000-000000000001'),
    'The archived day should survive a replacement that does not mention it'
);

select is(
    (select order_index from public.plan_days where id = '000000d2-0000-0000-0000-000000000001'),
    1::smallint,
    'The archived day should keep its order_index rather than being left negated'
);

select is(
    (select count(*)::int from public.session_sets where plan_exercise_id = '000000f2-0000-0000-0000-000000000001'),
    1,
    'The archived day''s session history should be untouched by the replacement'
);

-- ============================================================================
-- TEST SUITE 6: Restoring cannot reinstate a stale order_index
-- ============================================================================

-- The archived day still holds order_index 1, and "Replacement Day" has since taken that position
-- among the live days. Simply clearing archived_at therefore collides: the partial index makes an
-- archived row safe to leave where it is, but it does not reserve the slot. This is why
-- PlanRepository.archiveDay appends a restored day after the last live one rather than putting it
-- back - without that, restore surfaces as a 500.
select throws_ok(
    $$
    update public.plan_days
    set archived_at = null
    where id = '000000d2-0000-0000-0000-000000000001'
    $$,
    '23505',
    null,
    'Restoring a day onto an order_index a live day now holds should be refused'
);

select lives_ok(
    $$
    update public.plan_days
    set archived_at = null,
        order_index = (
            select coalesce(max(order_index), 0) + 1
            from public.plan_days
            where plan_id = '000000c2-0000-0000-0000-000000000001' and archived_at is null
        )
    where id = '000000d2-0000-0000-0000-000000000001'
    $$,
    'Restoring a day appended after the last live one should succeed'
);

-- ============================================================================
-- TEST SUITE 7: The session snapshot survives the plan moving under it
-- ============================================================================

-- The exercise is given the prescription the session was created from, and then loses a set - an
-- ordinary edit, and the one that used to be dangerous. While `is_prescribed` was inferred at
-- request time from `count(plan_exercise_sets)`, dropping set 2 put the session's set 2 outside the
-- count and reclassified it as something the user had added ad hoc, which reopened it for deletion
-- and let a recorded failure be erased from the progression.
insert into public.plan_exercise_sets (id, plan_exercise_id, set_index, expected_reps, expected_weight) values
    ('00000022-0000-0000-0000-000000000001', '000000f2-0000-0000-0000-000000000001', 1, 5, 100),
    ('00000022-0000-0000-0000-000000000002', '000000f2-0000-0000-0000-000000000001', 2, 5, 100);

insert into public.session_sets (id, session_id, plan_exercise_id, set_index, actual_weight, actual_reps, expected_reps, expected_weight, is_prescribed, status) values
    ('00000012-0000-0000-0000-000000000002', '000000b2-0000-0000-0000-000000000001',
     '000000f2-0000-0000-0000-000000000001', 2, 100, 3, 5, 100, true, 'FAILED');

delete from public.plan_exercise_sets where id = '00000022-0000-0000-0000-000000000002';

select is(
    (select is_prescribed from public.session_sets where id = '00000012-0000-0000-0000-000000000002'),
    true,
    'Shrinking the plan should leave a recorded set still marked as prescribed'
);

select is(
    (select expected_reps from public.session_sets where id = '00000012-0000-0000-0000-000000000002'),
    5,
    'Shrinking the plan should leave the reps the session was judged against alone'
);

-- ============================================================================
-- TEST SUITE 8: Deleting the whole plan must still work
-- ============================================================================

-- This is the test that catches choosing RESTRICT over NO ACTION. Deleting a plan cascades to
-- plan_days -> plan_exercises and to sessions -> session_sets within a single statement. Under
-- RESTRICT the check would fire while the referencing session_sets rows still existed and abort a
-- delete that is perfectly valid; under NO ACTION it is deferred to end of statement, by which time
-- the cascade has already removed everything that referenced them.
select lives_ok(
    $$ delete from public.plans where id = '000000c2-0000-0000-0000-000000000001' $$,
    'Deleting a whole plan should still cascade cleanly, history and all'
);

select is(
    (select count(*)::int from public.sessions where plan_id = '000000c2-0000-0000-0000-000000000001'),
    0,
    'Deleting the plan should have taken its sessions with it'
);

select is(
    (select count(*)::int from public.session_sets where id = '00000012-0000-0000-0000-000000000001'),
    0,
    'Deleting the plan should have taken its session sets with it'
);

select is(
    (select count(*)::int from public.plan_days where plan_id = '000000c2-0000-0000-0000-000000000001'),
    0,
    'Deleting the plan should have taken its days with it, archived ones included'
);

select * from finish();

rollback;
