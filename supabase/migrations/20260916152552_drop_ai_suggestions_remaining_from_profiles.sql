-- Migration: Drop ai_suggestions_remaining from profiles
-- Description: Removes `profiles.ai_suggestions_remaining`, added in migration 20250514113341 for
--   AI-assisted plan suggestions that were never built. Nothing reads it: the settings page never
--   displayed it, and the API only copied the stored value back on every profile upsert.
--
--   Special consideration: destructive. The stored counts are discarded and cannot be recovered
--   from this migration; they have only ever held the default of 0. CD migrates the database
--   before deploying the API, and the API still deployed at that moment writes this column on
--   profile upserts, so saving a profile or activating a plan fails until the new API is out.
-- Author: AI Assistant
-- Created: 2026-09-16

-- No view, function or policy references the column, so a plain drop is enough.
alter table public.profiles
    drop column if exists ai_suggestions_remaining;
