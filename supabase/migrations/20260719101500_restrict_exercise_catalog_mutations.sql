-- Migration: Restrict mutations of the shared exercise catalog
-- Description: The API refuses exercise updates and deletes outright ("requires admin role"), but
--   RLS was more permissive than the API: `exercises_authenticated_update` allowed any
--   authenticated user to update any exercise as long as no *other* user's plan referenced it, and
--   `exercises_authenticated_delete` allowed deleting any exercise no plan referenced at all.
--   Because clients hold the publishable key and can talk to PostgREST directly, users could rename
--   or delete shared catalog entries around the API, making the API-level block ineffective.
--
--   This aligns the database with the API's actual policy: the catalog is readable by everyone and
--   still open to inserts (adding a new exercise is a supported user action), but updates and
--   deletes are not available to end users at all. Should an admin capability be added later, it
--   belongs to a role that is not `authenticated`.
--
--   Special consideration: the update and delete policies are dropped rather than tightened, and the
--   corresponding table privileges are revoked as well. Policies alone would not be enough - a
--   future permissive policy plus a lingering grant would silently re-open the hole - and revoking
--   the grant means Postgres rejects the statement before any policy is consulted.
-- Author: AI Assistant
-- Created: 2026-07-19

-- Destructive: removes the ability for `authenticated` to update or delete catalog rows. No data is
-- affected; only the permission to modify it. Reads and inserts are deliberately left untouched.
drop policy if exists "exercises_authenticated_update" on "public"."exercises";
drop policy if exists "exercises_authenticated_delete" on "public"."exercises";

-- Remove the underlying privileges so the restriction does not depend on policy coverage alone.
revoke update, delete on public.exercises from authenticated;

-- service_role keeps full CRUD: it bypasses RLS, is never exposed to end users, and backs trusted
-- server-side tooling such as the Cypress seeders that need to clean up catalog rows.
