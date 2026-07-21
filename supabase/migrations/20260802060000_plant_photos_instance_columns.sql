-- Instance-aware photos (data-integrity pass). plant_photos was still
-- species-only (plant_id, on delete cascade) — two instances of the same
-- species had no way to keep their photos separate. Additive, nullable
-- columns only: existing rows get NULL (a legacy species-level photo,
-- rendered exactly as before), matching the pattern already used for
-- growth_log_entries / plant_harvest_logs / plant_pruning_logs /
-- plant_repot_logs.

alter table public.plant_photos
  add column if not exists plant_instance_id uuid references public.plant_instances(id) on delete set null,
  add column if not exists growing_season_id uuid references public.growing_seasons(id) on delete set null;

create index if not exists plant_photos_plant_instance_id_idx on public.plant_photos (plant_instance_id);
create index if not exists plant_photos_growing_season_id_idx on public.plant_photos (growing_season_id);
