-- Run in Supabase SQL Editor. Latest diet / workout JSON per user (append history).
-- Backend inserts via PostgREST with service role (see app/services/supabase_store.py).
-- RLS: enable only if clients use anon key; service role bypasses RLS.

create table if not exists public.diet_plans (
  id bigserial primary key,
  user_id text not null,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists diet_plans_user_created_idx
  on public.diet_plans (user_id, created_at desc);

comment on table public.diet_plans is 'Eva: generated diet plan JSON per user; latest row per user by created_at desc.';

create table if not exists public.workout_plans (
  id bigserial primary key,
  user_id text not null,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists workout_plans_user_created_idx
  on public.workout_plans (user_id, created_at desc);

comment on table public.workout_plans is 'Eva: generated workout plan JSON per user; latest row per user by created_at desc.';
