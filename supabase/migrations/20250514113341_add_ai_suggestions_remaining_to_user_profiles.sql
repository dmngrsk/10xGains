-- Migration: Add ai_suggestions_remaining column to user_profiles
-- Description: Adds a ai_suggestions_remaining column to the user_profiles table to use when performing AI-assisted training plan suggestions
-- Author: dmngrsk
-- Created: 2025-05-14

-- add ai_suggestions_remaining column to user_profiles table
alter table "public"."user_profiles" add column "ai_suggestions_remaining" integer not null default 0;

-- update existing rls policies to include the new column
-- note: no need to modify existing policies as they're based on user_id ownership
-- and not specific columns, but documenting this for clarity
