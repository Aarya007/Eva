-- Run in Supabase SQL Editor (Dashboard → SQL → New query).
-- Persists per-user onboarding / memory state for the Eva FastAPI backend (service role).

create table if not exists public.eva_user_state (
  user_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists eva_user_state_updated_at_idx
  on public.eva_user_state (updated_at desc);

comment on table public.eva_user_state is 'Eva app: nested user memory keyed by auth JWT sub (text). Written only by backend with service role.';
