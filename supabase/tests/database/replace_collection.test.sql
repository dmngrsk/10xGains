/*
 * pgTAP tests for the generic collection functions replace_collection / replace_collections_batch.
 *
 * This suite validates:
 * 1. Function existence and signatures
 * 2. Collection replacement mode
 * 3. Upsert-only mode
 * 4. Batch operations across multiple collections
 * 5. Error handling and the managed-collection whitelist
 * 6. Data integrity (order swaps, ownership, unique constraints, batch atomicity)
 *
 * The functions are `security invoker` and only accept the whitelisted collection tables, so they
 * are exercised the way the API drives them: as an authenticated user who owns the data, against the
 * real `plans` / `plan_days` tables under RLS. A throwaway auth user and two plans are seeded as
 * superuser, then the assertions run under `set role authenticated` with a jwt-claims stub so that
 * auth.uid() resolves and every statement is subject to the caller's policies. Everything is inside
 * begin/rollback, so nothing persists.
 */

begin;

select plan(30);

-- ============================================================================
-- TEST SUITE 0: The managed-collection whitelist
-- ============================================================================

select ok(
    public.is_managed_collection('plan_days'),
    'is_managed_collection should accept a real managed table'
);

select ok(
    not public.is_managed_collection('pg_class'),
    'is_managed_collection should reject a table that is not a managed collection'
);

-- ============================================================================
-- TEST SUITE 1: Function Existence and Signatures
-- ============================================================================

select has_function(
    'public',
    'replace_collection',
    array['text', 'text', 'uuid', 'text', 'jsonb', 'text', 'uuid'],
    'replace_collection function should exist with correct parameter types'
);

select has_function(
    'public',
    'replace_collections_batch',
    array['jsonb'],
    'replace_collections_batch function should exist with correct parameter types'
);

select function_returns(
    'public', 'replace_collection', array['text', 'text', 'uuid', 'text', 'jsonb', 'text', 'uuid'],
    'jsonb',
    'replace_collection should return jsonb'
);

select function_returns(
    'public', 'replace_collections_batch', array['jsonb'],
    'void',
    'replace_collections_batch should return void'
);

-- ============================================================================
-- SETUP: a user and two plans they own (superuser)
-- ============================================================================

-- Only auth.users.id is required; every other column is nullable or defaulted.
insert into auth.users (id) values ('000000a1-0000-0000-0000-000000000001');

insert into public.plans (id, user_id, name) values
    ('000000c1-0000-0000-0000-000000000001', '000000a1-0000-0000-0000-000000000001', 'Test Plan A'),
    ('000000c1-0000-0000-0000-000000000002', '000000a1-0000-0000-0000-000000000001', 'Test Plan B');

-- Plan A starts with two days; the replacement tests churn these.
insert into public.plan_days (id, plan_id, name, order_index) values
    ('000000d1-0000-0000-0000-000000000011', '000000c1-0000-0000-0000-000000000001', 'Day 1', 1),
    ('000000d1-0000-0000-0000-000000000012', '000000c1-0000-0000-0000-000000000001', 'Day 2', 2);

-- Plan B carries the order-swap fixture used in TEST SUITE 6.
insert into public.plan_days (id, plan_id, name, order_index) values
    ('000000d1-0000-0000-0000-000000000071', '000000c1-0000-0000-0000-000000000002', 'First Day', 1),
    ('000000d1-0000-0000-0000-000000000072', '000000c1-0000-0000-0000-000000000002', 'Second Day', 2);

-- Become the owner. Every statement below runs under this user's RLS policies.
set local role authenticated;
set local request.jwt.claims = '{"sub":"000000a1-0000-0000-0000-000000000001"}';

-- ============================================================================
-- TEST SUITE 2: Collection Replacement Mode Tests
-- ============================================================================

select lives_ok(
    $$
    select replace_collection(
        'plan_days',
        'plan_id',
        '000000c1-0000-0000-0000-000000000001'::uuid,
        null,
        '[
            {"id": "000000d1-0000-0000-0000-000000000021", "plan_id": "000000c1-0000-0000-0000-000000000001", "name": "New Day 1", "order_index": 1},
            {"id": "000000d1-0000-0000-0000-000000000022", "plan_id": "000000c1-0000-0000-0000-000000000001", "name": "New Day 3", "order_index": 3}
        ]'::jsonb
    )
    $$,
    'Collection replacement should execute successfully'
);

select is(
    (select count(*)::int from public.plan_days where plan_id = '000000c1-0000-0000-0000-000000000001'),
    2,
    'Should have exactly 2 plan days after replacement'
);

select ok(
    not exists(select 1 from public.plan_days where id = '000000d1-0000-0000-0000-000000000011'),
    'Original day 1 should be deleted'
);

select ok(
    not exists(select 1 from public.plan_days where id = '000000d1-0000-0000-0000-000000000012'),
    'Original day 2 should be deleted'
);

select ok(
    exists(select 1 from public.plan_days where id = '000000d1-0000-0000-0000-000000000021' and name = 'New Day 1'),
    'New day 1 should be inserted'
);

select lives_ok(
    $$
    select replace_collection(
        'plan_days',
        'plan_id',
        '000000c1-0000-0000-0000-000000000001'::uuid,
        null,
        '[]'::jsonb
    )
    $$,
    'Collection replacement with empty array should execute successfully'
);

select is(
    (select count(*)::int from public.plan_days where plan_id = '000000c1-0000-0000-0000-000000000001'),
    0,
    'Should have no plan days after replacement with empty array'
);

-- ============================================================================
-- TEST SUITE 3: Upsert-Only Mode Tests
-- ============================================================================

-- Upsert-only mode (no parent column/id): inserts a new plan and updates an existing one.
select lives_ok(
    $$
    select replace_collection(
        'plans',
        null,
        null,
        null,
        '[
            {"id": "000000c1-0000-0000-0000-000000000003", "user_id": "000000a1-0000-0000-0000-000000000001", "name": "Upsert Plan"},
            {"id": "000000c1-0000-0000-0000-000000000001", "user_id": "000000a1-0000-0000-0000-000000000001", "name": "Updated Plan A"}
        ]'::jsonb
    )
    $$,
    'Upsert-only mode should execute successfully'
);

select ok(
    exists(select 1 from public.plans where id = '000000c1-0000-0000-0000-000000000003' and name = 'Upsert Plan'),
    'New plan should be inserted via upsert'
);

select ok(
    exists(select 1 from public.plans where id = '000000c1-0000-0000-0000-000000000001' and name = 'Updated Plan A'),
    'Existing plan should be updated via upsert'
);

select ok(
    exists(select 1 from public.plans where id = '000000c1-0000-0000-0000-000000000002' and name = 'Test Plan B'),
    'Unrelated plan should remain unchanged in upsert-only mode'
);

-- ============================================================================
-- TEST SUITE 4: Batch Operations Tests
-- ============================================================================

select lives_ok(
    $$
    select replace_collections_batch('[
        {
            "table_name": "plans",
            "parent_column": null,
            "parent_id": null,
            "records": [
                {"id": "000000c1-0000-0000-0000-000000000004", "user_id": "000000a1-0000-0000-0000-000000000001", "name": "Batch Plan"}
            ]
        },
        {
            "table_name": "plan_days",
            "parent_column": "plan_id",
            "parent_id": "000000c1-0000-0000-0000-000000000004",
            "records": [
                {"id": "000000d1-0000-0000-0000-000000000041", "plan_id": "000000c1-0000-0000-0000-000000000004", "name": "Batch Day 1", "order_index": 1},
                {"id": "000000d1-0000-0000-0000-000000000042", "plan_id": "000000c1-0000-0000-0000-000000000004", "name": "Batch Day 2", "order_index": 2}
            ]
        }
    ]'::jsonb)
    $$,
    'Batch operations should execute successfully'
);

select ok(
    exists(select 1 from public.plans where id = '000000c1-0000-0000-0000-000000000004' and name = 'Batch Plan'),
    'Plan should be created via batch operation'
);

select is(
    (select count(*)::int from public.plan_days where plan_id = '000000c1-0000-0000-0000-000000000004'),
    2,
    'Should have 2 days created via batch operation'
);

-- ============================================================================
-- TEST SUITE 5: Error Handling Tests
-- ============================================================================

select throws_ok(
    $$
    select replace_collections_batch('{"invalid": "not_an_array"}'::jsonb)
    $$,
    'P0001',
    'Operations parameter must be an array',
    'Should reject non-array input for batch operations'
);

select throws_ok(
    $$
    select replace_collections_batch('[
        {"parent_column": "plan_id", "records": []}
    ]'::jsonb)
    $$,
    'P0001',
    'Each operation must have table_name and records',
    'Should reject operations missing table_name'
);

-- A table that is not on the managed-collection whitelist is rejected outright.
select throws_ok(
    $$
    select replace_collection(
        'nonexistent_table',
        'plan_id',
        '000000c1-0000-0000-0000-000000000001'::uuid,
        null,
        '[]'::jsonb
    )
    $$,
    'P0001',
    null,
    'Should throw error for a non-whitelisted table'
);

-- ============================================================================
-- TEST SUITE 6: Data Integrity Tests
-- ============================================================================

-- Order swap on Plan B (seeded above): the temporary negative offset lets the two rows exchange
-- positions without tripping the unique(plan_id, order_index) constraint mid-update.
select lives_ok(
    $$
    select replace_collection(
        'plan_days',
        'plan_id',
        '000000c1-0000-0000-0000-000000000002'::uuid,
        'order_index',
        '[
            {"id": "000000d1-0000-0000-0000-000000000071", "plan_id": "000000c1-0000-0000-0000-000000000002", "name": "First Day", "order_index": 2},
            {"id": "000000d1-0000-0000-0000-000000000072", "plan_id": "000000c1-0000-0000-0000-000000000002", "name": "Second Day", "order_index": 1}
        ]'::jsonb
    )
    $$,
    'Should handle order index swapping without unique constraint violations'
);

select is(
    (select order_index from public.plan_days where id = '000000d1-0000-0000-0000-000000000071'),
    2::smallint,
    'First day should now have order_index 2'
);

select is(
    (select order_index from public.plan_days where id = '000000d1-0000-0000-0000-000000000072'),
    1::smallint,
    'Second day should now have order_index 1'
);

-- Writing to a plan the caller does not own is refused: no such plan exists for this user, so the
-- insert fails its RLS check, which replace_collection surfaces as its wrapped P0001.
select throws_ok(
    $$
    select replace_collection(
        'plan_days',
        'plan_id',
        '000000c9-0000-0000-0000-000000000999'::uuid,
        null,
        '[
            {"id": "000000d1-0000-0000-0000-000000000091", "plan_id": "000000c9-0000-0000-0000-000000000999", "name": "Invalid Day", "order_index": 1}
        ]'::jsonb
    )
    $$,
    'P0001',
    null,
    'Should refuse to write rows under a plan the caller does not own'
);

-- Two days sharing an order_index violate the unique constraint.
select throws_ok(
    $$
    select replace_collection(
        'plan_days',
        'plan_id',
        '000000c1-0000-0000-0000-000000000002'::uuid,
        null,
        '[
            {"id": "000000d1-0000-0000-0000-000000000051", "plan_id": "000000c1-0000-0000-0000-000000000002", "name": "Day 1", "order_index": 1},
            {"id": "000000d1-0000-0000-0000-000000000052", "plan_id": "000000c1-0000-0000-0000-000000000002", "name": "Day 2", "order_index": 1}
        ]'::jsonb
    )
    $$,
    'P0001',
    null,
    'Should respect unique constraints'
);

-- If one operation in a batch fails, the whole batch rolls back.
select throws_ok(
    $$
    select replace_collections_batch('[
        {
            "table_name": "plans",
            "records": [
                {"id": "000000c1-0000-0000-0000-000000000005", "user_id": "000000a1-0000-0000-0000-000000000001", "name": "Should Not Exist"}
            ]
        },
        {
            "table_name": "plan_days",
            "parent_column": "plan_id",
            "parent_id": "000000c9-0000-0000-0000-000000000999",
            "records": [
                {"id": "000000d1-0000-0000-0000-000000000061", "plan_id": "000000c9-0000-0000-0000-000000000999", "name": "Invalid", "order_index": 1}
            ]
        }
    ]'::jsonb)
    $$,
    null,
    null,
    'Batch should fail when any operation fails'
);

select ok(
    not exists(select 1 from public.plans where id = '000000c1-0000-0000-0000-000000000005'),
    'Failed batch operation should rollback all changes'
);

-- ============================================================================
-- CLEANUP AND FINALIZE TESTS
-- ============================================================================

reset role;
select * from finish();

rollback;
