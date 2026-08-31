-- Macros — v1 schema (spec §4). Run once in the Supabase SQL editor.
-- Every table carries user_id defaulting to auth.uid(); RLS is the only
-- authorization layer, since the frontend talks to PostgREST directly.

create table public.foods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id),
  name        text not null,
  brand       text,
  barcode     text,                          -- EAN/UPC as scanned, nullable
  serving_desc text not null,                -- "1 cup cooked", "1 bar", "100 g"
  calories    numeric not null,
  protein_g   numeric not null default 0,
  carbs_g     numeric not null default 0,
  fat_g       numeric not null default 0,
  fiber_g     numeric,
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now()
);
create index foods_user_barcode on public.foods (user_id, barcode);

create table public.log_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id),
  logged_date date not null,
  meal        text not null check (meal in ('breakfast','lunch','dinner','snack')),
  food_id     uuid references public.foods(id) on delete set null,
  name        text not null,                 -- snapshot of food name at log time
  servings    numeric not null default 1,
  calories    numeric not null,              -- snapshot totals for this entry
  protein_g   numeric not null,
  carbs_g     numeric not null,
  fat_g       numeric not null,
  created_at  timestamptz not null default now()
);
create index log_user_date on public.log_entries (user_id, logged_date);

create table public.settings (
  user_id        uuid primary key default auth.uid() references auth.users(id),
  calorie_target int not null default 1850,
  protein_min_g  int not null default 140,
  protein_max_g  int not null default 160,
  updated_at     timestamptz not null default now()
);

alter table public.foods       enable row level security;
alter table public.log_entries enable row level security;
alter table public.settings    enable row level security;

create policy "own rows" on public.foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.log_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
