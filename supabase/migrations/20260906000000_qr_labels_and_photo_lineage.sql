-- Twee nauw samenhangende Tuingids-uitbreidingen:
--
--  A) Fotohistorie-continuïteit over "Zaailing uitplanten" heen. Zolang een
--     batch/exemplaar dezelfde plant_instance_id behoudt, blijft de bestaande
--     fotohistorie (growth_log_entries/growth_log_photos, allebei al puur
--     plant_instance_id-gestuurd, zie useGrowthLog/useGrowthPhotos) vanzelf
--     zichtbaar — daar is geen schemawijziging voor nodig. Het enige echte
--     gat zit in "Zaailing uitplanten" (plant_seedling_to_instances): dat
--     maakt NIEUWE instance-IDs, dus de nieuwe rijen hebben geen eigen band
--     met de zaailinggeschiedenis. `derived_from_instance_id` legt die band
--     relationeel vast — geen fotokopie, gewoon een verwijzing die de UI kan
--     gebruiken om de voorgeschiedenis erbij te tonen.
--
--  B) Herbruikbare QR-labels: een label (fysieke sticker) is een losstaande,
--     permanente rij; de koppeling naar een instance is een aparte,
--     historisch bijgehouden rij (plant_instance_qr_assignments) zodat een
--     sticker na "vrijgeven" gewoon opnieuw te gebruiken is zonder ooit een
--     nieuw label te hoeven aanmaken/printen.


-- ── A) Fotohistorie-herkomst ─────────────────────────────────────────────

alter table public.plant_instances
  add column if not exists derived_from_instance_id uuid
    references public.plant_instances(id)
    on delete set null;

create index if not exists plant_instances_derived_from_instance_id_idx
  on public.plant_instances (derived_from_instance_id);

comment on column public.plant_instances.derived_from_instance_id is
  'Verwijst naar de zaailing-instance waaruit dit exemplaar is ontstaan via "Zaailing uitplanten" (plant_seedling_to_instances). Puur relationeel — geen foto''s worden gekopieerd; de UI toont de historie van de bron-instance erbij (zie GrowthPhotoTimeline-gebruik in PlantInstanceDetailDialog). Null voor exemplaren die niet uit een split ontstonden.';


-- ── B) QR-labels ──────────────────────────────────────────────────────────

-- Het label zelf is permanent (nooit verwijderd door de app — een fysieke
-- sticker blijft bestaan ongeacht welke plant er nu aan hangt). `code` is
-- een ondoorzichtige, willekeurige token — geen plantnaam/species/volgnummer
-- erin, en niet oplopend (zie genQrCode() in de frontend: crypto-random,
-- geen sequentie). De QR-afbeelding zelf wordt client-side gegenereerd
-- (qr-code-styling, al in gebruik voor de wifi-QR) — er wordt geen
-- afbeelding in Storage bewaard, alleen deze tekst-code.

create table if not exists public.qr_labels (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists qr_labels_code_uidx
  on public.qr_labels (code);

comment on table public.qr_labels is
  'Herbruikbare fysieke QR-stickers. Een label zelf wordt nooit verwijderd — alleen de koppeling naar een instance (zie plant_instance_qr_assignments) wisselt, zodat dezelfde sticker later aan een andere batch/plant kan hangen.';

comment on column public.qr_labels.code is
  'Ondoorzichtige, willekeurige identifier — bevat bewust geen plantnaam/species-ID/volgnummer. De QR-afbeelding encodeert alleen deze code (of een deeplink-URL die deze code bevat), nooit plantdata zelf.';


-- Koppeling instance <-> label, historisch bijgehouden (i.p.v. één
-- assigned_instance_id-kolom op qr_labels) zodat "QR A hoorde 1-20 aug bij
-- Veldsla, daarna bij Radijs" zichtbaar blijft. released_at is null zolang
-- de koppeling actief is; "vrijgeven" is dus een UPDATE, nooit een DELETE.

create table if not exists public.plant_instance_qr_assignments (
  id uuid primary key default gen_random_uuid(),
  qr_label_id uuid not null
    references public.qr_labels(id)
    on delete cascade,
  plant_instance_id uuid not null
    references public.plant_instances(id)
    on delete cascade,
  assigned_at timestamptz not null default now(),
  released_at timestamptz
);

create index if not exists plant_instance_qr_assignments_label_id_idx
  on public.plant_instance_qr_assignments (qr_label_id);

create index if not exists plant_instance_qr_assignments_instance_id_idx
  on public.plant_instance_qr_assignments (plant_instance_id);


-- Database-level garantie tegen dubbele actieve koppelingen.

create unique index if not exists plant_instance_qr_assignments_one_active_per_label_uidx
  on public.plant_instance_qr_assignments (qr_label_id)
  where released_at is null;

create unique index if not exists plant_instance_qr_assignments_one_active_per_instance_uidx
  on public.plant_instance_qr_assignments (plant_instance_id)
  where released_at is null;

comment on table public.plant_instance_qr_assignments is
  'Historie van welk QR-label wanneer bij welke plant_instance hoorde. released_at is null = actieve koppeling. Database-constraints (zie de twee partiële unique-indexen hierboven) garanderen maximaal één actieve koppeling per label én per instance, ook bij race conditions.';


-- ── RLS ───────────────────────────────────────────────────────────────────

alter table public.qr_labels enable row level security;
alter table public.plant_instance_qr_assignments enable row level security;

drop policy if exists "qr_labels: owner only"
  on public.qr_labels;

create policy "qr_labels: owner only"
  on public.qr_labels
  for all
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "plant_instance_qr_assignments: owner only"
  on public.plant_instance_qr_assignments;

create policy "plant_instance_qr_assignments: owner only"
  on public.plant_instance_qr_assignments
  for all
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.qr_labels from anon;
revoke all on public.plant_instance_qr_assignments from anon;


-- ── Centrale vrijgeef-helper ──────────────────────────────────────────────

create or replace function private.release_active_qr_assignment(
  p_instance_id uuid
)
returns void
language plpgsql
as $$
begin
  update public.plant_instance_qr_assignments
  set released_at = now()
  where plant_instance_id = p_instance_id
    and released_at is null;
end;
$$;


-- ── Trigger: status weg van active → QR vrijgeven ─────────────────────────

create or replace function public.plant_instances_release_qr_on_inactive()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'active' and new.status <> 'active' then
    perform private.release_active_qr_assignment(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_release_qr_on_instance_inactive
  on public.plant_instances;

create trigger trg_release_qr_on_instance_inactive
  after update on public.plant_instances
  for each row
  when (old.status is distinct from new.status)
  execute function public.plant_instances_release_qr_on_inactive();


-- ── RPC: QR-label koppelen ────────────────────────────────────────────────

create or replace function public.assign_qr_label(
  p_code text,
  p_instance_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_label_id uuid;
  v_instance_status text;
  v_assignment_id uuid;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Tuingids'
      using errcode = '42501';
  end if;

  select id
  into v_label_id
  from public.qr_labels
  where code = p_code;

  if not found then
    raise exception 'Onbekende QR-code'
      using errcode = 'P0002';
  end if;

  select status
  into v_instance_status
  from public.plant_instances
  where id = p_instance_id
  for update;

  if not found then
    raise exception 'plant_instance % not found', p_instance_id;
  end if;

  if v_instance_status <> 'active' then
    raise exception 'Een QR-code kan alleen aan een actieve registratie worden gekoppeld';
  end if;

  if exists (
    select 1
    from public.plant_instance_qr_assignments
    where qr_label_id = v_label_id
      and released_at is null
  ) then
    raise exception 'Deze QR-code is al gekoppeld aan een andere registratie'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.plant_instance_qr_assignments
    where plant_instance_id = p_instance_id
      and released_at is null
  ) then
    raise exception 'Deze registratie heeft al een actieve QR-code'
      using errcode = '23505';
  end if;

  begin
    insert into public.plant_instance_qr_assignments (
      qr_label_id,
      plant_instance_id
    )
    values (
      v_label_id,
      p_instance_id
    )
    returning id into v_assignment_id;

  exception
    when unique_violation then
      raise exception 'Deze QR-code of registratie is zojuist al gekoppeld — ververs en probeer opnieuw'
        using errcode = '23505';
  end;

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'qr_label_id', v_label_id
  );
end;
$$;


-- ── RPC: QR-label ontkoppelen ─────────────────────────────────────────────

create or replace function public.release_qr_label(
  p_instance_id uuid
)
returns void
language plpgsql
as $$
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Tuingids'
      using errcode = '42501';
  end if;

  perform private.release_active_qr_assignment(p_instance_id);
end;
$$;


-- ── RPC-permissions ───────────────────────────────────────────────────────

revoke execute
  on function public.assign_qr_label(text, uuid)
  from public, anon;

grant execute
  on function public.assign_qr_label(text, uuid)
  to authenticated;

revoke execute
  on function public.release_qr_label(uuid)
  from public, anon;

grant execute
  on function public.release_qr_label(uuid)
  to authenticated;


-- ── plant_seedling_to_instances ───────────────────────────────────────────

-- Expliciet de bekende vijf-argumentensignature verwijderen om te voorkomen
-- dat deze naast een opnieuw aangemaakte versie blijft bestaan.

drop function if exists public.plant_seedling_to_instances(
  uuid,
  text[],
  text,
  date,
  numeric
);


create or replace function public.plant_seedling_to_instances(
  p_seedling_id uuid,
  p_custom_names text[],
  p_plant_name text,
  p_season_started_at date,
  p_start_height_cm numeric default 0
)
returns jsonb
language plpgsql
as $$
declare
  v_seedling public.plant_instances%rowtype;
  v_health_status text;
  v_new_instance_id uuid;
  v_season_id uuid;
  v_name text;
  v_new_ids uuid[] := '{}';
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Tuingids'
      using errcode = '42501';
  end if;

  if p_seedling_id is null then
    raise exception 'seedling_id is required';
  end if;

  if p_custom_names is null
     or coalesce(array_length(p_custom_names, 1), 0) < 1 then
    raise exception 'custom_names must contain at least one name';
  end if;

  if p_plant_name is null
     or trim(p_plant_name) = '' then
    raise exception 'plant_name is required';
  end if;

  if p_season_started_at is null then
    raise exception 'season_started_at is required';
  end if;

  if p_start_height_cm is null
     or p_start_height_cm < 0 then
    raise exception 'start_height_cm must be >= 0, received %',
      p_start_height_cm;
  end if;

  select *
  into v_seedling
  from public.plant_instances
  where id = p_seedling_id
  for update;

  if not found then
    raise exception 'plant_instance % not found', p_seedling_id;
  end if;

  if v_seedling.status <> 'active' then
    raise exception 'Alleen een actieve registratie kan worden uitgeplant';
  end if;

  -- Zelfde initiële zaailingregel:
  -- hoogte 0 → Zaailing.
  v_health_status :=
    case
      when p_start_height_cm <= 0 then 'Zaailing'
      else null
    end;

  foreach v_name in array p_custom_names loop

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
      source,
      price,
      status,
      tracking_mode,
      quantity,
      health_status,
      derived_from_instance_id
    )
    values (
      v_seedling.species_id,
      v_name,
      v_seedling.location,
      v_seedling.cultivation_type,
      v_seedling.indoor_outdoor,
      v_seedling.pot_size_liters,
      v_seedling.pot_material,
      v_seedling.pot_color,
      v_seedling.soil_type,
      v_seedling.soil_mix_notes,
      v_seedling.source,
      v_seedling.price,
      'active',
      'individual',
      1,
      v_health_status,
      p_seedling_id
    )
    returning id into v_new_instance_id;


    insert into public.growing_seasons (
      plant_instance_id,
      year,
      label,
      started_at,
      status
    )
    values (
      v_new_instance_id,
      extract(year from p_season_started_at)::integer,
      'Seizoen ' || extract(year from p_season_started_at)::text,
      p_season_started_at,
      'active'
    )
    returning id into v_season_id;


    insert into public.growth_log_entries (
      plant_id,
      plant_name,
      plant_instance_id,
      growing_season_id,
      entry_date,
      height_cm,
      watered,
      fertilized
    )
    values (
      v_seedling.species_id,
      trim(p_plant_name),
      v_new_instance_id,
      v_season_id,
      p_season_started_at,
      p_start_height_cm,
      false,
      false
    );

    v_new_ids :=
      array_append(v_new_ids, v_new_instance_id);

  end loop;


  -- Bronzaailing blijft bestaan voor de historische foto's/logdata,
  -- maar wordt niet-actief. De QR-trigger geeft een eventueel gekoppeld
  -- label hierdoor automatisch vrij.
  update public.plant_instances
  set status = 'removed'
  where id = p_seedling_id;


  return jsonb_build_object(
    'new_instance_ids',
    to_jsonb(v_new_ids)
  );
end;
$$;


-- ── plant_seedling_to_instances permissions ───────────────────────────────

revoke execute
  on function public.plant_seedling_to_instances(
    uuid,
    text[],
    text,
    date,
    numeric
  )
  from public, anon;

grant execute
  on function public.plant_seedling_to_instances(
    uuid,
    text[],
    text,
    date,
    numeric
  )
  to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- HANDMATIGE CONTROLE NA MIGRATIE
-- ──────────────────────────────────────────────────────────────────────────
--
-- Voer onderstaande SELECT na de migratie apart uit.
-- Er moet precies één rij per functienaam bestaan.
--
-- select
--   p.oid::regprocedure as function_signature,
--   pg_get_function_arguments(p.oid) as arguments,
--   pg_get_function_result(p.oid) as return_type
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'create_plant_instance_with_season',
--     'plant_seedling_to_instances',
--     'assign_qr_label',
--     'release_qr_label'
--   )
-- order by p.proname, p.oid;