-- Additive, nullable instance/season linkage for the remaining per-plant log
-- tables, following the same phased approach as growth_log_entries: existing
-- `plant_id` (species-level FK) is left untouched, new columns are added
-- alongside so future writes from the instance UI can populate them without
-- a breaking foreign-key change. No backfill here — unlike growth_log_entries
-- these logs already always have a non-null plant_id, but resolving which
-- specific instance/season they belonged to at the time cannot be inferred
-- more reliably than for growth log entries, so they are left as legacy
-- until the instance-aware recording UI for harvest/pruning/repot exists.
alter table public.plant_harvest_logs
  add column if not exists plant_instance_id uuid references public.plant_instances(id) on delete restrict,
  add column if not exists growing_season_id uuid references public.growing_seasons(id) on delete restrict;

alter table public.plant_pruning_logs
  add column if not exists plant_instance_id uuid references public.plant_instances(id) on delete restrict,
  add column if not exists growing_season_id uuid references public.growing_seasons(id) on delete restrict;

alter table public.plant_repot_logs
  add column if not exists plant_instance_id uuid references public.plant_instances(id) on delete restrict,
  add column if not exists growing_season_id uuid references public.growing_seasons(id) on delete restrict;

create index if not exists plant_harvest_logs_plant_instance_id_idx on public.plant_harvest_logs (plant_instance_id);
create index if not exists plant_pruning_logs_plant_instance_id_idx on public.plant_pruning_logs (plant_instance_id);
create index if not exists plant_repot_logs_plant_instance_id_idx on public.plant_repot_logs (plant_instance_id);

-- Safe auto-link, same rule as growth_log_entries' first pass: only when the
-- species has exactly one migrated instance (never guessed otherwise).
with unambiguous_species as (
  select pi.legacy_plant_id as plant_id, pi.id as plant_instance_id
  from public.plant_instances pi
  where pi.legacy_plant_id is not null
  group by pi.legacy_plant_id, pi.id
  having (select count(*) from public.plant_instances pi2 where pi2.species_id = pi.species_id) = 1
),
active_season as (
  select gs.plant_instance_id, gs.id as growing_season_id
  from public.growing_seasons gs
  where gs.status = 'active'
)
update public.plant_harvest_logs l
set plant_instance_id = us.plant_instance_id, growing_season_id = asn.growing_season_id
from unambiguous_species us
join active_season asn on asn.plant_instance_id = us.plant_instance_id
where l.plant_id = us.plant_id and l.plant_instance_id is null;

with unambiguous_species as (
  select pi.legacy_plant_id as plant_id, pi.id as plant_instance_id
  from public.plant_instances pi
  where pi.legacy_plant_id is not null
  group by pi.legacy_plant_id, pi.id
  having (select count(*) from public.plant_instances pi2 where pi2.species_id = pi.species_id) = 1
),
active_season as (
  select gs.plant_instance_id, gs.id as growing_season_id
  from public.growing_seasons gs
  where gs.status = 'active'
)
update public.plant_pruning_logs l
set plant_instance_id = us.plant_instance_id, growing_season_id = asn.growing_season_id
from unambiguous_species us
join active_season asn on asn.plant_instance_id = us.plant_instance_id
where l.plant_id = us.plant_id and l.plant_instance_id is null;

with unambiguous_species as (
  select pi.legacy_plant_id as plant_id, pi.id as plant_instance_id
  from public.plant_instances pi
  where pi.legacy_plant_id is not null
  group by pi.legacy_plant_id, pi.id
  having (select count(*) from public.plant_instances pi2 where pi2.species_id = pi.species_id) = 1
),
active_season as (
  select gs.plant_instance_id, gs.id as growing_season_id
  from public.growing_seasons gs
  where gs.status = 'active'
)
update public.plant_repot_logs l
set plant_instance_id = us.plant_instance_id, growing_season_id = asn.growing_season_id
from unambiguous_species us
join active_season asn on asn.plant_instance_id = us.plant_instance_id
where l.plant_id = us.plant_id and l.plant_instance_id is null;
