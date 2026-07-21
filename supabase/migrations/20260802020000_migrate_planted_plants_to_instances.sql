-- One-time data migration: every existing `plants` row with `planted = true`
-- gets exactly one `plant_instances` row (status 'active') and one active
-- `growing_seasons` row. Idempotent via the NOT EXISTS guard below plus the
-- unique partial index on `legacy_plant_id` created in the previous
-- migration — re-running this file can never create duplicates.
--
-- Instance fields are copied 1:1 from the matching legacy instance-level
-- columns on `plants` (see 20260728000000_plant_individual_tracking_fields.sql
-- and later additions) — nothing is invented or guessed.

with migrated_instances as (
  insert into public.plant_instances (
    species_id,
    custom_name,
    location,
    cultivation_type,
    pot_size_liters,
    pot_material,
    pot_color,
    soil_type,
    soil_mix_notes,
    planted_at,
    acquired_at,
    source,
    price,
    health_status,
    last_checked_at,
    last_repotted_at,
    first_flower_at,
    first_fruit_at,
    reminders_enabled,
    feeding_reminders_enabled,
    last_watered_at,
    last_fed_at,
    last_water_reminder_sent_at,
    last_feeding_reminder_sent_at,
    water_skip_until,
    status,
    legacy_plant_id
  )
  select
    p.id,
    p.name,
    p.location,
    case p.growing_method
      when 'Pot' then 'pot'
      when 'Volle grond' then 'open_ground'
      else null
    end,
    p.pot_size_liters,
    p.pot_material,
    p.pot_color,
    p.soil_type,
    p.soil_mix_notes,
    p.planted_at,
    p.acquired_at,
    p.source,
    p.price,
    p.health_status,
    p.last_checked_at,
    p.last_repotted_at,
    p.first_flower_at,
    p.first_fruit_at,
    p.reminders_enabled,
    p.feeding_reminders_enabled,
    p.last_watered_at,
    p.last_fed_at,
    p.last_water_reminder_sent_at,
    p.last_feeding_reminder_sent_at,
    p.water_skip_until,
    'active',
    p.id
  from public.plants p
  where p.planted = true
    and not exists (
      select 1 from public.plant_instances pi where pi.legacy_plant_id = p.id
    )
  returning id, planted_at, acquired_at
)
insert into public.growing_seasons (plant_instance_id, year, label, started_at, status)
select
  mi.id,
  extract(year from coalesce(mi.planted_at::date, mi.acquired_at, date_trunc('year', now())::date, current_date))::int,
  'Seizoen ' || extract(year from coalesce(mi.planted_at::date, mi.acquired_at, date_trunc('year', now())::date, current_date))::int,
  coalesce(mi.planted_at::date, mi.acquired_at, date_trunc('year', now())::date, current_date),
  'active'
from migrated_instances mi;
