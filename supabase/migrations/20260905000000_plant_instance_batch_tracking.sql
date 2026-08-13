-- Hybride individueel/batch-tracking voor plant_instances.
--
-- Context: tot nu toe stelde één plant_instances-rij altijd precies één
-- fysieke plant voor. Voor gewassen die met veel tegelijk gezaaide
-- zaailingen werken (veldsla, rucola, radijs, kruiden, ...) is dat onhandig —
-- de gebruiker wil ÉÉN registratie bijhouden voor "een bak veldsla", niet
-- 18 aparte exemplaren. Dit voegt een `tracking_mode`/`quantity`-paar toe
-- die bewust zo dicht mogelijk aansluiten op de bestaande architectuur:
-- geen aparte `plant_batches`-tabel, geen tweede opslagroute voor
-- water/voeding/groeifoto's (die blijven werken zoals ze nu al werken, want
-- ze schrijven altijd per plant_instance_id, ongeacht hoeveel fysieke
-- planten die ene rij vertegenwoordigt).
--
-- Semantiek van quantity (zie opdracht):
--   tracking_mode = 'individual'  -> quantity is ALTIJD 1 (afgedwongen via
--                                     de check-constraint hieronder).
--   tracking_mode = 'batch', quantity = null   -> aantal nog onbekend/niet
--                                     geteld (NOOIT 0 voor "onbekend").
--   tracking_mode = 'batch', quantity = N (>=0) -> N is het huidige aantal
--                                     levende/groeiende planten in deze
--                                     registratie. 0 is toegestaan (bv. een
--                                     batch die net is uitgevallen) maar
--                                     wijzigt NOOIT automatisch de `status`
--                                     — dat blijft een aparte, bewuste actie
--                                     van de gebruiker (zie opdracht:
--                                     "Status mag onafhankelijk van quantity
--                                     blijven").
--
-- Toekomstige batch-split (zie opleverrapport): een batch splitsen wordt
-- hierdoor niet geblokkeerd — dat zou later gewoon een tweede
-- plant_instances-rij aanmaken (eigen tracking_mode/quantity) en optioneel
-- quantity op de bronbatch verlagen, met een growth_log_entries-rij die de
-- overgang documenteert. De history van de bronbatch blijft daarbij
-- volledig intact, want er wordt niets verwijderd of overschreven.

alter table public.plant_instances
  add column if not exists tracking_mode text not null default 'individual'
    check (tracking_mode in ('individual', 'batch')),
  add column if not exists quantity integer default 1
    check (quantity is null or quantity >= 0);

-- Individuele exemplaren stellen per definitie precies 1 plant voor; een
-- batch mag elk niet-negatief aantal hebben, of null ("nog niet geteld").
-- Bestaande rijen (allemaal individueel dankzij de defaults hierboven)
-- voldoen hier automatisch aan, dus geen aparte backfill-UPDATE nodig.
alter table public.plant_instances
  add constraint plant_instances_quantity_matches_tracking_mode
  check (
    (tracking_mode = 'individual' and quantity = 1)
    or
    (tracking_mode = 'batch' and (quantity is null or quantity >= 0))
  );

comment on column public.plant_instances.tracking_mode is
  'individual = deze rij stelt precies 1 fysieke plant voor. batch = deze rij stelt een groep samen bijgehouden planten voor (zie quantity).';
comment on column public.plant_instances.quantity is
  'Aantal levende/groeiende planten in deze registratie. Altijd 1 bij tracking_mode=individual. Bij tracking_mode=batch: null = nog niet geteld, NOOIT 0 voor "onbekend" — 0 betekent letterlijk nul planten over.';

-- Aantalshistorie: hergebruikt growth_log_entries (dezelfde tabel die al
-- height_cm/notes/watered/fertilized per plant_instance bijhoudt) i.p.v. een
-- los geschiedenismechanisme te bouwen. Een "aantal bijgewerkt"-log-entry
-- zet alleen deze kolom (en notes), de rest blijft null/false — zelfde
-- patroon als een pure water- of voedingsregistratie nu al gebruikt.
alter table public.growth_log_entries
  add column if not exists quantity integer
    check (quantity is null or quantity >= 0);

comment on column public.growth_log_entries.quantity is
  'Momentopname van plant_instances.quantity op het moment van deze log-entry (batchtracking-historie: "21 zaailingen opgekomen", "18 planten over na dunnen", ...). Null voor entries die geen aantalswijziging registreren.';

-- ── create_plant_instance_with_season: tracking_mode/quantity + zaailing-
--    statusregel toevoegen ──────────────────────────────────────────────────
-- Nieuwe parameters staan bewust achteraan met defaults, zodat dit een
-- backwards-compatible uitbreiding is (bestaande call-sites die de drie
-- nieuwe params niet meesturen blijven werken: default 'individual'/1/null,
-- exact de vorige betekenis van "een exemplaar aanmaken").
--
-- LET OP — `create or replace function` vervangt een functie alleen als de
-- signature (de lijst van parameter-TYPES) exact gelijk blijft. Een extra
-- parameter maakt de signature anders, dus `create or replace` zou hier geen
-- vervanging doen maar een TWEEDE, overloaded functie met dezelfde naam
-- aanmaken — de oorzaak van "function name ... is not unique" die
-- daadwerkelijk optrad bij de eerste versie van deze migratie. Vandaar de
-- expliciete `drop function` met de volledige oude 18-argumenten-signature
-- vlak hiervoor: die verwijdert de oude overload eerst, zodat er na deze
-- migratie gegarandeerd precies één `create_plant_instance_with_season`
-- overblijft. Nooit `drop function` zonder argumentlijst gebruiken — dat is
-- zelf ambigu zodra er meer dan één signature bestaat.
drop function if exists public.create_plant_instance_with_season(
  uuid,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  text,
  text,
  timestamptz,
  date,
  text,
  numeric,
  text,
  numeric
);

-- Zaailing-regel (zie opdracht): als de starthoogte leeg/0 is EN er nog geen
-- health_status is opgegeven, wordt de nieuwe registratie standaard
-- 'Zaailing'. Dit is de ENE centrale plek waar initiële status wordt
-- bepaald — er was voorheen geen andere logica die dit deed (de UI toonde
-- alleen een hint-tekst, zonder dat health_status daadwerkelijk gezet werd;
-- zie opleverrapport).
--
-- De `if not private.is_owner() then raise exception ...`-guard direct na
-- `begin` is 1:1 overgenomen uit 20260816030000_rpc_role_guards.sql (de
-- laatste migratie die deze functie wijzigde vóórdat dit bestand draait) —
-- die mag niet stilzwijgend verdwijnen doordat de functie hier opnieuw is
-- neergezet.
create or replace function public.create_plant_instance_with_season(
  p_species_id         uuid,
  p_plant_name         text,
  p_season_started_at  date,
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
  p_season_label       text        default null,
  p_start_height_cm    numeric     default 0,
  p_tracking_mode      text        default 'individual',
  p_quantity           integer     default 1,
  p_health_status      text        default null
)
returns jsonb
language plpgsql
as $$
declare
  v_instance_id  uuid;
  v_season_id    uuid;
  v_entry_id     uuid;
  v_health_status text;
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
  if p_tracking_mode not in ('individual', 'batch') then
    raise exception 'tracking_mode must be ''individual'' or ''batch'', received %', p_tracking_mode;
  end if;
  if p_tracking_mode = 'individual' and coalesce(p_quantity, 1) <> 1 then
    raise exception 'quantity must be 1 when tracking_mode is individual';
  end if;
  if p_quantity is not null and p_quantity < 0 then
    raise exception 'quantity must be >= 0, received %', p_quantity;
  end if;

  -- Alleen invullen als de aanroeper nog geen expliciete status meegaf —
  -- dat is de enige plek in de huidige architectuur waar een gebruiker
  -- bewust een andere initiële status kan kiezen (zie InstanceSettingsSection
  -- voor bestaande exemplaren; het aanmaakformulier zelf biedt vooralsnog
  -- geen statuskeuze, dus dit pad wordt in de praktijk altijd genomen zodra
  -- de hoogte leeg/0 is).
  v_health_status := coalesce(p_health_status, case when p_start_height_cm <= 0 then 'Zaailing' else null end);

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
    status,
    tracking_mode,
    quantity,
    health_status
  ) values (
    p_species_id,
    p_custom_name,
    p_location,
    p_cultivation_type,
    p_indoor_outdoor,
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
    'active',
    p_tracking_mode,
    case when p_tracking_mode = 'individual' then 1 else p_quantity end,
    v_health_status
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
  insert into public.growth_log_entries (
    plant_id,
    plant_name,
    plant_instance_id,
    growing_season_id,
    entry_date,
    height_cm,
    quantity,
    watered,
    fertilized
  ) values (
    p_species_id,
    trim(p_plant_name),
    v_instance_id,
    v_season_id,
    p_season_started_at,
    p_start_height_cm,
    case when p_tracking_mode = 'batch' then p_quantity else null end,
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

-- Volledige nieuwe (21-argumenten) signature meegeven i.p.v. de kale
-- functienaam: binnen deze transactie bestaat er dankzij de drop hierboven
-- weliswaar alweer maar één overload, maar expliciet blijven verwijzen naar
-- de exacte signature maakt dit bestand ook veilig als een latere migratie
-- ooit weer een parameter toevoegt vóór dit statement is aangepast.
revoke execute on function public.create_plant_instance_with_season(
  uuid, text, date, text, text, text, text, numeric, text, text, text, text,
  timestamptz, date, text, numeric, text, numeric, text, integer, text
) from public, anon;
grant  execute on function public.create_plant_instance_with_season(
  uuid, text, date, text, text, text, text, numeric, text, text, text, text,
  timestamptz, date, text, numeric, text, numeric, text, integer, text
) to authenticated;

-- ── update_plant_instance_quantity: enige schrijfpad voor "aantal bijwerken"
--    op een batch ────────────────────────────────────────────────────────
-- Atomisch net als create_plant_instance_with_season hierboven: de
-- plant_instances-update EN de bijbehorende growth_log_entries-historierij
-- ("21 zaailingen opgekomen", "18 planten over") slagen of falen samen, dus
-- er kan nooit een quantity-wijziging zonder geschiedenis-spoor ontstaan
-- (of andersom). Werkt alleen op tracking_mode='batch' instances — voor een
-- individueel exemplaar is quantity per definitie altijd 1.
--
-- Zelfde vroege, leesbare rolcontrole als create_plant_instance_with_season
-- (en de overige Tuingids-RPC's sinds 20260816030000_rpc_role_guards.sql) —
-- de onderliggende owner-only RLS op plant_instances/growth_log_entries zou
-- een r6_player hier toch al blokkeren, maar dan met een onduidelijke
-- "row-level security"-foutmelding diep in de functie i.p.v. een expliciete.
create or replace function public.update_plant_instance_quantity(
  p_instance_id       uuid,
  p_quantity          integer,
  p_entry_date        date default current_date,
  p_notes             text default null,
  p_growing_season_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_tracking_mode text;
  v_species_id    uuid;
  v_plant_name    text;
  v_entry_id      uuid;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Tuingids' using errcode = '42501';
  end if;

  if p_quantity is not null and p_quantity < 0 then
    raise exception 'quantity must be >= 0, received %', p_quantity;
  end if;

  select tracking_mode, species_id
    into v_tracking_mode, v_species_id
    from public.plant_instances
    where id = p_instance_id
    for update;

  if not found then
    raise exception 'plant_instance % not found', p_instance_id;
  end if;
  if v_tracking_mode <> 'batch' then
    raise exception 'quantity can only be updated for tracking_mode=batch instances';
  end if;

  update public.plant_instances
    set quantity = p_quantity
    where id = p_instance_id;

  select coalesce(custom_name, '') into v_plant_name from public.plant_instances where id = p_instance_id;
  if v_plant_name = '' then
    select name into v_plant_name from public.plants where id = v_species_id;
  end if;

  insert into public.growth_log_entries (
    plant_id,
    plant_name,
    plant_instance_id,
    growing_season_id,
    entry_date,
    quantity,
    notes,
    watered,
    fertilized
  ) values (
    v_species_id,
    v_plant_name,
    p_instance_id,
    p_growing_season_id,
    coalesce(p_entry_date, current_date),
    p_quantity,
    p_notes,
    false,
    false
  )
  returning id into v_entry_id;

  return jsonb_build_object('entry_id', v_entry_id);
end;
$$;

-- Ook hier de volledige signature i.p.v. de kale naam, uit dezelfde
-- voorzorg als bij create_plant_instance_with_season hierboven.
revoke execute on function public.update_plant_instance_quantity(
  uuid, integer, date, text, uuid
) from public, anon;
grant  execute on function public.update_plant_instance_quantity(
  uuid, integer, date, text, uuid
) to authenticated;

-- Handmatige controle na het draaien van deze migratie (niet onderdeel van
-- de migratie zelf) — moet exact 1 rij teruggeven:
--
-- select
--   p.oid::regprocedure as function_signature,
--   pg_get_function_arguments(p.oid) as arguments,
--   pg_get_function_result(p.oid) as return_type
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname = 'create_plant_instance_with_season'
-- order by p.oid;
