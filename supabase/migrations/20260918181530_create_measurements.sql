-- Migration: Body measurement tracking
-- Description: Adds `measurements`, the first user data in this schema that descends from neither
--   a plan nor a session: a time series keyed only on the user and a date. It backs the Body tab
--   of /progress and the body-fat estimates derived from it.
--
--   Special considerations, each of which the shape here depends on:
--
--   1. `measured_on` is a `date`, not a timestamp. A weigh-in's time of day is noise, unlike
--      `sessions.session_date` where it is signal. It also makes "a full week has passed" a plain
--      date comparison, so measuring on a Saturday morning never blocks measuring the next
--      Saturday morning.
--
--   2. One row per type per day (`unique (user_id, measured_on, type)`), so re-logging a type on a
--      day is an edit rather than an append, and a chart point is never ambiguous.
--
--   3. The table is TALL - one row per type - rather than one row per day with a column per type.
--      Adding a type is then a check-constraint change, not a migration per column.
--
--   4. A derived body fat is NOT stored. It is computed per request from the rows below by the
--      US Navy or Jackson-Pollock formulas, so correcting a waist entry cannot leave a stale
--      estimate behind.
--
--      The one figure that IS stored is `BODY_FAT`, which the user types in from a scale or a
--      scan under the MANUAL method. It is a reading like any other, not an estimate, and the
--      two never coexist: a profile names one method, and MANUAL derives nothing. That is what
--      keeps instrument bias off the chart - a scale's figure and a formula's differ by several
--      percentage points, and one line through both would invent a trend out of the difference.
--
--   5. `HEIGHT` is NOT here. It is `profiles.height_cm`: set once, in Settings, like a
--      configuration value rather than a round of measuring. Every type in this table is something
--      the user re-observes over time and charts; height is neither.
--
--   6. The caliper sites carry a `SKINFOLD_` prefix because three of them collide with
--      circumferences already in the catalog. JP-3 (male) needs chest, abdomen and thigh
--      *pinches*, while `CHEST` and `THIGH` are tape measurements: different instruments,
--      different units (mm against cm), and so different types.
-- Author: AI Assistant
-- Created: 2026-09-18

-- ---------------------------------------------------------------------------------------------
-- measurements
-- ---------------------------------------------------------------------------------------------

create table if not exists public.measurements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    measured_on date not null,
    type varchar(30) not null,
    value numeric(7,3) not null,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    -- The closed catalog of what may be measured. Mirrored by MEASUREMENT_TYPES in
    -- @txg/shared/domain.types.ts, which proves the TypeScript union exhaustive against it.
    constraint measurements_type_check check (type in (
        'BODY_WEIGHT',
        -- A percentage read off a scale or a scan and typed in, for the MANUAL method. The only
        -- body-fat figure that is ever stored: every other method derives one on read.
        'BODY_FAT',
        'NECK',
        'CHEST',
        'WAIST',
        'HIPS',
        'THIGH',
        'CALF',
        'BICEPS',
        'FOREARM',
        -- Caliper sites, in millimetres. JP-3 (male) uses chest/abdomen/thigh, JP-3 (female) uses
        -- triceps/suprailiac/thigh, and JP-7 uses all seven.
        'SKINFOLD_CHEST',
        'SKINFOLD_ABDOMEN',
        'SKINFOLD_THIGH',
        'SKINFOLD_TRICEPS',
        'SKINFOLD_SUBSCAPULAR',
        'SKINFOLD_SUPRAILIAC',
        'SKINFOLD_MIDAXILLARY'
    )),

    -- Zero is not a body measurement in any of the units used here (kg, cm, mm).
    constraint measurements_value_check check (value > 0),

    -- One reading per type per day; see note 2 above.
    constraint measurements_user_date_type_unique unique (user_id, measured_on, type)
);

comment on table public.measurements is
'Body measurements over time, one row per type per day. A derived body fat is not stored here: it is computed from these readings on read. A manually entered one is, as the BODY_FAT type.';

comment on column public.measurements.measured_on is
'The day the measurement was taken. A date, not a timestamp: time of day is noise, and whole-day arithmetic is what the reminder cadence needs.';

comment on column public.measurements.value is
'The reading in the canonical unit of its type - kg for BODY_WEIGHT, cm for the circumferences, mm for the skinfolds, percent for BODY_FAT. The unit is a property of the type and is not stored per row.';

-- The shape of every series read: one user, one type, ordered over time.
create index if not exists idx_measurements_user_type_date
    on public.measurements (user_id, type, measured_on);

-- Reused from migration 20250417110641, which defines it for profiles.
create trigger update_measurements_updated_at
before update on public.measurements
for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------------------------
-- measurements: row level security
-- ---------------------------------------------------------------------------------------------

alter table public.measurements enable row level security;

-- Private data with no public dimension, so anon is denied outright rather than given a
-- narrower policy, matching plans/sessions.
create policy "measurements_anon_no_access" on public.measurements
    for all to anon
    using (false);

-- `(select auth.uid())` rather than a bare call, so Postgres evaluates it once per statement
-- instead of once per row.
create policy "measurements_authenticated_select" on public.measurements
    for select to authenticated
    using (user_id = (select auth.uid()));

create policy "measurements_authenticated_insert" on public.measurements
    for insert to authenticated
    with check (user_id = (select auth.uid()));

create policy "measurements_authenticated_update" on public.measurements
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy "measurements_authenticated_delete" on public.measurements
    for delete to authenticated
    using (user_id = (select auth.uid()));

-- RLS decides which rows; these grant the table privileges Postgres checks first. See
-- migration 20260710132756 for why the migration runner's tables need them explicitly.
grant select, insert, update, delete on public.measurements to authenticated;
grant select, insert, update, delete on public.measurements to service_role;

-- ---------------------------------------------------------------------------------------------
-- profiles: what body-fat estimation needs that is not itself a measurement
-- ---------------------------------------------------------------------------------------------
-- The dividing line: anything the user re-observes over time and charts is a row in
-- `measurements`; anything that identifies or configures them, however it was arrived at, is a
-- column here. Height and date of birth are therefore both here.

alter table public.profiles
    add column if not exists date_of_birth date null,
    add column if not exists height_cm numeric(4,1) null,
    add column if not exists body_fat_method varchar(20) null,
    add column if not exists sex varchar(10) null,
    add column if not exists measurement_frequency_days smallint null,
    add column if not exists tracked_measurement_types text[] null;

alter table public.profiles
    drop constraint if exists profiles_body_fat_method_check,
    drop constraint if exists profiles_sex_check,
    drop constraint if exists profiles_height_cm_check,
    drop constraint if exists profiles_measurement_frequency_days_check;

alter table public.profiles
    add constraint profiles_body_fat_method_check
    check (body_fat_method is null or body_fat_method in ('NAVY', 'JP3', 'JP7', 'MANUAL'));

alter table public.profiles
    add constraint profiles_sex_check
    check (sex is null or sex in ('MALE', 'FEMALE'));

-- Bounded rather than just positive: the Navy equation divides by the log of height, so a zero or
-- a typo'd 18 cm would produce a plausible-looking percentage from an impossible body.
alter table public.profiles
    add constraint profiles_height_cm_check
    check (height_cm is null or height_cm between 50 and 300);

alter table public.profiles
    add constraint profiles_measurement_frequency_days_check
    check (measurement_frequency_days is null or measurement_frequency_days between 1 and 365);

comment on column public.profiles.date_of_birth is
'Used only to derive age at a measurement date for the Jackson-Pollock formulas, which take age as a term. Stored as a birth date rather than an age, so a historical estimate uses the age the user was then.';

comment on column public.profiles.body_fat_method is
'Which formula estimates this user''s body fat, and so which measurements the log dialog asks for and which estimate the chart draws. Null means no estimate is computed.';

comment on column public.profiles.sex is
'Selects which coefficients a body-fat formula uses. Null simply means the estimates needing it are not computed.';

comment on column public.profiles.height_cm is
'The user''s height, the one term the US Navy equation needs that is not re-measured each round. A profile setting rather than a measurement row: it is set once in Settings and never charted.';

comment on column public.profiles.measurement_frequency_days is
'How many whole days between measurement reminders on the home page. Null means the user has not opted in and is never prompted.';

comment on column public.profiles.tracked_measurement_types is
'The measurement types this user tracks: what the Body chart offers as chips and what the log dialog asks for. Null means unset. Values are constrained by the client and the API against the measurements type catalog rather than by a check here, because the column is a set rather than a single value.';
