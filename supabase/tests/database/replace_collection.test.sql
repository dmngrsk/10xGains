/*
 * This test suite validates:
 * 1. Function existence and signatures
 * 2. Collection replacement mode functionality
 * 3. Upsert-only mode functionality  
 * 4. Batch operations with multiple collections
 * 5. Error handling and edge cases
 * 6. Data integrity and referential constraints
 */

begin;

-- Plan the total number of tests to run
select plan(28);

-- ============================================================================
-- SETUP: Create test tables and data
-- ============================================================================

-- Create test tables in public schema that mirror the production schema structure
-- Note: These will be cleaned up by the rollback at the end of the test
create table public.test_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    name text not null,
    description text,
    created_at timestamp without time zone default current_timestamp
);

create table public.test_plan_days (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references public.test_plans(id) on delete cascade,
    name text not null,
    description text,
    order_index smallint not null,
    created_at timestamp without time zone default current_timestamp,
    unique(plan_id, order_index)
);

create table public.test_plan_exercises (
    id uuid primary key default gen_random_uuid(),
    plan_day_id uuid not null references public.test_plan_days(id) on delete cascade,
    exercise_id uuid not null,
    order_index smallint not null,
    created_at timestamp without time zone default current_timestamp,
    unique(plan_day_id, order_index)
);

-- Insert test data
insert into public.test_plans (id, user_id, name, description) values 
    ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Test Plan A', 'First test plan'),
    ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Test Plan B', 'Second test plan');

insert into public.test_plan_days (id, plan_id, name, description, order_index) values
    ('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'Day 1', 'Upper body', 1),
    ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'Day 2', 'Lower body', 2);

-- ============================================================================
-- TEST SUITE 1: Function Existence and Signatures
-- ============================================================================

-- Test that replace_collection function exists with correct signature
select has_function(
    'public',
    'replace_collection',
    array['text', 'text', 'uuid', 'text', 'jsonb'],
    'replace_collection function should exist with correct parameter types'
);

-- Test that replace_collections_batch function exists with correct signature  
select has_function(
    'public',
    'replace_collections_batch',
    array['jsonb'],
    'replace_collections_batch function should exist with correct parameter types'
);

-- Test return types
select function_returns(
    'public', 'replace_collection', array['text', 'text', 'uuid', 'text', 'jsonb'],
    'jsonb',
    'replace_collection should return jsonb'
);

select function_returns(
    'public', 'replace_collections_batch', array['jsonb'],
    'void', 
    'replace_collections_batch should return void'
);

-- ============================================================================
-- TEST SUITE 2: Collection Replacement Mode Tests
-- ============================================================================

-- Test collection replacement: replacing plan days for a specific plan
select lives_ok(
    $$
    select replace_collection(
        'test_plan_days',
        'plan_id', 
        '550e8400-e29b-41d4-a716-446655440001'::uuid,
        null,
        '[
            {"id": "550e8400-e29b-41d4-a716-446655440021", "plan_id": "550e8400-e29b-41d4-a716-446655440001", "name": "New Day 1", "description": "Updated upper", "order_index": 1},
            {"id": "550e8400-e29b-41d4-a716-446655440022", "plan_id": "550e8400-e29b-41d4-a716-446655440001", "name": "New Day 3", "description": "Cardio day", "order_index": 3}
        ]'::jsonb
    )
    $$,
    'Collection replacement should execute successfully'
);

-- Verify old records were deleted and new ones inserted
select is(
    (select count(*)::int from public.test_plan_days where plan_id = '550e8400-e29b-41d4-a716-446655440001'),
    2,
    'Should have exactly 2 plan days after replacement'
);

select ok(
    not exists(select 1 from public.test_plan_days where id = '550e8400-e29b-41d4-a716-446655440011'),
    'Original day 1 should be deleted'
);

select ok(
    not exists(select 1 from public.test_plan_days where id = '550e8400-e29b-41d4-a716-446655440012'),
    'Original day 2 should be deleted'
);

select ok(
    exists(select 1 from public.test_plan_days where id = '550e8400-e29b-41d4-a716-446655440021' and name = 'New Day 1'),
    'New day 1 should be inserted'
);

-- Test collection replacement with empty array (should delete all)
select lives_ok(
    $$
    select replace_collection(
        'test_plan_days',
        'plan_id',
        '550e8400-e29b-41d4-a716-446655440001'::uuid,
        null,
        '[]'::jsonb
    )
    $$,
    'Collection replacement with empty array should execute successfully'
);

select is(
    (select count(*)::int from public.test_plan_days where plan_id = '550e8400-e29b-41d4-a716-446655440001'),
    0,
    'Should have no plan days after replacement with empty array'
);

-- ============================================================================
-- TEST SUITE 3: Upsert-Only Mode Tests  
-- ============================================================================

-- Test upsert-only mode (no parent column/id specified)
select lives_ok(
    $$
    select replace_collection(
        'test_plans',
        null,
        null,
        null,
        '[
            {"id": "550e8400-e29b-41d4-a716-446655440003", "user_id": "550e8400-e29b-41d4-a716-446655440000", "name": "Upsert Plan", "description": "Inserted via upsert"},
            {"id": "550e8400-e29b-41d4-a716-446655440001", "user_id": "550e8400-e29b-41d4-a716-446655440000", "name": "Updated Plan A", "description": "Updated via upsert"}
        ]'::jsonb
    )
    $$,
    'Upsert-only mode should execute successfully'
);

-- Verify both insert and update occurred
select ok(
    exists(select 1 from public.test_plans where id = '550e8400-e29b-41d4-a716-446655440003' and name = 'Upsert Plan'),
    'New plan should be inserted via upsert'
);

select ok(
    exists(select 1 from public.test_plans where id = '550e8400-e29b-41d4-a716-446655440001' and name = 'Updated Plan A'),
    'Existing plan should be updated via upsert'
);

-- Verify plan B was not affected (upsert-only mode doesn't delete)
select ok(
    exists(select 1 from public.test_plans where id = '550e8400-e29b-41d4-a716-446655440002' and name = 'Test Plan B'),
    'Unrelated plan should remain unchanged in upsert-only mode'
);

-- ============================================================================
-- TEST SUITE 4: Batch Operations Tests
-- ============================================================================

-- Test batch operations with multiple table updates
select lives_ok(
    $$
    select replace_collections_batch('[
        {
            "table_name": "test_plans",
            "parent_column": null,
            "parent_id": null,
            "records": [
                {"id": "550e8400-e29b-41d4-a716-446655440004", "user_id": "550e8400-e29b-41d4-a716-446655440000", "name": "Batch Plan", "description": "Created in batch"}
            ]
        },
        {
            "table_name": "test_plan_days", 
            "parent_column": "plan_id",
            "parent_id": "550e8400-e29b-41d4-a716-446655440004",
            "records": [
                {"id": "550e8400-e29b-41d4-a716-446655440031", "plan_id": "550e8400-e29b-41d4-a716-446655440004", "name": "Batch Day 1", "description": "First day", "order_index": 1},
                {"id": "550e8400-e29b-41d4-a716-446655440032", "plan_id": "550e8400-e29b-41d4-a716-446655440004", "name": "Batch Day 2", "description": "Second day", "order_index": 2}
            ]
        }
    ]'::jsonb)
    $$,
    'Batch operations should execute successfully'
);

-- Verify batch results
select ok(
    exists(select 1 from public.test_plans where id = '550e8400-e29b-41d4-a716-446655440004' and name = 'Batch Plan'),
    'Plan should be created via batch operation'
);

select is(
    (select count(*)::int from public.test_plan_days where plan_id = '550e8400-e29b-41d4-a716-446655440004'),
    2,
    'Should have 2 days created via batch operation'
);

-- ============================================================================
-- TEST SUITE 5: Error Handling Tests
-- ============================================================================

-- Test invalid json parameter for batch operations
select throws_ok(
    $$
    select replace_collections_batch('{"invalid": "not_an_array"}'::jsonb)
    $$,
    'P0001',
    'Operations parameter must be an array',
    'Should reject non-array input for batch operations'
);

-- Test missing required fields in batch operations
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

-- Test invalid table name
select throws_ok(
    $$
    select replace_collection(
        'nonexistent_table',
        'plan_id',
        '550e8400-e29b-41d4-a716-446655440001'::uuid,
        null,
        '[]'::jsonb
    )
    $$,
    'P0001',
    null,
    'Should throw error for nonexistent table'
);

-- ============================================================================
-- TEST SUITE 6: Data Integrity Tests
-- ============================================================================

-- Test order swapping scenario that typically causes unique constraint violations
-- Set up initial data with specific order indices
insert into public.test_plan_days (id, plan_id, name, description, order_index) values
    ('550e8400-e29b-41d4-a716-446655440071', '550e8400-e29b-41d4-a716-446655440002', 'First Day', 'Originally index 1', 1),
    ('550e8400-e29b-41d4-a716-446655440072', '550e8400-e29b-41d4-a716-446655440002', 'Second Day', 'Originally index 2', 2);

select lives_ok(
    $$
    select replace_collection(
        'test_plan_days',
        'plan_id',
        '550e8400-e29b-41d4-a716-446655440002'::uuid,
        'order_index',
        '[
            {"id": "550e8400-e29b-41d4-a716-446655440071", "plan_id": "550e8400-e29b-41d4-a716-446655440002", "name": "First Day", "description": "Now index 2", "order_index": 2},
            {"id": "550e8400-e29b-41d4-a716-446655440072", "plan_id": "550e8400-e29b-41d4-a716-446655440002", "name": "Second Day", "description": "Now index 1", "order_index": 1}
        ]'::jsonb
    )
    $$,
    'Should handle order index swapping without unique constraint violations'
);

-- Verify the order swap was successful
select is(
    (select order_index from public.test_plan_days where id = '550e8400-e29b-41d4-a716-446655440071'),
    2::smallint,
    'First day should now have order_index 2'
);

select is(
    (select order_index from public.test_plan_days where id = '550e8400-e29b-41d4-a716-446655440072'),
    1::smallint,
    'Second day should now have order_index 1'
);

-- Test that foreign key constraints are respected
select throws_ok(
    $$
    select replace_collection(
        'test_plan_days',
        'plan_id',
        '550e8400-e29b-41d4-a716-446655440999'::uuid,
        null,
        '[
            {"id": "550e8400-e29b-41d4-a716-446655440041", "plan_id": "550e8400-e29b-41d4-a716-446655440999", "name": "Invalid Day", "order_index": 1}
        ]'::jsonb
    )
    $$,
    'P0001',
    null,
    'Should respect foreign key constraints'
);

-- Test that unique constraints are respected  
select throws_ok(
    $$
    select replace_collection(
        'test_plan_days',
        'plan_id',
        '550e8400-e29b-41d4-a716-446655440002'::uuid,
        null,
        '[
            {"id": "550e8400-e29b-41d4-a716-446655440051", "plan_id": "550e8400-e29b-41d4-a716-446655440002", "name": "Day 1", "order_index": 1},
            {"id": "550e8400-e29b-41d4-a716-446655440052", "plan_id": "550e8400-e29b-41d4-a716-446655440002", "name": "Day 2", "order_index": 1}
        ]'::jsonb
    )
    $$,
    'P0001',
    null,
    'Should respect unique constraints'
);

-- Test atomic transaction behavior in batch operations
-- If one operation fails, the entire batch should be rolled back
select throws_ok(
    $$
    select replace_collections_batch('[
        {
            "table_name": "test_plans",
            "records": [
                {"id": "550e8400-e29b-41d4-a716-446655440005", "user_id": "550e8400-e29b-41d4-a716-446655440000", "name": "Should Not Exist", "description": "This should be rolled back"}
            ]
        },
        {
            "table_name": "test_plan_days",
            "parent_column": "plan_id", 
            "parent_id": "550e8400-e29b-41d4-a716-446655440999",
            "records": [
                {"id": "550e8400-e29b-41d4-a716-446655440061", "plan_id": "550e8400-e29b-41d4-a716-446655440999", "name": "Invalid", "order_index": 1}
            ]
        }
    ]'::jsonb)
    $$,
    null,
    null,
    'Batch should fail when any operation fails'
);

-- Verify the first operation was rolled back
select ok(
    not exists(select 1 from public.test_plans where id = '550e8400-e29b-41d4-a716-446655440005'),
    'Failed batch operation should rollback all changes'
);

-- ============================================================================
-- CLEANUP AND FINALIZE TESTS
-- ============================================================================

-- All tests completed successfully
select * from finish();

rollback;
