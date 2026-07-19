-- Per-plant log tables. Same ownership/RLS pattern as the existing
-- public.plant_photos table (shared household access, not per-user
-- isolation — this app is a shared family tool, every other table
-- follows this same "authenticated can do everything" policy).

create table if not exists public.plant_harvest_logs (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  harvested_at date not null default current_date,
  weight_grams numeric(10, 2),
  quantity numeric(10, 2),
  unit text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.plant_pruning_logs (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  pruned_at date not null default current_date,
  pruning_type text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.plant_repot_logs (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  repotted_at date not null default current_date,
  old_pot_size_liters integer,
  new_pot_size_liters integer,
  pot_material text,
  soil_type text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.plant_notes (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  note_date date not null default current_date,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plant_harvest_logs_plant_id_idx on public.plant_harvest_logs(plant_id);
create index if not exists plant_harvest_logs_harvested_at_idx on public.plant_harvest_logs(harvested_at);

create index if not exists plant_pruning_logs_plant_id_idx on public.plant_pruning_logs(plant_id);
create index if not exists plant_pruning_logs_pruned_at_idx on public.plant_pruning_logs(pruned_at);

create index if not exists plant_repot_logs_plant_id_idx on public.plant_repot_logs(plant_id);
create index if not exists plant_repot_logs_repotted_at_idx on public.plant_repot_logs(repotted_at);

create index if not exists plant_notes_plant_id_idx on public.plant_notes(plant_id);
create index if not exists plant_notes_note_date_idx on public.plant_notes(note_date);

alter table public.plant_harvest_logs enable row level security;
alter table public.plant_pruning_logs enable row level security;
alter table public.plant_repot_logs enable row level security;
alter table public.plant_notes enable row level security;

create policy "Authenticated users can do everything" on public.plant_harvest_logs
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.plant_pruning_logs
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.plant_repot_logs
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.plant_notes
  for all to authenticated using (true) with check (true);
