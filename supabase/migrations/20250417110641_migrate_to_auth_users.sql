-- Migration: Migrate from public.users to auth.users
-- Description: Changes references from public.users.id to auth.users.id and drops the redundant public.users table
-- Author: AI Assistant
-- Created: 2025-04-17

-- create temporary tables to store existing data
create temporary table temp_users as
select * from public.users;

create temporary table temp_training_plans as
select * from public.training_plans;

-- drop foreign key constraints that reference public.users
alter table public.training_plans drop constraint if exists training_plans_user_id_fkey;

-- drop the constraint referencing training_plans from users (circular reference)
alter table public.users drop constraint if exists users_active_training_plan_fkey;

-- modify training_plans table to reference auth.users instead of public.users
alter table public.training_plans
    add constraint training_plans_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

-- recreate the data in training_plans, now linking to auth.users
-- this assumes users with the same ids exist in auth.users schema
-- (you may need to adjust this if ids don't match)

-- create user_profiles table (optional - if you need to store additional user info)
create table public.user_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    first_name varchar(255) not null,
    active_training_plan_id uuid null,
    created_at timestamp without time zone default current_timestamp,
    updated_at timestamp without time zone default current_timestamp
);

comment on table public.user_profiles is 'Stores user profile information';

-- enable row level security on user_profiles table
alter table public.user_profiles enable row level security;

-- create RLS policies for user_profiles
create policy "user_profiles_anon_no_access" on public.user_profiles
    for all to anon
    using (false);

create policy "user_profiles_authenticated_select" on public.user_profiles
    for select to authenticated
    using (id = auth.uid());

create policy "user_profiles_authenticated_insert" on public.user_profiles
    for insert to authenticated
    with check (id = auth.uid());

create policy "user_profiles_authenticated_update" on public.user_profiles
    for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

-- create trigger to update updated_at column
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = current_timestamp;
    return new;
end;
$$ language plpgsql;

create trigger update_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.update_updated_at_column();

-- migrate data from users to user_profiles (if ids match)
insert into public.user_profiles (id, first_name, active_training_plan_id)
select id, display_name, active_training_plan_id
from temp_users;

-- create the constraint for active_training_plan_id
alter table public.user_profiles
    add constraint user_profiles_active_training_plan_fkey
    foreign key (active_training_plan_id) references public.training_plans(id);

-- drop the old users table (destructive operation)
-- WARNING: Make sure all data has been migrated before dropping the table
drop table public.users cascade;

-- update RLS policies on other tables to use auth.uid() where appropriate
-- (already in place based on existing migrations)

-- add an index for performance on user_profiles
create index user_profiles_id_idx on public.user_profiles(id);
