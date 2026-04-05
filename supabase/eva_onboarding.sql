-- Run in Supabase SQL Editor (Dashboard → SQL → New query).
-- Run after eva_user_state.sql if applying all migrations; before eva_plans.sql.
--
-- DATA: This table holds onboarding / profile fields (health-adjacent: medical, measurements, goals).
-- Treat as sensitive. Do not expose the service_role key to browsers. Prefer backend-only writes.
-- PK user_id must match Supabase Auth JWT "sub" (text UUID) — same key the API uses for memory.
--
-- SYNC: Column set must match _ONBOARDING_COLUMNS in app/services/supabase_store.py (and OnboardingInput).
-- If you ALTER this table, update that frozenset and _onboarding_row_from_flat mapping.
--
-- UPSERTS: FastAPI calls upsert_onboarding_snapshot() whenever user memory is persisted (not only
-- onboarding HTTP routes), so this row stays aligned with the merged in-memory profile.

create table if not exists public.eva_onboarding (
  user_id text not null,
  constraint eva_onboarding_pkey primary key (user_id),

  onboarding_complete boolean not null default false,

  -- Step 1 — Basic
  age integer,
  weight double precision,
  height double precision,
  gender text,

  -- Medical
  medical_none_ack boolean not null default false,
  medical_conditions text[],
  medications text[],

  -- Lifestyle
  sleep_hours double precision,
  stress_level text,
  work_schedule text,

  -- Eating
  diet_type text,
  allergies text[],
  preferred_foods text[],
  disliked_foods text[],

  -- Goals
  goal text,
  activity_level text,
  target_weight_kg double precision,
  goal_timeline_weeks integer,

  -- Measurements
  measurements_na boolean not null default false,
  waist_cm double precision,
  body_fat_pct double precision,

  -- Fitness / personalization
  fitness_type text,
  gym_level text,
  sport_type text,
  training_intensity text,
  training_environment text,
  display_name text,
  timezone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eva_onboarding_updated_at_idx
  on public.eva_onboarding (updated_at desc);

comment on table public.eva_onboarding is 'Eva onboarding fields aligned with OnboardingInput / wizard mapPayloadFull. user_id = JWT sub (text).';

-- Keep updated_at fresh on row updates
create or replace function public.eva_onboarding_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists eva_onboarding_set_updated_at on public.eva_onboarding;
create trigger eva_onboarding_set_updated_at
  before update on public.eva_onboarding
  for each row
  execute function public.eva_onboarding_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS (optional — enable if clients use anon/authenticated Supabase keys on this table)
-- The FastAPI backend uses the service role key; it bypasses RLS. End-user JWT policies
-- matter only for direct browser PostgREST access.
--
-- Example (uncomment and adjust to your auth model; sub must match user_id):
--
-- alter table public.eva_onboarding enable row level security;
--
-- create policy "Users read own onboarding"
--   on public.eva_onboarding for select
--   to authenticated
--   using (user_id = (select auth.jwt() ->> 'sub'));
--
-- create policy "Users insert own onboarding"
--   on public.eva_onboarding for insert
--   to authenticated
--   with check (user_id = (select auth.jwt() ->> 'sub'));
--
-- create policy "Users update own onboarding"
--   on public.eva_onboarding for update
--   to authenticated
--   using (user_id = (select auth.jwt() ->> 'sub'))
--   with check (user_id = (select auth.jwt() ->> 'sub'));
-- -----------------------------------------------------------------------------
