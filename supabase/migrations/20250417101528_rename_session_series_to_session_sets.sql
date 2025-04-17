-- Migration: Add training days and update exercise progression model
-- Description: Adds support for multiple training days per plan and makes exercise progression training plan & exercise specific
-- Author: AI Assistant
-- Created: 2025-04-17

-- rename the table from session_series to session_sets
alter table "session_series" rename to "session_sets";

-- note: postgresql automatically transfers all constraints, indexes and RLS policies
-- when renaming a table, but we'll rename any constraints that include the table name
-- for better clarity and maintenance

-- rename primary key constraint if it exists (assuming standard naming convention)
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'session_series_pkey') then
    alter table "session_sets" rename constraint "session_series_pkey" to "session_sets_pkey";
  end if;
end $$;

-- rename any foreign key constraints on this table (if they follow naming convention)
do $$
declare
  constraint_rec record;
begin
  for constraint_rec in
    select conname as constraint_name
    from pg_constraint
    where conrelid = 'session_sets'::regclass
    and conname like 'session_series_%_fkey'
  loop
    execute format('alter table "session_sets" rename constraint "%s" to "%s"',
      constraint_rec.constraint_name,
      replace(constraint_rec.constraint_name, 'session_series_', 'session_sets_'));
  end loop;
end $$;

-- rename any indexes on the table that include the old name
do $$
declare
  idx_rec record;
begin
  for idx_rec in
    select indexname as index_name
    from pg_indexes
    where tablename = 'session_sets'
    and indexname like 'session_series_%'
  loop
    execute format('alter index "%s" rename to "%s"',
      idx_rec.index_name,
      replace(idx_rec.index_name, 'session_series_', 'session_sets_'));
  end loop;
end $$;

-- rename any RLS policies that include the table name
do $$
declare
  policy_rec record;
begin
  for policy_rec in
    select policyname as policy_name
    from pg_policies
    where tablename = 'session_sets'
    and policyname like 'session_series_%'
  loop
    execute format('alter policy "%s" on "session_sets" rename to "%s"',
      policy_rec.policy_name,
      replace(policy_rec.policy_name, 'session_series_', 'session_sets_'));
  end loop;
end $$;
