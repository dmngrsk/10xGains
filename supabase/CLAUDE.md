# Supabase (Database)

Supabase provides PostgreSQL and authentication. This directory contains database migrations, database tests, and the local stack configuration. The API compute layer lives in `apps/api`, not here.

## Creating a Migration

Migrations are managed by the Supabase CLI and live in `supabase/migrations/`.

The file MUST be named `YYYYMMDDHHmmss_short_description.sql` using the current UTC date and time:

1. `YYYY` - Four digits for the year (e.g., `2024`).
2. `MM` - Two digits for the month (01 to 12).
3. `DD` - Two digits for the day of the month (01 to 31).
4. `HH` - Two digits for the hour in 24-hour format (00 to 23).
5. `mm` - Two digits for the minute (00 to 59).
6. `ss` - Two digits for the second (00 to 59).

For example: `20240906123045_create_profiles.sql`.

## SQL Guidelines

Write Postgres-compatible SQL code for Supabase migration files that:

- Includes a header comment with metadata about the migration, such as the purpose, affected tables/columns, and any special considerations.
- Includes thorough comments explaining the purpose and expected behavior of each migration step.
- Matches the syntax from previous migrations.
- Writes all SQL in lowercase.
- Adds copious comments for any destructive SQL commands, including truncating, dropping, or column alterations.
- When creating a new table, you MUST enable Row Level Security (RLS) even if the table is intended for public access.
- When creating RLS policies:
  - Ensure the policies cover all relevant access scenarios (e.g. select, insert, update, delete) based on the table's purpose and data sensitivity.
  - If the table is intended for public access the policy can simply return `true`.
  - RLS policies should be granular: one policy per operation (`select`, `insert`, etc.) and per Supabase role (`anon`, `authenticated`). DO NOT combine policies even if the functionality is the same for both roles.
  - Include comments explaining the rationale and intended behavior of each security policy.

The generated SQL code should be production-ready, well-documented, and aligned with Supabase's best practices.
