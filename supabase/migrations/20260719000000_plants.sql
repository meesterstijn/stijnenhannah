-- Plant care tracking: what each plant needs to grow, plus a watering
-- reminder and a simple photo timeline (pasted links, no storage bucket yet).

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text,
  location text,
  sun_needs text,
  season_notes text,
  water_notes text,
  water_interval_days integer,
  last_watered_at timestamptz,
  last_water_reminder_sent_at timestamptz,
  feeding_notes text,
  soil_notes text,
  temperature_notes text,
  humidity_notes text,
  pruning_notes text,
  pest_notes text,
  toxicity_notes text,
  harvest_notes text,
  photo_url text,
  reminders_enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.plant_photos (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  photo_url text not null,
  note text,
  taken_at timestamptz not null default now()
);

alter table public.plants enable row level security;
alter table public.plant_photos enable row level security;

create policy "Authenticated users can do everything" on public.plants
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.plant_photos
  for all to authenticated using (true) with check (true);
