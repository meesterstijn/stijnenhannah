-- Introduces the species/instance/season split for the garden feature.
-- `plants` remains the permanent species catalog (botanical + care advice).
-- `plant_instances` represents one physical planted specimen of a species;
-- multiple instances may point at the same species_id. `growing_seasons`
-- represents one cultivation round for one instance. Neither new table ever
-- deletes a species — species_id uses `on delete restrict`.

create table if not exists public.plant_instances (
  id uuid primary key default gen_random_uuid(),

  species_id uuid not null references public.plants(id) on delete restrict,

  custom_name text,
  location text,

  -- "pot" | "open_ground" | "raised_bed" | "greenhouse"
  cultivation_type text,

  pot_size_liters integer,
  pot_material text,
  pot_color text,
  soil_type text,
  soil_mix_notes text,

  -- Matches the data types of the equivalent legacy fields on `plants`
  -- (planted_at/last_watered_at/last_fed_at are timestamptz there; the
  -- date-only fields below match their `plants` counterparts too).
  planted_at timestamptz,
  acquired_at date,
  source text,
  price numeric(10, 2),

  health_status text,
  last_checked_at date,
  last_repotted_at date,

  first_flower_at date,
  first_fruit_at date,

  reminders_enabled boolean not null default true,
  feeding_reminders_enabled boolean not null default true,

  last_watered_at timestamptz,
  last_fed_at timestamptz,
  last_water_reminder_sent_at timestamptz,
  last_feeding_reminder_sent_at timestamptz,
  water_skip_until date,

  status text not null default 'active'
    check (status in ('active', 'dormant', 'archived', 'dead', 'removed')),

  -- Set only for instances auto-created by the one-time migration of
  -- existing `plants.planted = true` rows; used to make that migration
  -- idempotent (see the unique partial index below).
  legacy_plant_id uuid references public.plants(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plant_instances_species_id_idx on public.plant_instances (species_id);
create index if not exists plant_instances_status_idx on public.plant_instances (status);
create index if not exists plant_instances_created_at_idx on public.plant_instances (created_at);

-- At most one auto-migrated instance per legacy plants row, so re-running
-- the migration script never creates duplicates.
create unique index if not exists plant_instances_legacy_plant_id_uidx
  on public.plant_instances (legacy_plant_id)
  where legacy_plant_id is not null;

create table if not exists public.growing_seasons (
  id uuid primary key default gen_random_uuid(),

  plant_instance_id uuid not null references public.plant_instances(id) on delete restrict,

  year integer not null,
  label text,

  started_at date not null,
  ended_at date,

  status text not null default 'active'
    check (status in ('active', 'completed', 'failed')),

  closing_reason text,
  closing_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growing_seasons_plant_instance_id_idx on public.growing_seasons (plant_instance_id);
create index if not exists growing_seasons_status_idx on public.growing_seasons (status);
create index if not exists growing_seasons_year_idx on public.growing_seasons (year);

-- At most one active season per instance.
create unique index if not exists growing_seasons_one_active_per_instance_uidx
  on public.growing_seasons (plant_instance_id)
  where status = 'active';

-- updated_at housekeeping, matching a plain trigger (no equivalent existed
-- yet in this project since no prior table had updated_at).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_plant_instances_updated_at on public.plant_instances;
create trigger set_plant_instances_updated_at
  before update on public.plant_instances
  for each row execute function public.set_updated_at();

drop trigger if exists set_growing_seasons_updated_at on public.growing_seasons;
create trigger set_growing_seasons_updated_at
  before update on public.growing_seasons
  for each row execute function public.set_updated_at();

-- Same RLS pattern as every other plant-related table in this project: a
-- shared-household app, not multi-tenant, so authenticated users share
-- everything (see plants/growth_log_entries/plant_*_logs policies).
alter table public.plant_instances enable row level security;
alter table public.growing_seasons enable row level security;

drop policy if exists "Authenticated users can do everything" on public.plant_instances;
create policy "Authenticated users can do everything" on public.plant_instances
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can do everything" on public.growing_seasons;
create policy "Authenticated users can do everything" on public.growing_seasons
  for all to authenticated using (true) with check (true);
