-- QR-labelbeheer: bewerken (note) en verwijderen (soft-delete/archiveren).
--
-- Waarom soft-delete i.p.v. een echte DELETE: plant_instance_qr_assignments.
-- qr_label_id verwijst met `on delete cascade` naar qr_labels (zie
-- 20260906000000_qr_labels_and_photo_lineage.sql) — een harde DELETE van een
-- label zou dus ALTIJD ook zijn volledige koppelingshistorie vernietigen,
-- ook oude/al-vrijgegeven assignments die je later nog wilt kunnen
-- terugzien ("QR A hoorde 1-20 aug bij Veldsla, daarna bij Radijs"). Een
-- `deleted_at`-kolom lost dit op zonder de bestaande FK/cascade-structuur
-- aan te hoeven passen: het label-record (en daarmee alle assignment-rijen
-- die ernaar verwijzen) blijft gewoon bestaan, verdwijnt alleen uit de
-- normale actieve beheerweergave en kan nooit meer opnieuw gekoppeld worden.
-- De unique constraint op `code` blijft ongewijzigd van kracht op de nu
-- permanente rij, dus een verwijderde code kan ook nooit per ongeluk
-- opnieuw uitgegeven worden.

alter table public.qr_labels
  add column if not exists deleted_at timestamptz;

comment on column public.qr_labels.deleted_at is
  'Soft-delete/archief-tijdstip. Null = normaal actief label (kan Vrij of In gebruik zijn). Niet-null = "verwijderd" in de UI: verdwijnt uit de standaard beheerlijst, kan nooit meer gekoppeld worden (zie assign_qr_label), maar de rij zelf en zijn assignmenthistorie blijven intact — nooit een DELETE, en de code blijft voor altijd gereserveerd.';

create index if not exists qr_labels_deleted_at_idx
  on public.qr_labels (deleted_at)
  where deleted_at is not null;


-- ── RPC: QR-label archiveren/"verwijderen" ────────────────────────────────
-- Dwingt server-side af wat de UI ook al controleert: een label dat nog een
-- actieve koppeling heeft mag niet gearchiveerd worden — eerst bewust
-- ontkoppelen (release_qr_label), dan pas archiveren. Nooit automatisch
-- ontkoppelen-en-verwijderen in één actie.

create or replace function public.archive_qr_label(
  p_label_id uuid
)
returns void
language plpgsql
as $$
declare
  v_deleted_at timestamptz;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Tuingids'
      using errcode = '42501';
  end if;

  select deleted_at
  into v_deleted_at
  from public.qr_labels
  where id = p_label_id
  for update;

  if not found then
    raise exception 'qr_label % not found', p_label_id;
  end if;

  -- Al gearchiveerd: idempotent, geen fout — een dubbele klik of verdwaalde
  -- retry mag niet stuklopen.
  if v_deleted_at is not null then
    return;
  end if;

  if exists (
    select 1
    from public.plant_instance_qr_assignments
    where qr_label_id = p_label_id
      and released_at is null
  ) then
    raise exception 'Dit QR-label is nog gekoppeld aan een actieve registratie — ontkoppel het eerst.'
      using errcode = '23503';
  end if;

  update public.qr_labels
  set deleted_at = now()
  where id = p_label_id;
end;
$$;

revoke execute
  on function public.archive_qr_label(uuid)
  from public, anon;

grant execute
  on function public.archive_qr_label(uuid)
  to authenticated;


-- ── assign_qr_label: verwijderde labels nooit opnieuw koppelbaar ─────────
-- Zelfde signature als de bestaande functie (p_code text, p_instance_id
-- uuid) — `create or replace` vervangt 'm dus gewoon in place, geen nieuwe
-- overload, geen DROP nodig. Enige inhoudelijke wijziging: een label met
-- deleted_at IS NOT NULL wordt nu expliciet geweigerd, ook al staat de code
-- verder nog gewoon (uniek) in de tabel — dit voorkomt dat een fysieke
-- sticker die je hebt weggegooid/gearchiveerd via een verdwaalde scan (bv.
-- "Nieuw exemplaar → QR scannen") alsnog een nieuwe koppeling kan krijgen.

create or replace function public.assign_qr_label(
  p_code text,
  p_instance_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_label_id uuid;
  v_label_deleted_at timestamptz;
  v_instance_status text;
  v_assignment_id uuid;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Tuingids'
      using errcode = '42501';
  end if;

  select id, deleted_at
  into v_label_id, v_label_deleted_at
  from public.qr_labels
  where code = p_code;

  if not found then
    raise exception 'Onbekende QR-code'
      using errcode = 'P0002';
  end if;

  if v_label_deleted_at is not null then
    raise exception 'Dit QR-label is verwijderd en niet meer in gebruik'
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

-- Signature is ongewijzigd, maar defensief opnieuw expliciet toegekend
-- (dezelfde gewoonte als bij eerdere migraties: nooit aannemen dat grants
-- vanzelf goed blijven staan na het aanraken van een functie).
revoke execute
  on function public.assign_qr_label(text, uuid)
  from public, anon;

grant execute
  on function public.assign_qr_label(text, uuid)
  to authenticated;


-- Handmatige controle na het draaien van deze migratie (niet onderdeel van
-- de migratie zelf) — moet exact 1 rij per functienaam teruggeven:
--
-- select
--   p.oid::regprocedure as function_signature,
--   pg_get_function_arguments(p.oid) as arguments,
--   pg_get_function_result(p.oid) as return_type
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('assign_qr_label', 'archive_qr_label', 'release_qr_label')
-- order by p.proname, p.oid;
