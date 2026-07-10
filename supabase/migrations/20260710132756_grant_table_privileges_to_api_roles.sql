-- Migration: Grant table privileges to API roles
-- Description: Grants the base Postgres table privileges (select/insert/update/delete)
--   that RLS policies alone do not provide, to the anon, authenticated, and service_role
--   roles used by PostgREST. Without these grants, Postgres rejects every query for these
--   roles with "permission denied for table ..." before RLS policies are ever evaluated,
--   because the CLI migration runner creates tables as the postgres role, whose default
--   privileges only include truncate/references/trigger (unlike supabase_admin, which
--   backs the Table Editor UI and grants full CRUD by default).
--   service_role has BYPASSRLS (it skips policy checks entirely), but that only skips row
--   security - it does not imply the underlying table privileges, so it needs the same
--   explicit grants as authenticated. It is used by trusted server-side tooling only (e.g.
--   the Cypress test-data seeders authenticating with the secret key), never exposed to
--   end users, so granting it full CRUD regardless of ownership is intentional.
-- Author: AI Assistant
-- Created: 2026-07-10

-- profiles: authenticated may select/insert/update its own row (id = auth.uid()); there is
-- no delete policy, so delete is intentionally not granted. anon has no access policy, so
-- no grant is made for anon either. service_role gets the same operations as authenticated.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;

-- exercises: shared reference data readable by anon and authenticated; only authenticated
-- may insert/update/delete, per the exercises_authenticated_* policies. service_role gets
-- the same full CRUD as authenticated.
grant select on public.exercises to anon;
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.exercises to service_role;

-- plans, plan_days, plan_exercises, plan_exercise_sets, plan_exercise_progressions,
-- sessions, session_sets: fully owned by the authenticated user (user_id = auth.uid(),
-- enforced transitively through their parent plan/session); anon is denied entirely by
-- an explicit "no_access" policy, so no grant is made for anon. service_role gets the same
-- full CRUD as authenticated, across any user's rows, since RLS is bypassed for that role.
grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, update, delete on public.plans to service_role;
grant select, insert, update, delete on public.plan_days to authenticated;
grant select, insert, update, delete on public.plan_days to service_role;
grant select, insert, update, delete on public.plan_exercises to authenticated;
grant select, insert, update, delete on public.plan_exercises to service_role;
grant select, insert, update, delete on public.plan_exercise_sets to authenticated;
grant select, insert, update, delete on public.plan_exercise_sets to service_role;
grant select, insert, update, delete on public.plan_exercise_progressions to authenticated;
grant select, insert, update, delete on public.plan_exercise_progressions to service_role;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.sessions to service_role;
grant select, insert, update, delete on public.session_sets to authenticated;
grant select, insert, update, delete on public.session_sets to service_role;
