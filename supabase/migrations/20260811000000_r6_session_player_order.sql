-- Rainbow Six Siege LAN Companion — vaste links/rechts-volgorde voor
-- spelerskaarten op het live dashboard.
--
-- `r6_session_players` had geen enkele kolom die de volgorde bewaarde
-- waarin spelers zijn toegevoegd — de frontend sorteerde impliciet op
-- wat Postgres toevallig teruggaf, wat noch de invoervolgorde in de
-- wizard garandeert, noch stabiel is. Een nieuwe `join_order`-kolom lost
-- dit structureel op: speler 1 (eerst ingevuld/toegevoegd) krijgt 0,
-- speler 2 krijgt 1, enzovoort — de frontend sorteert hier voortaan op
-- (zie lib/sessions.ts), zodat "speler 1 links, speler 2 rechts" altijd
-- klopt, ook na een pagina-refresh.
alter table public.r6_session_players
  add column if not exists join_order integer not null default 0;

-- Backfill voor al bestaande sessies: created_at is bij create_r6_session
-- voor alle spelers van dezelfde sessie identiek (één transactie, dus
-- dezelfde now()), dus dat alleen geeft geen betrouwbare volgorde — id
-- (uuid) is als tweede sorteersleutel op zijn minst stabiel/deterministisch,
-- ook al benadert dit niet gegarandeerd de oorspronkelijke invoervolgorde
-- voor sessies die al bestonden vóór deze migratie.
update public.r6_session_players sp
set join_order = ranked.rn - 1
from (
  select id, row_number() over (partition by session_id order by created_at, id) as rn
  from public.r6_session_players
) as ranked
where sp.id = ranked.id;

-- create_r6_session: zelfde signature, dus CREATE OR REPLACE vervangt de
-- bestaande functie in-place (geen nieuwe overload, geen DROP FUNCTION of
-- her-GRANT nodig — dat is alleen vereist bij een gewijzigde argumentenlijst).
--
-- CORRECTIE: `select distinct trim(n) from unnest(p_player_names) as n`
-- (de oorspronkelijke dedupe-aanpak) garandeert geen invoervolgorde — een
-- kale DISTINCT sorteert in de praktijk vaak alfabetisch, niet op
-- array-positie. De WITH ORDINALITY-aanpak hieronder dedupliceert
-- case-insensitief (zelfde regel als de v_distinct_count-check) én
-- bewaart de eerste-keer-voorkomen-volgorde uit de invoerarray, waarna elke
-- iteratie van de FOR-loop join_order ophoogt.
create or replace function public.create_r6_session(
  p_name text default 'Operation LANstorm',
  p_started_at timestamptz default now(),
  p_player_names text[] default '{}'
)
returns jsonb
language plpgsql
as $$
declare
  v_session_id     uuid;
  v_player_id      uuid;
  v_player_ids     uuid[] := '{}';
  v_name           text;
  v_distinct_count integer;
  v_join_order     integer := 0;
begin
  select count(distinct lower(trim(n)))
  into v_distinct_count
  from unnest(p_player_names) as n
  where trim(n) <> '';

  if v_distinct_count < 2 then
    raise exception 'Er zijn minimaal twee unieke spelers nodig om een LAN te starten';
  end if;

  insert into public.r6_sessions (name, started_at, status)
  values (
    coalesce(nullif(trim(p_name), ''), 'Operation LANstorm'),
    coalesce(p_started_at, now()),
    'live'
  )
  returning id into v_session_id;

  for v_name in
    select name from (
      select distinct on (lower(trim(n))) trim(n) as name, ord
      from unnest(p_player_names) with ordinality as u(n, ord)
      where trim(n) <> ''
      order by lower(trim(n)), ord
    ) as deduped
    order by ord
  loop
    insert into public.r6_players (name)
    values (v_name)
    on conflict ((lower(name))) do update set name = public.r6_players.name
    returning id into v_player_id;

    v_player_ids := array_append(v_player_ids, v_player_id);

    insert into public.r6_session_players (session_id, player_id, join_order)
    values (v_session_id, v_player_id, v_join_order)
    on conflict (session_id, player_id) do nothing;

    v_join_order := v_join_order + 1;
  end loop;

  return jsonb_build_object('session_id', v_session_id, 'player_ids', to_jsonb(v_player_ids));
end;
$$;

-- add_r6_session_player: zelfde signature, dus ook hier CREATE OR REPLACE
-- in-place. Een later toegevoegde speler komt achteraan (hoogste
-- join_order + 1) — bestaande spelers, en dus hun links/rechts-positie,
-- verschuiven niet.
create or replace function public.add_r6_session_player(
  p_session_id uuid,
  p_player_name text
)
returns uuid
language plpgsql
as $$
declare
  v_status        text;
  v_name          text := trim(p_player_name);
  v_player_id     uuid;
  v_next_join_order integer;
begin
  if v_name = '' then
    raise exception 'Spelernaam mag niet leeg zijn';
  end if;

  select status into v_status from public.r6_sessions where id = p_session_id;
  if v_status is null then
    raise exception 'Sessie niet gevonden';
  end if;
  if v_status <> 'live' then
    raise exception 'Deze LAN is afgerond — heropen de LAN om spelers toe te voegen';
  end if;

  select coalesce(max(join_order) + 1, 0) into v_next_join_order
  from public.r6_session_players
  where session_id = p_session_id;

  insert into public.r6_players (name)
  values (v_name)
  on conflict ((lower(name))) do update set name = public.r6_players.name
  returning id into v_player_id;

  insert into public.r6_session_players (session_id, player_id, join_order)
  values (p_session_id, v_player_id, v_next_join_order)
  on conflict (session_id, player_id) do nothing;

  return v_player_id;
end;
$$;
