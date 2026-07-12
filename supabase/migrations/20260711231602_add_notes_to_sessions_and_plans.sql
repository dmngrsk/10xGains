-- Migration: Add notes columns to sessions and plans
-- Description: Adds a nullable notes column to the sessions and plans tables so users can
--              attach a single free-text note to a workout session and to a training plan.
--              Notes are capped at 5000 characters (defense in depth alongside API validation).
-- Affected tables: sessions, plans
-- Author: AI Assistant
-- Created: 2026-07-11

-- add notes column to sessions table (one note per session)
alter table "public"."sessions" add column "notes" text;

-- add notes column to plans table (one note per plan, distinct from the existing description column)
alter table "public"."plans" add column "notes" text;

-- enforce the 5000-character limit at the database level
alter table "public"."sessions" add constraint "sessions_notes_length_check" check (char_length(notes) <= 5000);
alter table "public"."plans" add constraint "plans_notes_length_check" check (char_length(notes) <= 5000);

-- no rls policy changes required: existing policies on sessions and plans are based on
-- user_id ownership, not specific columns, so the new column is covered automatically
