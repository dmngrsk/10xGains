-- Migration: Add session action tokens
-- Description: Lets a set be completed from an OS notification while the app is not running.
--
--   A service worker cannot reach the user's Supabase session: it is held in localStorage, which
--   service workers cannot read, and no page is open to ask. The API uses only the publishable key
--   plus the user's JWT, never the secret key, so there is no service-role path either.
--
--   The answer is a narrow, revocable credential. The app mints an opaque token scoped to one
--   session and one operation, and the service worker spends it against a `security definer`
--   function that establishes ownership from the token row instead of from a JWT. The token reads
--   nothing, reaches no other session, and lasts 12 hours - revoked when the session completes, and
--   rotated whenever a new one is minted. Only its SHA-256 hash is stored, and the function hashes
--   the raw token itself, so the stored value is not usable if the table ever leaks.
--
--   Affected: new table `session_action_tokens`; `patch_session_set` refactored around a new
--   `internal_patch_session_set`; new `complete_session_set_with_action_token`; `complete_session`
--   gains token revocation.
--
--   Special consideration: `patch_session_set` changes from `security invoker` to `security
--   definer`. It leaned on RLS to decide which session the caller could see; it now resolves
--   `auth.uid()` itself and passes it to the internal function, which filters on `user_id`
--   explicitly - the same restriction, stated rather than inherited. That is what lets the token
--   path share one implementation of the locking and status transitions. `internal_patch_session_set`
--   is granted to no client role precisely because it takes the user id as a parameter.
-- Author: AI Assistant
-- Created: 2026-09-05

-- ========================================
-- PHASE 1: The token store
-- ========================================

create table if not exists "public"."session_action_tokens" (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    session_id uuid not null references public.sessions(id) on delete cascade,
    -- SHA-256, hex encoded. The raw token is returned to the caller once, at mint, and never stored.
    token_hash text not null unique,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);

alter table "public"."session_action_tokens"
    drop constraint if exists session_action_tokens_token_hash_check;
alter table "public"."session_action_tokens"
    add constraint session_action_tokens_token_hash_check check (char_length(token_hash) = 64);

-- Enforced here as well as in the API: a token has to outlive a long workout, but it is a bearer
-- credential sitting in the OS notification store, so nothing should be able to mint a week-long one.
alter table "public"."session_action_tokens"
    drop constraint if exists session_action_tokens_expiry_check;
alter table "public"."session_action_tokens"
    add constraint session_action_tokens_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '12 hours');

-- Both minting and consuming want a session's live rows, a small minority once a user has trained.
create index if not exists idx_session_action_tokens_live
    on public.session_action_tokens (session_id)
    where revoked_at is null;

alter table "public"."session_action_tokens" enable row level security;

-- anon reaches a token row only through the security definer function, never this table directly.
create policy "session_action_tokens_anon_no_access" on "public"."session_action_tokens"
    for all to anon
    using (false);

create policy "session_action_tokens_authenticated_select" on "public"."session_action_tokens"
    for select to authenticated
    using (user_id = auth.uid());

create policy "session_action_tokens_authenticated_insert" on "public"."session_action_tokens"
    for insert to authenticated
    with check (user_id = auth.uid());

-- Update covers revocation only; a token's hash and expiry are never edited after minting.
create policy "session_action_tokens_authenticated_update" on "public"."session_action_tokens"
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- No delete policy: tokens are revoked, not removed, so an expired workout leaves an audit trail.
grant select, insert, update on public.session_action_tokens to authenticated;
grant select, insert, update on public.session_action_tokens to service_role;

-- ========================================
-- PHASE 2: One implementation of the set patch, two ways in
-- ========================================

-- `patch_session_set` as it stood in 20260720093000, with one change: ownership is a parameter
-- rather than something RLS applies on the caller's behalf. Everything else is unchanged.
create or replace function internal_patch_session_set(
    p_user_id uuid,
    p_session_id uuid,
    p_set_id uuid,
    p_updates jsonb
)
returns jsonb
language plpgsql
set search_path = ''
security definer
as $$
declare
    session_status text;
    updated_set jsonb;
begin
    -- Lock the session for the duration of the transaction. Filtering on user_id is what RLS used to
    -- do here, so a session belonging to someone else is "not found" - the same 404 either way.
    select status into session_status
    from public.sessions
    where id = p_session_id
      and user_id = p_user_id
    for update;

    if session_status is null then
        raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
    end if;

    if session_status = 'COMPLETED' then
        raise exception 'SESSION_COMPLETED' using errcode = 'P0001';
    end if;

    -- Starting to record sets is what moves a session from PENDING to IN_PROGRESS, and stamps the
    -- moment training actually began.
    if session_status = 'PENDING' then
        update public.sessions
        set status = 'IN_PROGRESS',
            session_date = timezone('utc', now())
        where id = p_session_id;
    end if;

    -- Only the columns a patch is allowed to touch are applied, and each is left alone unless the
    -- caller actually supplied it, so a partial patch cannot blank a field by omission.
    update public.session_sets t
    set status = case when p_updates ? 'status' then (p_updates->>'status')::varchar else t.status end,
        actual_reps = case when p_updates ? 'actual_reps' then (p_updates->>'actual_reps')::smallint else t.actual_reps end,
        actual_weight = case when p_updates ? 'actual_weight' then (p_updates->>'actual_weight')::numeric else t.actual_weight end,
        expected_reps = case when p_updates ? 'expected_reps' then (p_updates->>'expected_reps')::integer else t.expected_reps end,
        set_index = case when p_updates ? 'set_index' then (p_updates->>'set_index')::smallint else t.set_index end,
        -- Parse the offset the client sent, then reduce to the UTC wall clock the naive column stores.
        completed_at = case when p_updates ? 'completed_at' then (p_updates->>'completed_at')::timestamptz at time zone 'utc' else t.completed_at end
    where t.id = p_set_id
      and t.session_id = p_session_id
    returning to_jsonb(t.*) into updated_set;

    if updated_set is null then
        raise exception 'SESSION_SET_NOT_FOUND' using errcode = 'P0002';
    end if;

    return updated_set;
end;
$$;

-- Granted to no client role: it takes the user id as a parameter, so any role able to execute it
-- could patch another user's sets. Both callers are security definer and run as the owner.
revoke execute on function public.internal_patch_session_set(uuid, uuid, uuid, jsonb) from public, anon, authenticated;

comment on function internal_patch_session_set(uuid, uuid, uuid, jsonb) is
'Shared implementation behind patch_session_set and complete_session_set_with_action_token. Locks the parent session, rejects a completed one, promotes PENDING to IN_PROGRESS, and applies only the supplied columns. Takes the owning user id as a parameter instead of reading auth.uid(), so it must never be granted to a client role. Raises SESSION_NOT_FOUND / SESSION_SET_NOT_FOUND (P0002) or SESSION_COMPLETED (P0001).';

-- Same signature and behaviour as before, now a wrapper. Security definer so the inner call runs as
-- the owner: were it still invoker, `authenticated` would need execute on the internal function.
create or replace function patch_session_set(
    p_session_id uuid,
    p_set_id uuid,
    p_updates jsonb
)
returns jsonb
language sql
set search_path = ''
security definer
as $$
    select public.internal_patch_session_set(auth.uid(), p_session_id, p_set_id, p_updates);
$$;

revoke execute on function public.patch_session_set(uuid, uuid, jsonb) from public, anon;
grant execute on function public.patch_session_set(uuid, uuid, jsonb) to authenticated, service_role;

comment on function patch_session_set(uuid, uuid, jsonb) is
'Atomically applies a partial update to a session set for the calling user. Delegates to internal_patch_session_set with auth.uid(); runs as security definer so the caller never needs execute on that function. An unauthenticated caller has a null auth.uid() and matches no session, so it sees SESSION_NOT_FOUND. Raises SESSION_NOT_FOUND / SESSION_SET_NOT_FOUND (P0002) or SESSION_COMPLETED (P0001).';

-- ========================================
-- PHASE 3: Spending a token
-- ========================================

-- Returns everything the notification needs to redraw itself, so the service worker never needs a
-- read scope of its own. Deriving the next set here also means a notification whose idea of the
-- session went stale repairs itself on use.
create or replace function complete_session_set_with_action_token(
    p_token text,
    p_session_id uuid,
    p_set_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
security definer
as $$
declare
    token_user_id uuid;
    set_expected_reps integer;
    updated_set jsonb;
    next_set jsonb;
    session_status text;
begin
    -- Hashed here rather than by the caller, so a leak of this table hands nobody a working token.
    select user_id into token_user_id
    from public.session_action_tokens
    where token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
      and session_id = p_session_id
      and revoked_at is null
      and expires_at > now()
    for update;

    -- Expired, revoked, unknown and wrong-session all fail identically, revealing nothing.
    if token_user_id is null then
        raise exception 'ACTION_TOKEN_INVALID' using errcode = 'P0001';
    end if;

    -- Records the prescribed reps as performed, as the authenticated endpoint does. Without it,
    -- progress and history would read this set differently from one completed in the app.
    select expected_reps into set_expected_reps
    from public.session_sets
    where id = p_set_id
      and session_id = p_session_id;

    updated_set := public.internal_patch_session_set(
        token_user_id,
        p_session_id,
        p_set_id,
        -- now() carries its offset into the JSON, so the naive completed_at column is written
        -- from an unambiguous instant no matter what timezone the database session is in.
        jsonb_build_object('status', 'COMPLETED', 'actual_reps', set_expected_reps, 'completed_at', now())
    );

    -- Numbered within their exercise, matching how the app presents them ("Set 3/5").
    with ordered as (
        select ss.id,
               ss.status,
               ss.expected_reps,
               ss.expected_weight,
               e.name as exercise_name,
               pe.order_index as exercise_order,
               row_number() over (partition by ss.plan_exercise_id order by ss.set_index) as set_number,
               count(*) over (partition by ss.plan_exercise_id) as set_count
        from public.session_sets ss
        join public.plan_exercises pe on pe.id = ss.plan_exercise_id
        join public.exercises e on e.id = pe.exercise_id
        where ss.session_id = p_session_id
    )
    select jsonb_build_object(
        'id', o.id,
        'exercise_name', o.exercise_name,
        'set_number', o.set_number,
        'set_count', o.set_count,
        'expected_reps', o.expected_reps,
        'expected_weight', o.expected_weight
    )
    into next_set
    from ordered o
    where o.status = 'PENDING'
    order by o.exercise_order, o.set_number
    limit 1;

    select status into session_status
    from public.sessions
    where id = p_session_id;

    return jsonb_build_object(
        'set', updated_set,
        'next_set', next_set,
        'session_status', session_status
    );
end;
$$;

-- anon by design: the caller is a service worker holding only the token, which is why that token is
-- scoped to one session and one operation.
grant execute on function public.complete_session_set_with_action_token(text, uuid, uuid) to anon, authenticated, service_role;

comment on function complete_session_set_with_action_token(text, uuid, uuid) is
'Completes a session set on behalf of the user a session action token was minted for, without a JWT. Validates the token by hash, expiry and session, then delegates to internal_patch_session_set. Returns the updated set, the next pending set with its position in its exercise, and the resulting session status. Raises ACTION_TOKEN_INVALID (P0001) for any invalid token, and the SESSION_* errors of internal_patch_session_set.';

-- ========================================
-- PHASE 4: A finished workout has no live tokens
-- ========================================

-- Unchanged from 20260720110000 apart from the revocation at the end: a closed session's token has
-- no legitimate use left, so it should not stay spendable for the rest of its 12 hours.
create or replace function complete_session(
    p_session_id uuid,
    p_operations jsonb
)
returns void
language plpgsql
set search_path = ''
security invoker
as $$
declare
    session_status text;
begin
    -- Lock the session for the duration of the transaction. RLS restricts this to the caller's own
    -- sessions, so a missing row means "not found or not yours" - the same 404 either way.
    select status into session_status
    from public.sessions
    where id = p_session_id
    for update;

    if session_status is null then
        raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
    end if;

    -- Re-checked under the lock rather than trusted from the caller's earlier read. This is the
    -- whole point of the function: the API's assertion happened before the progressions were
    -- computed, and a competing completion could have landed in between.
    if session_status <> 'IN_PROGRESS' then
        raise exception 'SESSION_NOT_IN_PROGRESS' using errcode = 'P0001';
    end if;

    -- The batch carries the session's own row with status COMPLETED, so the write that releases
    -- the next caller from the lock is the one that makes it fail the check above.
    perform public.replace_collections_batch(p_operations);

    update public.session_action_tokens
    set revoked_at = now()
    where session_id = p_session_id
      and revoked_at is null;
end;
$$;

revoke execute on function public.complete_session(uuid, jsonb) from public, anon;
grant execute on function public.complete_session(uuid, jsonb) to authenticated, service_role;

comment on function complete_session(uuid, jsonb) is
'Atomically completes a training session: locks the session row, re-verifies under the lock that it is still IN_PROGRESS, applies the supplied replace_collections_batch operations, and revokes any live session action tokens. Serialises concurrent completions against each other and against patch_session_set, which takes the same lock. Runs as security invoker, so RLS governs which rows are visible. Raises SESSION_NOT_FOUND (P0002) or SESSION_NOT_IN_PROGRESS (P0001).';
