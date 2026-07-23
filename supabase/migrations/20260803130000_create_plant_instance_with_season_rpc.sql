-- Atomically creates a plant_instance, its first growing_season, and
-- the opening height measurement (growth_log_entry) in a single
-- PostgreSQL transaction. If any insert fails, all three roll back
-- automatically — the caller never ends up with a partial record.
--
-- Security: SECURITY INVOKER (the default). All three target tables use
-- "authenticated can do everything" RLS policies, so inserts pass for
-- any authenticated caller without needing elevated privileges. Access
-- is restricted to `authenticated` only via the grants below.

create or replace function public.create_plant_instance_with_season(
  -- Required
  p_species_id         uuid,
  p_plant_name         text,
  p_season_started_at  date,
  -- Plant instance — optional fields
  p_custom_name        text        default null,
  p_location           text        default null,
  p_cultivation_type   text        default null,
  p_indoor_outdoor     text        default null,
  p_pot_size_liters    numeric     default null,
  p_pot_material       text        default null,
  p_pot_color          text        default null,
  p_soil_type          text        default null,
  p_soil_mix_notes     text        default null,
  p_planted_at         timestamptz default null,
  p_acquired_at        date        default null,
  p_source             text        default null,
  p_price              numeric     default null,
  -- Season — optional fields
  p_season_label       text        default null,
  -- Opening measurement; 0 when the user left the field empty
  p_start_height_cm    numeric     default 0
)
returns jsonb
language plpgsql
as $$
declare
  v_instance_id  uuid;
  v_season_id    uuid;
  v_entry_id     uuid;
begin
  -- ── Validate before touching any table ──────────────────────────────────
  if p_species_id is null then
    raise exception 'species_id is required';
  end if;
  if p_season_started_at is null then
    raise exception 'season_started_at is required';
  end if;
  if p_plant_name is null or trim(p_plant_name) = '' then
    raise exception 'plant_name is required';
  end if;
  if p_start_height_cm < 0 then
    raise exception 'start_height_cm must be >= 0, received %', p_start_height_cm;
  end if;

  -- ── 1. Plant instance ────────────────────────────────────────────────────
  insert into public.plant_instances (
    species_id,
    custom_name,
    location,
    cultivation_type,
    indoor_outdoor,
    pot_size_liters,
    pot_material,
    pot_color,
    soil_type,
    soil_mix_notes,
    planted_at,
    acquired_at,
    source,
    price,
    status
  ) values (
    p_species_id,
    p_custom_name,
    p_location,
    p_cultivation_type,
    p_indoor_outdoor,
    -- pot_size_liters column is integer; floor() so a decimal input like 2.5
    -- truncates cleanly instead of throwing a cast error.
    case when p_pot_size_liters is not null
         then floor(p_pot_size_liters)::integer
         else null
    end,
    p_pot_material,
    p_pot_color,
    p_soil_type,
    p_soil_mix_notes,
    p_planted_at,
    p_acquired_at,
    p_source,
    p_price,
    'active'
  )
  returning id into v_instance_id;

  -- ── 2. First growing season ──────────────────────────────────────────────
  insert into public.growing_seasons (
    plant_instance_id,
    year,
    label,
    started_at,
    status
  ) values (
    v_instance_id,
    extract(year from p_season_started_at)::integer,
    coalesce(
      nullif(trim(coalesce(p_season_label, '')), ''),
      'Seizoen ' || extract(year from p_season_started_at)::text
    ),
    p_season_started_at,
    'active'
  )
  returning id into v_season_id;

  -- ── 3. Opening height measurement ────────────────────────────────────────
  -- entry_date matches season started_at so the measurement is the true
  -- start of the timeline, regardless of when the form was submitted.
  insert into public.growth_log_entries (
    plant_id,
    plant_name,
    plant_instance_id,
    growing_season_id,
    entry_date,
    height_cm,
    watered,
    fertilized
  ) values (
    p_species_id,
    trim(p_plant_name),
    v_instance_id,
    v_season_id,
    p_season_started_at,
    p_start_height_cm,
    false,
    false
  )
  returning id into v_entry_id;

  return jsonb_build_object(
    'instance_id', v_instance_id,
    'season_id',   v_season_id,
    'entry_id',    v_entry_id
  );
end;
$$;

-- Restrict execution: revoke the default public grant, then give access
-- only to authenticated users (matches the RLS model of all other tables).
revoke execute on function public.create_plant_instance_with_season from public, anon;
grant  execute on function public.create_plant_instance_with_season to authenticated;
