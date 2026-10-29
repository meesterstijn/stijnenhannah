-- Schietsportmodule: persoonlijk schietlogboek met offline-first sync.
--
-- Ontwerp (zie docs/schietsport.md):
--   * Elke rij hoort bij één gebruiker (user_id). Gegevens zijn strikt
--     privé: ook een andere owner ziet ze niet.
--   * Clients schrijven NOOIT direct in de tabellen. Alle wijzigingen gaan
--     via de shooting_push_*-functies (security definer), die eigenaarschap,
--     schietsportregels en optimistische versiecontrole afdwingen. Lezen voor
--     sync gaat via shooting_pull.
--   * Verwijderen = verwijdermarkering (deleted_at), nooit hard delete, zodat
--     andere apparaten de verwijdering ook binnenkrijgen.
--   * server_seq (één gedeelde sequence) is de sync-cursor; version is de
--     optimistische versie voor conflictdetectie; last_change_id maakt een
--     herhaalde push van dezelfde wijziging idempotent.
--   * Schietsportregels (§4): 0–10 per schot, afstanden 10/12/25,
--     wedstrijd = 30 schoten/300, vrije kaart = 5/50, oefenwedstrijd =
--     6 kaarten × 5/300.

begin;

-- ── Toegang ────────────────────────────────────────────────────────────

-- Voorlopig alleen owners (elk met een eigen, gescheiden logboek). Later
-- komt hier een rol als 'shooting_member' bij.
create or replace function private.can_use_shooting()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'owner', false);
$$;

revoke execute on function private.can_use_shooting() from public, anon;
grant execute on function private.can_use_shooting() to authenticated;

create or replace function private.shooting_assert_access()
returns uuid
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.can_use_shooting() then
    raise exception 'Geen toegang tot Schietsport' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

revoke execute on function private.shooting_assert_access() from public, anon;
grant execute on function private.shooting_assert_access() to authenticated;

-- ── Hulpfuncties ───────────────────────────────────────────────────────

create sequence if not exists public.shooting_change_seq;

-- Zet sync-metadata bij elke insert/update. version telt mee; server_seq
-- en changed_at komen altijd van de server.
create or replace function private.shooting_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
  else
    new.version := old.version + 1;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.server_seq := nextval('public.shooting_change_seq');
  new.changed_at := clock_timestamp();
  return new;
end;
$$;

create or replace function private.shooting_sum(p_values smallint[])
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(v), 0)::integer from unnest(p_values) as v;
$$;

create or replace function private.shooting_valid_shots(
  p_shots smallint[], p_shot_count smallint
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_shots) = p_shot_count
    and array_position(p_shots, null) is null
    and p_shots <@ '{0,1,2,3,4,5,6,7,8,9,10}'::smallint[];
$$;

-- ── Tabellen ───────────────────────────────────────────────────────────

create table if not exists public.shooting_disciplines (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.shooting_change_seq'),
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid,
  unique (id, user_id)
);

create table if not exists public.shooting_weapons (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  brand text check (char_length(brand) <= 80),
  model text check (char_length(model) <= 80),
  weapon_type text not null check (weapon_type in (
    'pistool', 'revolver', 'karabijn', 'geweer',
    'luchtpistool', 'luchtgeweer', 'anders'
  )),
  caliber text check (char_length(caliber) <= 40),
  ownership text not null default 'eigen'
    check (ownership in ('eigen', 'geleend')),
  photo_path text check (char_length(photo_path) <= 300),
  notes text check (char_length(notes) <= 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.shooting_change_seq'),
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid,
  unique (id, user_id)
);

create table if not exists public.shooting_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  weapon_id uuid, -- null = onbekend wapen
  discipline_id uuid not null,
  distance smallint not null check (distance in (10, 12, 25)),
  session_type text not null
    check (session_type in ('match', 'free_card', 'practice_match')),
  total_score smallint not null,
  max_score smallint not null,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.shooting_change_seq'),
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid,
  unique (id, user_id),
  constraint shooting_sessions_max_score check (
    max_score = case session_type when 'free_card' then 50 else 300 end
  ),
  constraint shooting_sessions_total_score check (
    total_score between 0 and max_score
  ),
  -- Samengestelde FK's: een schietbeurt kan alleen naar een wapen/discipline
  -- van dezelfde gebruiker verwijzen.
  foreign key (weapon_id, user_id)
    references public.shooting_weapons (id, user_id),
  foreign key (discipline_id, user_id)
    references public.shooting_disciplines (id, user_id)
);

create table if not exists public.shooting_session_cards (
  id uuid primary key,
  session_id uuid not null,
  user_id uuid not null,
  card_number smallint not null check (card_number between 1 and 30),
  shot_count smallint not null check (shot_count between 1 and 30),
  score smallint not null,
  shots smallint[], -- null = alleen kaartscore ingevoerd
  unique (session_id, card_number),
  foreign key (session_id, user_id)
    references public.shooting_sessions (id, user_id) on delete cascade,
  constraint shooting_cards_score check (score between 0 and shot_count * 10),
  constraint shooting_cards_shots check (
    shots is null
    or (
      private.shooting_valid_shots(shots, shot_count)
      and private.shooting_sum(shots) = score
    )
  )
);

create table if not exists public.shooting_competitions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  start_date date not null,
  end_date date not null,
  discipline_id uuid,
  notes text check (char_length(notes) <= 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.shooting_change_seq'),
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid,
  unique (id, user_id),
  check (end_date >= start_date),
  foreign key (discipline_id, user_id)
    references public.shooting_disciplines (id, user_id)
);

create table if not exists public.shooting_competition_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  competition_id uuid not null,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_seq bigint not null default nextval('public.shooting_change_seq'),
  changed_at timestamptz not null default clock_timestamp(),
  last_change_id uuid,
  foreign key (competition_id, user_id)
    references public.shooting_competitions (id, user_id),
  foreign key (session_id, user_id)
    references public.shooting_sessions (id, user_id)
);

-- Eén actieve koppeling per wedstrijd per competitie (verwijderde
-- koppelingen blijven als tombstone bestaan).
create unique index if not exists shooting_competition_entries_active
  on public.shooting_competition_entries (competition_id, session_id)
  where deleted_at is null;

create index if not exists shooting_disciplines_user_seq
  on public.shooting_disciplines (user_id, server_seq);
create index if not exists shooting_weapons_user_seq
  on public.shooting_weapons (user_id, server_seq);
create index if not exists shooting_sessions_user_seq
  on public.shooting_sessions (user_id, server_seq);
create index if not exists shooting_competitions_user_seq
  on public.shooting_competitions (user_id, server_seq);
create index if not exists shooting_competition_entries_user_seq
  on public.shooting_competition_entries (user_id, server_seq);
create index if not exists shooting_session_cards_session
  on public.shooting_session_cards (session_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'shooting_disciplines', 'shooting_weapons', 'shooting_sessions',
    'shooting_competitions', 'shooting_competition_entries'
  ] loop
    execute format('drop trigger if exists trg_%1$s_touch on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_touch before insert or update on public.%1$I
         for each row execute function private.shooting_touch()', t);
  end loop;
end;
$$;

-- ── RLS en rechten ─────────────────────────────────────────────────────
-- Alleen lezen van eigen rijen; schrijven uitsluitend via de functies.

do $$
declare
  t text;
begin
  foreach t in array array[
    'shooting_disciplines', 'shooting_weapons', 'shooting_sessions',
    'shooting_session_cards', 'shooting_competitions',
    'shooting_competition_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "Eigen rijen lezen" on public.%I', t);
    execute format(
      'create policy "Eigen rijen lezen" on public.%I for select to authenticated
         using (user_id = auth.uid() and private.can_use_shooting())', t);
  end loop;
end;
$$;

revoke all on sequence public.shooting_change_seq from public, anon, authenticated;

-- ── Sync: versiecontrole en rijweergave ───────────────────────────────

-- Bepaalt wat een push met deze rij moet doen:
--   'insert'    rij bestaat nog niet
--   'update'    rij bestaat en client bouwt voort op de huidige versie
--   'duplicate' exact deze wijziging is al eerder verwerkt (retry)
--   'conflict'  iemand anders (ander apparaat) heeft de rij intussen gewijzigd
create or replace function private.shooting_check_version(
  p_table regclass, p_id uuid, p_change_id uuid, p_base_version integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_version integer;
  v_change uuid;
begin
  execute format(
    'select user_id, version, last_change_id from %s where id = $1 for update',
    p_table
  ) into v_user, v_version, v_change using p_id;
  if v_user is null then
    return 'insert';
  end if;
  if v_user <> auth.uid() then
    raise exception 'Niet toegestaan' using errcode = '42501';
  end if;
  if v_change is not null and v_change = p_change_id then
    return 'duplicate';
  end if;
  if v_version <> p_base_version then
    return 'conflict';
  end if;
  return 'update';
end;
$$;

create or replace function private.shooting_session_json(p_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select to_jsonb(s) - 'last_change_id' || jsonb_build_object(
    'cards',
    coalesce(
      (select jsonb_agg(to_jsonb(c) - 'user_id' order by c.card_number)
         from public.shooting_session_cards c where c.session_id = s.id),
      '[]'::jsonb
    )
  )
  from public.shooting_sessions s
  where s.id = p_id;
$$;

create or replace function private.shooting_row_json(p_table regclass, p_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if p_table = 'public.shooting_sessions'::regclass then
    return private.shooting_session_json(p_id);
  end if;
  execute format('select to_jsonb(t) - ''last_change_id'' from %s t where id = $1', p_table)
    into v_row using p_id;
  return v_row;
end;
$$;

create or replace function private.shooting_result(
  p_state text, p_table regclass, p_id uuid
)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', case when p_state = 'conflict' then 'conflict' else 'ok' end,
    'row', private.shooting_row_json(p_table, p_id)
  );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'shooting_touch()',
    'shooting_check_version(regclass, uuid, uuid, integer)',
    'shooting_session_json(uuid)',
    'shooting_row_json(regclass, uuid)',
    'shooting_result(text, regclass, uuid)'
  ] loop
    execute format('revoke execute on function private.%s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- ── Sync: push ─────────────────────────────────────────────────────────
-- Elke functie: (p_change_id = id van de wijziging in de lokale wachtrij,
-- p_base_version = serverversie waarop de client voortbouwt, 0 = nieuw,
-- p_row = de rij in snake_case). Antwoord: {status: ok|conflict, row}.

create or replace function public.shooting_push_discipline(
  p_change_id uuid, p_base_version integer, p_row jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.shooting_assert_access();
  v_id uuid := (p_row->>'id')::uuid;
  v_table regclass := 'public.shooting_disciplines';
  v_state text := private.shooting_check_version(v_table, v_id, p_change_id, p_base_version);
begin
  if v_state = 'insert' then
    insert into public.shooting_disciplines (
      id, user_id, name, description, archived_at,
      created_at, updated_at, deleted_at, last_change_id
    ) values (
      v_id, v_uid, btrim(p_row->>'name'), p_row->>'description',
      (p_row->>'archived_at')::timestamptz,
      coalesce((p_row->>'created_at')::timestamptz, now()),
      coalesce((p_row->>'updated_at')::timestamptz, now()),
      (p_row->>'deleted_at')::timestamptz, p_change_id
    );
  elsif v_state = 'update' then
    update public.shooting_disciplines set
      name = btrim(p_row->>'name'),
      description = p_row->>'description',
      archived_at = (p_row->>'archived_at')::timestamptz,
      updated_at = coalesce((p_row->>'updated_at')::timestamptz, now()),
      deleted_at = (p_row->>'deleted_at')::timestamptz,
      last_change_id = p_change_id
    where id = v_id;
  end if;
  return private.shooting_result(v_state, v_table, v_id);
end;
$$;

create or replace function public.shooting_push_weapon(
  p_change_id uuid, p_base_version integer, p_row jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.shooting_assert_access();
  v_id uuid := (p_row->>'id')::uuid;
  v_table regclass := 'public.shooting_weapons';
  v_state text := private.shooting_check_version(v_table, v_id, p_change_id, p_base_version);
begin
  if v_state = 'insert' then
    insert into public.shooting_weapons (
      id, user_id, name, brand, model, weapon_type, caliber, ownership,
      photo_path, notes, archived_at,
      created_at, updated_at, deleted_at, last_change_id
    ) values (
      v_id, v_uid, btrim(p_row->>'name'), p_row->>'brand', p_row->>'model',
      p_row->>'weapon_type', p_row->>'caliber',
      coalesce(p_row->>'ownership', 'eigen'),
      p_row->>'photo_path', p_row->>'notes',
      (p_row->>'archived_at')::timestamptz,
      coalesce((p_row->>'created_at')::timestamptz, now()),
      coalesce((p_row->>'updated_at')::timestamptz, now()),
      (p_row->>'deleted_at')::timestamptz, p_change_id
    );
  elsif v_state = 'update' then
    update public.shooting_weapons set
      name = btrim(p_row->>'name'),
      brand = p_row->>'brand',
      model = p_row->>'model',
      weapon_type = p_row->>'weapon_type',
      caliber = p_row->>'caliber',
      ownership = coalesce(p_row->>'ownership', 'eigen'),
      photo_path = p_row->>'photo_path',
      notes = p_row->>'notes',
      archived_at = (p_row->>'archived_at')::timestamptz,
      updated_at = coalesce((p_row->>'updated_at')::timestamptz, now()),
      deleted_at = (p_row->>'deleted_at')::timestamptz,
      last_change_id = p_change_id
    where id = v_id;
  end if;
  return private.shooting_result(v_state, v_table, v_id);
end;
$$;

-- Schietbeurt + kaarten in één transactie. Valideert de indeling per type
-- en dat het totaal klopt; kaartregels (0–10 per schot, som = kaartscore)
-- dwingen de CHECKs op shooting_session_cards af.
create or replace function public.shooting_push_session(
  p_change_id uuid, p_base_version integer, p_row jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.shooting_assert_access();
  v_id uuid := (p_row->>'id')::uuid;
  v_table regclass := 'public.shooting_sessions';
  v_state text := private.shooting_check_version(v_table, v_id, p_change_id, p_base_version);
  v_type text := p_row->>'session_type';
  v_cards jsonb := coalesce(p_row->'cards', '[]'::jsonb);
  v_card_count integer := jsonb_array_length(coalesce(p_row->'cards', '[]'::jsonb));
  v_shot_total integer;
  v_score_total integer;
  v_numbers_ok boolean;
  v_all_five boolean;
  v_total integer := (p_row->>'total_score')::integer;
begin
  if v_state in ('duplicate', 'conflict') then
    return private.shooting_result(v_state, v_table, v_id);
  end if;

  select
    coalesce(sum((c->>'shot_count')::integer), 0),
    coalesce(sum((c->>'score')::integer), 0),
    coalesce(bool_and((c->>'card_number')::integer = ord), true),
    coalesce(bool_and((c->>'shot_count')::integer = 5), true)
  into v_shot_total, v_score_total, v_numbers_ok, v_all_five
  from jsonb_array_elements(v_cards) with ordinality as e(c, ord);

  if not v_numbers_ok then
    raise exception 'Kaartnummers moeten 1..n zijn' using errcode = '22023';
  end if;
  if v_type = 'free_card' and not (v_card_count = 1 and v_all_five) then
    raise exception 'Een vrije kaart is precies 1 kaart van 5 schoten' using errcode = '22023';
  end if;
  if v_type = 'practice_match' and not (v_card_count = 6 and v_all_five) then
    raise exception 'Een oefenwedstrijd is 6 kaarten van 5 schoten' using errcode = '22023';
  end if;
  if v_type = 'match' and v_card_count > 0 and v_shot_total <> 30 then
    raise exception 'De kaarten van een wedstrijd moeten samen 30 schoten zijn' using errcode = '22023';
  end if;
  if v_card_count > 0 and v_total <> v_score_total then
    raise exception 'Totaalscore komt niet overeen met de kaarten' using errcode = '22023';
  end if;

  if v_state = 'insert' then
    insert into public.shooting_sessions (
      id, user_id, session_date, weapon_id, discipline_id, distance,
      session_type, total_score, max_score, notes,
      created_at, updated_at, deleted_at, last_change_id
    ) values (
      v_id, v_uid, (p_row->>'session_date')::date,
      (p_row->>'weapon_id')::uuid, (p_row->>'discipline_id')::uuid,
      (p_row->>'distance')::smallint, v_type, v_total,
      case v_type when 'free_card' then 50 else 300 end,
      p_row->>'notes',
      coalesce((p_row->>'created_at')::timestamptz, now()),
      coalesce((p_row->>'updated_at')::timestamptz, now()),
      (p_row->>'deleted_at')::timestamptz, p_change_id
    );
  else
    update public.shooting_sessions set
      session_date = (p_row->>'session_date')::date,
      weapon_id = (p_row->>'weapon_id')::uuid,
      discipline_id = (p_row->>'discipline_id')::uuid,
      distance = (p_row->>'distance')::smallint,
      session_type = v_type,
      total_score = v_total,
      max_score = case v_type when 'free_card' then 50 else 300 end,
      notes = p_row->>'notes',
      updated_at = coalesce((p_row->>'updated_at')::timestamptz, now()),
      deleted_at = (p_row->>'deleted_at')::timestamptz,
      last_change_id = p_change_id
    where id = v_id;
    delete from public.shooting_session_cards where session_id = v_id;
  end if;

  insert into public.shooting_session_cards (
    id, session_id, user_id, card_number, shot_count, score, shots
  )
  select
    (c->>'id')::uuid, v_id, v_uid,
    (c->>'card_number')::smallint, (c->>'shot_count')::smallint,
    (c->>'score')::smallint,
    case when jsonb_typeof(c->'shots') = 'array'
      then array(select jsonb_array_elements_text(c->'shots')::smallint)
    end
  from jsonb_array_elements(v_cards) as c;

  -- Alleen officiële wedstrijden horen in een competitie. Wordt het type
  -- gewijzigd of de beurt verwijderd, dan vervallen de koppelingen (als
  -- tombstone, zodat andere apparaten dat ook zien).
  if v_type <> 'match' or (p_row->>'deleted_at') is not null then
    update public.shooting_competition_entries
       set deleted_at = now(), updated_at = now()
     where session_id = v_id and deleted_at is null;
  end if;

  return private.shooting_result(v_state, v_table, v_id);
end;
$$;

create or replace function public.shooting_push_competition(
  p_change_id uuid, p_base_version integer, p_row jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.shooting_assert_access();
  v_id uuid := (p_row->>'id')::uuid;
  v_table regclass := 'public.shooting_competitions';
  v_state text := private.shooting_check_version(v_table, v_id, p_change_id, p_base_version);
begin
  if v_state = 'insert' then
    insert into public.shooting_competitions (
      id, user_id, name, start_date, end_date, discipline_id, notes,
      archived_at, created_at, updated_at, deleted_at, last_change_id
    ) values (
      v_id, v_uid, btrim(p_row->>'name'),
      (p_row->>'start_date')::date, (p_row->>'end_date')::date,
      (p_row->>'discipline_id')::uuid, p_row->>'notes',
      (p_row->>'archived_at')::timestamptz,
      coalesce((p_row->>'created_at')::timestamptz, now()),
      coalesce((p_row->>'updated_at')::timestamptz, now()),
      (p_row->>'deleted_at')::timestamptz, p_change_id
    );
  elsif v_state = 'update' then
    update public.shooting_competitions set
      name = btrim(p_row->>'name'),
      start_date = (p_row->>'start_date')::date,
      end_date = (p_row->>'end_date')::date,
      discipline_id = (p_row->>'discipline_id')::uuid,
      notes = p_row->>'notes',
      archived_at = (p_row->>'archived_at')::timestamptz,
      updated_at = coalesce((p_row->>'updated_at')::timestamptz, now()),
      deleted_at = (p_row->>'deleted_at')::timestamptz,
      last_change_id = p_change_id
    where id = v_id;
  end if;
  return private.shooting_result(v_state, v_table, v_id);
end;
$$;

create or replace function public.shooting_push_competition_entry(
  p_change_id uuid, p_base_version integer, p_row jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.shooting_assert_access();
  v_id uuid := (p_row->>'id')::uuid;
  v_table regclass := 'public.shooting_competition_entries';
  v_state text := private.shooting_check_version(v_table, v_id, p_change_id, p_base_version);
  v_session_type text;
begin
  if v_state in ('duplicate', 'conflict') then
    return private.shooting_result(v_state, v_table, v_id);
  end if;

  if (p_row->>'deleted_at') is null then
    select session_type into v_session_type
      from public.shooting_sessions
     where id = (p_row->>'session_id')::uuid
       and user_id = v_uid
       and deleted_at is null;
    if v_session_type is distinct from 'match' then
      raise exception 'Alleen officiële wedstrijden tellen mee voor een competitie'
        using errcode = '22023';
    end if;
  end if;

  if v_state = 'insert' then
    insert into public.shooting_competition_entries (
      id, user_id, competition_id, session_id,
      created_at, updated_at, deleted_at, last_change_id
    ) values (
      v_id, v_uid, (p_row->>'competition_id')::uuid,
      (p_row->>'session_id')::uuid,
      coalesce((p_row->>'created_at')::timestamptz, now()),
      coalesce((p_row->>'updated_at')::timestamptz, now()),
      (p_row->>'deleted_at')::timestamptz, p_change_id
    );
  else
    update public.shooting_competition_entries set
      competition_id = (p_row->>'competition_id')::uuid,
      session_id = (p_row->>'session_id')::uuid,
      updated_at = coalesce((p_row->>'updated_at')::timestamptz, now()),
      deleted_at = (p_row->>'deleted_at')::timestamptz,
      last_change_id = p_change_id
    where id = v_id;
  end if;
  return private.shooting_result(v_state, v_table, v_id);
end;
$$;

-- ── Sync: pull ─────────────────────────────────────────────────────────
-- Alle eigen wijzigingen met server_seq > p_since, inclusief tombstones,
-- op volgorde. `next` is waar de volgende pagina begint; `cursor` schuift
-- alleen op tot vóór rijen van de laatste 30 seconden: een transactie die
-- een lagere server_seq kreeg maar later commit, wordt zo bij een volgende
-- pull alsnog opgehaald. Dubbel ophalen is onschadelijk; de client past
-- rijen idempotent toe.
create or replace function public.shooting_pull(
  p_since bigint default 0, p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.shooting_assert_access();
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 1000);
  v_result jsonb;
begin
  with changes as (
    select 'discipline' as entity, t.server_seq, t.changed_at,
           to_jsonb(t) - 'last_change_id' as row
      from public.shooting_disciplines t
     where t.user_id = v_uid and t.server_seq > p_since
    union all
    select 'weapon', t.server_seq, t.changed_at, to_jsonb(t) - 'last_change_id'
      from public.shooting_weapons t
     where t.user_id = v_uid and t.server_seq > p_since
    union all
    select 'session', t.server_seq, t.changed_at, private.shooting_session_json(t.id)
      from public.shooting_sessions t
     where t.user_id = v_uid and t.server_seq > p_since
    union all
    select 'competition', t.server_seq, t.changed_at, to_jsonb(t) - 'last_change_id'
      from public.shooting_competitions t
     where t.user_id = v_uid and t.server_seq > p_since
    union all
    select 'competition_entry', t.server_seq, t.changed_at, to_jsonb(t) - 'last_change_id'
      from public.shooting_competition_entries t
     where t.user_id = v_uid and t.server_seq > p_since
  ),
  page as (
    select * from changes order by server_seq limit v_limit
  ),
  recent as (
    select min(server_seq) as first_recent
      from page where changed_at >= clock_timestamp() - interval '30 seconds'
  )
  select jsonb_build_object(
    'rows', coalesce(
      (select jsonb_agg(jsonb_build_object('entity', entity, 'row', row) order by server_seq) from page),
      '[]'::jsonb
    ),
    'has_more', (select count(*) from page) = v_limit,
    -- Doorbladeren binnen dezelfde pull: vanaf de laatste rij van deze pagina.
    'next', coalesce((select max(server_seq) from page), p_since),
    -- Veilig om op te slaan voor de volgende pull (zie hierboven).
    'cursor', coalesce(
      (select max(p.server_seq) from page p, recent r
        where r.first_recent is null or p.server_seq < r.first_recent),
      p_since
    )
  ) into v_result;
  return v_result;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'shooting_push_discipline(uuid, integer, jsonb)',
    'shooting_push_weapon(uuid, integer, jsonb)',
    'shooting_push_session(uuid, integer, jsonb)',
    'shooting_push_competition(uuid, integer, jsonb)',
    'shooting_push_competition_entry(uuid, integer, jsonb)',
    'shooting_pull(bigint, integer)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- ── Wapenfoto's: privé bucket, pad <user_id>/<weapon_id>.webp ──────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shooting-weapon-photos',
  'shooting-weapon-photos',
  false,
  2097152, -- 2 MB; de app verkleint vooraf naar webp
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

drop policy if exists "shooting-weapon-photos: own read" on storage.objects;
drop policy if exists "shooting-weapon-photos: own insert" on storage.objects;
drop policy if exists "shooting-weapon-photos: own update" on storage.objects;
drop policy if exists "shooting-weapon-photos: own delete" on storage.objects;

create policy "shooting-weapon-photos: own read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'shooting-weapon-photos'
    and private.storage_first_segment_uuid(name) = auth.uid()
    and private.can_use_shooting()
  );

create policy "shooting-weapon-photos: own insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shooting-weapon-photos'
    and private.storage_first_segment_uuid(name) = auth.uid()
    and private.can_use_shooting()
  );

create policy "shooting-weapon-photos: own update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shooting-weapon-photos'
    and private.storage_first_segment_uuid(name) = auth.uid()
    and private.can_use_shooting()
  );

create policy "shooting-weapon-photos: own delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shooting-weapon-photos'
    and private.storage_first_segment_uuid(name) = auth.uid()
    and private.can_use_shooting()
  );

commit;
