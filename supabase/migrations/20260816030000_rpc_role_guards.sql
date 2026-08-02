-- Gebruikersrollen, deel 4: expliciete rolcontrole in gevoelige RPC's.
--
-- Alle r6_*-RPC's (create_r6_session, create_r6_match, update_r6_match,
-- add_r6_session_player, remove_r6_session_player) zijn SECURITY INVOKER —
-- ze draaien met de rechten van de AANROEPER, dus de rolgebonden RLS-
-- policies uit 20260816020000 worden door Postgres al automatisch op elke
-- insert/update binnen die functies afgedwongen. Geen enkele aanpassing aan
-- die functies is hiervoor nodig: een r6_player die bv. remove_r6_session_player
-- aanroept, botst gewoon op de owner-only DELETE-policy op
-- r6_session_players, met een duidelijke Postgres-foutmelding tot gevolg.
--
-- De twee niet-R6-RPC's hieronder zijn om dezelfde reden (SECURITY INVOKER,
-- onderliggende tabellen nu owner-only via 20260816010000) óók al structureel
-- geblokkeerd voor r6_player — maar zonder expliciete check zou de fout pas
-- diep in de functie optreden (een kale "new row violates row-level security
-- policy"-melding op bv. cultivation_plan_items, niet meteen duidelijk voor
-- welke actie). Deze migratie voegt een vroege, leesbare rolcontrole toe —
-- functioneel gedrag (welke rijen ontstaan) blijft voor owner exact
-- ongewijzigd, `create or replace function` met identieke signature vereist
-- geen nieuwe GRANT/REVOKE.
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
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Tuingids' using errcode = '42501';
  end if;

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

revoke execute on function public.create_plant_instance_with_season from public, anon;
grant  execute on function public.create_plant_instance_with_season to authenticated;

create or replace function public.link_instance_to_plan_item(
  p_instance_id uuid,
  p_plan_item_id uuid
)
returns void
language plpgsql
security invoker
as $$
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Tuingids' using errcode = '42501';
  end if;

  -- Tag the instance with its origin plan item
  update public.plant_instances
    set cultivation_plan_item_id = p_plan_item_id
    where id = p_instance_id;

  if not found then
    raise exception 'plant_instance % not found', p_instance_id;
  end if;

  -- Increment the counter (CHECK constraint prevents exceeding planned_quantity)
  update public.cultivation_plan_items
    set planted_quantity = planted_quantity + 1
    where id = p_plan_item_id;

  if not found then
    raise exception 'cultivation_plan_item % not found', p_plan_item_id;
  end if;
end;
$$;

revoke execute on function public.link_instance_to_plan_item from public, anon;
grant  execute on function public.link_instance_to_plan_item to authenticated;
