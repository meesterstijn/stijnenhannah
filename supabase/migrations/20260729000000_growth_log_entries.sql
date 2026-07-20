-- Migrates the "Groeilogboek" from device-local localStorage to Supabase,
-- so entries sync across devices/users like every other table in this app.
-- Column shape mirrors the existing client-side LogEntry type 1:1 so the
-- migration is a pure storage swap, not a data-model redesign.
create table if not exists public.growth_log_entries (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references public.plants(id) on delete cascade,
  plant_name text not null,
  entry_date date not null default current_date,
  height_cm numeric(10, 2),
  flower_count integer,
  fruit_count integer,
  notes text,
  watered boolean not null default false,
  fertilized boolean not null default false,
  photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists growth_log_entries_plant_id_idx on public.growth_log_entries(plant_id);
create index if not exists growth_log_entries_plant_name_idx on public.growth_log_entries(plant_name);
create index if not exists growth_log_entries_entry_date_idx on public.growth_log_entries(entry_date);

alter table public.growth_log_entries enable row level security;

create policy "Authenticated users can do everything" on public.growth_log_entries
  for all to authenticated using (true) with check (true);
