-- Game Night V2.4 — party-model. Additief op de negentien bestaande Game
-- Night-migraties. Breidt de BESTAANDE game_night_session_players uit
-- (attendance voor de hele avond, sinds 20260912010000) i.p.v. een aparte
-- game_night_party_members-tabel te maken — een rij betekent nog steeds
-- "deze speler hoort bij deze Game Night" (attendance), de nieuwe kolommen
-- voegen alleen toe OF diezelfde speler NU actief aan tafel zit. Nooit de
-- rij verwijderen om iemand tijdelijk van tafel te halen — dat zou
-- attendance-statistiek laten dalen (sectie 4/33 van de opdracht).
--
-- CORRECTIE (vóór eerste succesvolle uitvoering, na een mislukte poging):
-- een niet-geëscapete apostrof in de comment-tekst bij `source` (regel 25
-- van de vorige versie: "sleepte 'm erin") sloot de string-literal
-- voortijdig af, wat een syntaxfout gaf. Herschreven zonder de
-- samentrekking. Daarnaast is deze hele migratie nu bestand tegen precies
-- het scenario dat daardoor ontstond: een gedeeltelijk geslaagde vorige
-- poging (de ALTER TABLE/kolommen vóór de fout kunnen al zijn toegepast).
-- Zie de toelichting bij de constraint en de index hieronder.

alter table public.game_night_session_players
  add column if not exists active_at_table boolean not null default true,
  add column if not exists left_at timestamptz,
  add column if not exists source text not null default 'manual',
  add column if not exists seat_index integer;

-- Postgres kent geen "ADD CONSTRAINT IF NOT EXISTS" — dit blokje is het
-- veilige equivalent, zodat opnieuw uitvoeren na een eerdere gedeeltelijke
-- poging niet op "constraint already exists" struikelt.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_night_session_players_source_check'
      and conrelid = 'public.game_night_session_players'::regclass
  ) then
    alter table public.game_night_session_players
      add constraint game_night_session_players_source_check
      check (source in ('manual', 'qr_join'));
  end if;
end
$$;

comment on column public.game_night_session_players.active_at_table is
  'true = zit nu actief aan tafel. false = hoort bij de avond (attendance) maar zit er momenteel niet actief bij (van tafel gesleept, of nog niet gejoined). Attendance-statistiek blijft gebaseerd op het BESTAAN van de rij, nooit op deze kolom.';
comment on column public.game_night_session_players.seat_index is
  'Ordinale volgorde binnen de actieve tafel (geen pixels/coördinaten) — alleen betekenisvol zolang active_at_table=true. Frontend legt de visuele positie zelf neer op basis van aantal actieve spelers + deze volgorde.';
comment on column public.game_night_session_players.source is
  'Hoe deze speler (voor het laatst) aan tafel kwam: ''manual'' (owner sleepte de speler erin) of ''qr_join'' (telefoon-join via een geldig token).';

-- ── Structurele seat_index-integriteit (correctie, review sectie 7) ──────
-- Row locking (`for update` op game_night_sessions in de RPC's hieronder)
-- voorkomt normale races bij gelijktijdige joins/drags. Deze partial unique
-- index is de aanvullende, harde databasegarantie: zelfs als er ooit een
-- ander schrijfpad om deze tabel heen zou ontstaan (bv. een toekomstige
-- RPC die de rijlock vergeet), kunnen twee actieve tafelspelers nooit
-- dezelfde seat_index krijgen. Alleen `where active_at_table and seat_index
-- is not null` — een speler die van tafel gesleept is (seat_index=null)
-- mag daarna gewoon weer null blijven zonder deze index te raken.
-- IF NOT EXISTS: Postgres ondersteunt dit rechtstreeks voor indexes (in
-- tegenstelling tot constraints hierboven), dus opnieuw uitvoeren na een
-- eerdere gedeeltelijke poging is hier net zo veilig.
create unique index if not exists game_night_session_players_active_seat_idx
  on public.game_night_session_players (session_id, seat_index)
  where active_at_table = true and seat_index is not null;

-- ── Owner: handmatig naar/van tafel slepen (sectie 6) ─────────────────────
-- Alle drie de party-mutatie-RPC's weigeren zolang er een NIET-afgeronde
-- game_night_game_sessions-rij voor deze avond bestaat (sectie 25: "freeze
-- party drag tijdens actief spel") — een server-side garantie, niet alleen
-- een UI-restrictie. Bewust GEEN SECURITY DEFINER: owner heeft via de
-- bestaande owner-ALL RLS-policy op game_night_session_players al volledige
-- toegang, dus een plain RPC (met de expliciete is_owner()-check hieronder
-- voor een nette foutmelding) volstaat — zelfde patroon als vrijwel elke
-- andere Game Night-RPC. CREATE OR REPLACE FUNCTION is van zichzelf al
-- veilig opnieuw uit te voeren.
create or replace function public.game_night_add_to_party(
  p_session_id uuid,
  p_player_id uuid
)
returns public.game_night_session_players
language plpgsql
as $$
declare
  v_session public.game_night_sessions;
  v_next_seat integer;
  v_row public.game_night_session_players;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag spelers naar tafel slepen' using errcode = '42501';
  end if;

  select * into v_session
  from public.game_night_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Game Night % niet gevonden', p_session_id;
  end if;
  if v_session.status = 'completed' then
    raise exception 'Deze Game Night is al afgesloten' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.game_night_game_sessions
    where game_night_session_id = p_session_id and status <> 'completed'
  ) then
    raise exception 'Kan de tafel niet aanpassen terwijl er een spel actief is'
      using errcode = '22023';
  end if;

  select coalesce(max(seat_index), -1) + 1 into v_next_seat
  from public.game_night_session_players
  where session_id = p_session_id and active_at_table = true;

  insert into public.game_night_session_players (
    session_id, player_id, active_at_table, source, seat_index
  )
  values (p_session_id, p_player_id, true, 'manual', v_next_seat)
  on conflict (session_id, player_id) do update
    set active_at_table = true,
        left_at = null,
        source = 'manual',
        seat_index = v_next_seat
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_add_to_party(uuid, uuid) from public, anon;
grant execute on function public.game_night_add_to_party(uuid, uuid) to authenticated;

create or replace function public.game_night_remove_from_party(
  p_session_id uuid,
  p_player_id uuid
)
returns public.game_night_session_players
language plpgsql
as $$
declare
  v_session public.game_night_sessions;
  v_row public.game_night_session_players;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag spelers van tafel slepen' using errcode = '42501';
  end if;

  select * into v_session
  from public.game_night_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Game Night % niet gevonden', p_session_id;
  end if;
  if exists (
    select 1 from public.game_night_game_sessions
    where game_night_session_id = p_session_id and status <> 'completed'
  ) then
    raise exception 'Kan de tafel niet aanpassen terwijl er een spel actief is'
      using errcode = '22023';
  end if;

  update public.game_night_session_players
  set active_at_table = false,
      left_at = now(),
      seat_index = null
  where session_id = p_session_id and player_id = p_player_id
  returning * into v_row;

  if not found then
    raise exception 'Deze speler hoort niet bij deze Game Night' using errcode = '22023';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.game_night_remove_from_party(uuid, uuid) from public, anon;
grant execute on function public.game_night_remove_from_party(uuid, uuid) to authenticated;

-- Volgorde binnen de tafel herschikken (drag-to-reorder, niet in/uit) — één
-- atomaire aanroep met de volledige nieuwe volgorde, i.p.v. losse
-- swap-RPC's per paar (voorkomt tussentijds inconsistente seat_index-sets
-- als een drag-gebeurtenis meerdere posities tegelijk verschuift).
--
-- CORRECTIE (vóór eerste uitvoering, na review): de vorige versie schreef
-- de nieuwe seat_index-waarden in ÉÉN UPDATE-statement met een
-- unnest(...)-FROM-bron. Postgres verwerkt zo'n set-gebaseerde UPDATE rij
-- voor rij en controleert een NIET-deferrable unique index (zoals
-- game_night_session_players_active_seat_idx) direct na elke afzonderlijke
-- rijwijziging — tegen de tabelstatus zoals die op dat moment is, inclusief
-- rijen die in DEZELFDE statement nog niet aan de beurt zijn geweest. Bij
-- een simpele swap (A:0↔B:1) kan Postgres eerst A op 1 zetten terwijl B nog
-- steeds op 1 staat (nog niet verwerkt) — een botsing op de unique index,
-- ook al is de UITEINDELIJKE set volledig conflictvrij.
--
-- Nieuwe, veilige tweefasenstrategie binnen dezelfde transactie/rijlock:
-- FASE 1 zet de seat_index van precies de op te nieuw te schikken spelers
-- tijdelijk op NULL. Een unique index (ook een partial index zoals hier)
-- beschouwt NULL-waarden nooit als gelijk aan elkaar — willekeurig veel
-- rijen mogen tegelijk NULL zijn zonder ook maar iets te schenden. Dat
-- maakt dit de eenvoudigste correcte tussenstap: geen tijdelijke
-- "buiten-bereik"-getallen nodig die op hun beurt weer met ANDERE actieve
-- (niet-herschikte) tafelspelers zouden kunnen botsen. FASE 2 schrijft
-- daarna in één aparte UPDATE de definitieve, aaneengesloten volgorde
-- (0..N-1) exact volgens de opgegeven array-volgorde — op dat moment zijn
-- alle betrokken rijen NULL, dus geen enkele tussenwaarde kan nog botsen.
--
-- Vooraf wordt strikt gevalideerd dat p_player_ids precies (zonder
-- duplicaten, zonder ontbrekende/onbekende spelers) de huidige actieve
-- tafelspelers van deze Game Night vertegenwoordigt — nooit een gok, nooit
-- een gedeeltelijke herschikking die andere actieve spelers ongemoeid zou
-- moeten laten maar per ongeluk toch raakt.
create or replace function public.game_night_set_party_order(
  p_session_id uuid,
  p_player_ids uuid[]
)
returns void
language plpgsql
as $$
declare
  v_session public.game_night_sessions;
  v_input_count integer;
  v_distinct_input_count integer;
  v_active_count integer;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag de volgorde aanpassen' using errcode = '42501';
  end if;

  select * into v_session
  from public.game_night_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Game Night % niet gevonden', p_session_id;
  end if;
  if exists (
    select 1 from public.game_night_game_sessions
    where game_night_session_id = p_session_id and status <> 'completed'
  ) then
    raise exception 'Kan de tafel niet aanpassen terwijl er een spel actief is'
      using errcode = '22023';
  end if;

  -- ── Validatie: p_player_ids moet EXACT de actieve tafelspelers zijn ─────
  if p_player_ids is null or array_length(p_player_ids, 1) is null then
    raise exception 'Geen spelers opgegeven' using errcode = '22023';
  end if;

  v_input_count := array_length(p_player_ids, 1);

  select count(distinct pid) into v_distinct_input_count
  from unnest(p_player_ids) as pid;

  if v_distinct_input_count <> v_input_count then
    raise exception 'Dubbele spelers in de opgegeven volgorde' using errcode = '22023';
  end if;

  select count(*) into v_active_count
  from public.game_night_session_players
  where session_id = p_session_id and active_at_table = true;

  if v_active_count <> v_input_count then
    raise exception 'De opgegeven volgorde komt niet overeen met de actieve tafelspelers'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_player_ids) as pid
    where not exists (
      select 1 from public.game_night_session_players sp
      where sp.session_id = p_session_id
        and sp.player_id = pid
        and sp.active_at_table = true
    )
  ) then
    raise exception 'Onbekende of niet-actieve speler in de opgegeven volgorde'
      using errcode = '22023';
  end if;

  -- ── Fase 1: tijdelijk NULL — botst per definitie nooit met de unique index.
  update public.game_night_session_players
  set seat_index = null
  where session_id = p_session_id
    and player_id = any(p_player_ids)
    and active_at_table = true;

  -- ── Fase 2: definitieve, aaneengesloten volgorde 0..N-1.
  update public.game_night_session_players sp
  set seat_index = ord.idx - 1
  from unnest(p_player_ids) with ordinality as ord(player_id, idx)
  where sp.session_id = p_session_id
    and sp.player_id = ord.player_id
    and sp.active_at_table = true;
end;
$$;

revoke execute on function public.game_night_set_party_order(uuid, uuid[]) from public, anon;
grant execute on function public.game_night_set_party_order(uuid, uuid[]) to authenticated;

-- ── Realtime (sectie 19-20 van de opdracht) ───────────────────────────────
-- Idempotent, zelfde patroon als 20260908000000_reconstruct_realtime_publication.sql.
-- Alleen game_night_session_players hoeft live te zijn — de tablet-lobby
-- toont alleen wie er aan tafel zit/verdwijnt, niet elke andere Game
-- Night-tabel. Al veilig herhaalbaar (expliciete existence-check), geen
-- wijziging nodig.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_night_session_players'
  ) then
    alter publication supabase_realtime add table public.game_night_session_players;
  end if;
end
$$;
