-- Instance-aware inspection history (phase 3). Replaces the single
-- `plant_instances.last_checked_at` timestamp (kept as-is for the quick
-- "Plant gecontroleerd" button) with a full log of individual inspections,
-- following the same FK/index/RLS pattern as plant_harvest_logs /
-- plant_pruning_logs / plant_repot_logs.

create table if not exists public.plant_inspection_logs (
  id uuid primary key default gen_random_uuid(),

  plant_instance_id uuid not null references public.plant_instances(id) on delete restrict,
  growing_season_id uuid references public.growing_seasons(id) on delete set null,

  checked_at date not null default current_date,
  health_status text,
  notes text,
  issues text,
  action_taken text,
  photo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plant_inspection_logs_plant_instance_id_idx
  on public.plant_inspection_logs (plant_instance_id);
create index if not exists plant_inspection_logs_growing_season_id_idx
  on public.plant_inspection_logs (growing_season_id);
create index if not exists plant_inspection_logs_checked_at_idx
  on public.plant_inspection_logs (checked_at);

drop trigger if exists set_plant_inspection_logs_updated_at on public.plant_inspection_logs;
create trigger set_plant_inspection_logs_updated_at
  before update on public.plant_inspection_logs
  for each row execute function public.set_updated_at();

alter table public.plant_inspection_logs enable row level security;

drop policy if exists "Authenticated users can do everything" on public.plant_inspection_logs;
create policy "Authenticated users can do everything" on public.plant_inspection_logs
  for all to authenticated using (true) with check (true);
