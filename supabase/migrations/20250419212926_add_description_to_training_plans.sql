-- Migration: Add description column to training_plans
-- Description: Adds a description column to the training_plans table to allow users to provide detailed information about their training plans
-- Author: AI Assistant
-- Created: 2025-04-19

-- add description column to training_plans table
alter table "public"."training_plans" add column "description" text;

-- update existing rls policies to include the new column
-- note: no need to modify existing policies as they're based on user_id ownership
-- and not specific columns, but documenting this for clarity
