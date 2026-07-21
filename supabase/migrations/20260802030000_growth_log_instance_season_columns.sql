-- Adds instance/season linkage to the growth log, additively. Nullable —
-- existing rows (many with plant_id null, matched only by plant_name, see
-- PlantLogboek/TuingidsLogboek legacy free-text entries) cannot be reliably
-- backfilled and are left as legacy/unlinked rather than guessed at.
-- New entries recorded from a concrete plant instance populate both.
alter table public.growth_log_entries
  add column if not exists plant_instance_id uuid references public.plant_instances(id) on delete restrict,
  add column if not exists growing_season_id uuid references public.growing_seasons(id) on delete restrict;

create index if not exists growth_log_entries_plant_instance_id_idx on public.growth_log_entries (plant_instance_id);
create index if not exists growth_log_entries_growing_season_id_idx on public.growth_log_entries (growing_season_id);

-- Safe auto-link pass: only for entries whose legacy plant_id already
-- resolves to a species with EXACTLY one migrated instance and that
-- instance's currently active season — never guessed by name, never
-- applied when a species has multiple instances (ambiguous).
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
update public.growth_log_entries gle
set
  plant_instance_id = us.plant_instance_id,
  growing_season_id = asn.growing_season_id
from unambiguous_species us
join active_season asn on asn.plant_instance_id = us.plant_instance_id
where gle.plant_id = us.plant_id
  and gle.plant_instance_id is null;

-- Second pass: legacy free-text entries with no plant_id at all (added via
-- the standalone Logboek page's manual name field). Linked only when the
-- name matches exactly one species AND that species has exactly one
-- instance — never guessed when either is ambiguous.
with name_matched_species as (
  select p.id as plant_id, p.name
  from public.plants p
  group by p.id, p.name
  having (select count(*) from public.plants p2 where p2.name = p.name) = 1
),
unambiguous_species2 as (
  select pi.species_id, pi.id as plant_instance_id
  from public.plant_instances pi
  group by pi.species_id, pi.id
  having (select count(*) from public.plant_instances pi2 where pi2.species_id = pi.species_id) = 1
),
active_season2 as (
  select gs.plant_instance_id, gs.id as growing_season_id
  from public.growing_seasons gs
  where gs.status = 'active'
)
update public.growth_log_entries gle
set
  plant_instance_id = us2.plant_instance_id,
  growing_season_id = asn2.growing_season_id
from name_matched_species nms
join unambiguous_species2 us2 on us2.species_id = nms.plant_id
join active_season2 asn2 on asn2.plant_instance_id = us2.plant_instance_id
where gle.plant_id is null
  and gle.plant_name = nms.name
  and gle.plant_instance_id is null;
