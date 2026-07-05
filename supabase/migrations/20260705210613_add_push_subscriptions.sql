-- Migration: Add push_subscriptions table
-- Description: Stores Web Push subscriptions so the backend can deliver
--              session rest/idle notifications to a user's devices.
-- Affected tables: public.push_subscriptions (new)
-- Special considerations: One row per browser push endpoint. The background
--   push sender reads this table with the service-role key (bypassing RLS);
--   authenticated users may only manage their own subscriptions.
-- Author: Claude
-- Created: 2026-07-05

-- -----------------------------------------------------
-- Table push_subscriptions
-- -----------------------------------------------------
create table "public"."push_subscriptions" (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    created_at timestamptz not null default now(),
    foreign key (user_id) references auth.users(id) on delete cascade
);

comment on table "public"."push_subscriptions" is 'Web Push subscriptions used to deliver session notifications to user devices.';

-- Index for looking up all of a user's subscriptions when sending a push.
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

-- Enable RLS: this table holds per-user device tokens and must be protected.
alter table "public"."push_subscriptions" enable row level security;

-- RLS Policy for anon role (no access): subscriptions are private to a user.
create policy "push_subscriptions_anon_no_access" on "public"."push_subscriptions"
    for all to anon
    using (false);

-- RLS Policy: a user may read only their own subscriptions.
create policy "push_subscriptions_authenticated_select" on "public"."push_subscriptions"
    for select to authenticated
    using (user_id = auth.uid());

-- RLS Policy: a user may register a subscription only for themselves.
create policy "push_subscriptions_authenticated_insert" on "public"."push_subscriptions"
    for insert to authenticated
    with check (user_id = auth.uid());

-- RLS Policy: a user may update only their own subscriptions (e.g. re-key an endpoint).
create policy "push_subscriptions_authenticated_update" on "public"."push_subscriptions"
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- RLS Policy: a user may delete only their own subscriptions (e.g. on unsubscribe).
create policy "push_subscriptions_authenticated_delete" on "public"."push_subscriptions"
    for delete to authenticated
    using (user_id = auth.uid());
