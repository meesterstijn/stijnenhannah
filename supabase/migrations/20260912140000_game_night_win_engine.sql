-- Game Night V2.2 — Universal WIN Engine + Active Play Core. Additief op
-- de zestien bestaande Game Night-migraties (incl. V2.1's
-- 20260912120000/20260912130000). Verandert GEEN bestaande legacy-rijen:
-- elke al bestaande game_night_game_sessions-rij houdt zijn huidige
-- win_source ('legacy', via de V2.1-default) en blijft dus volledig via de
-- bestaande ronde-RPC's/UI werken.
--
-- ── Kernbeslissing (sectie 2) ──────────────────────────────────────────
-- Vanaf nu start elke NIEUWE spelsessie met win_source='win_events' — de
-- oude spelconfiguratievelden (uses_rounds/track_round_results/
-- has_session_winner/result_mode) blijven wél gekopieerd op de sessie
-- (historie/backwards compatibility, zie het opleverrapport), maar bepalen
-- niet langer de actieve interactie: die is voortaan altijd "speler
-- aantikken = één WIN". Ronde 1 wordt daarom niet meer automatisch
-- aangemaakt voor nieuwe sessies — dat zou alleen een permanent open,
-- nooit-gebruikte rij in game_night_rounds opleveren.

create or replace function public.game_night_start_game_session(
  p_game_night_session_id uuid,
  p_game_id uuid,
  p_player_ids uuid[]
)
returns public.game_night_game_sessions
language plpgsql
as $$
declare
  v_session public.game_night_sessions;
  v_game public.game_night_games;
  v_result public.game_night_game_sessions;
  v_player_count integer;
  v_attendee_count integer;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_session
  from public.game_night_sessions
  where id = p_game_night_session_id
  for update;

  if not found then
    raise exception 'Game Night % niet gevonden', p_game_night_session_id;
  end if;
  if v_session.status = 'completed' then
    raise exception 'Deze Game Night is al afgesloten' using errcode = '22023';
  end if;

  select * into v_game from public.game_night_games where id = p_game_id;
  if not found then
    raise exception 'Spel % niet gevonden', p_game_id;
  end if;
  if v_game.archived_at is not null then
    raise exception 'Dit spel is gearchiveerd' using errcode = '22023';
  end if;

  if p_player_ids is null or array_length(p_player_ids, 1) is null then
    raise exception 'Selecteer minstens één speler' using errcode = '22023';
  end if;
  v_player_count := array_length(p_player_ids, 1);

  if v_game.min_players is not null and v_player_count < v_game.min_players then
    raise exception 'Dit spel heeft minimaal % spelers nodig', v_game.min_players
      using errcode = '22023';
  end if;
  if v_game.max_players is not null and v_player_count > v_game.max_players then
    raise exception 'Dit spel ondersteunt maximaal % spelers', v_game.max_players
      using errcode = '22023';
  end if;

  select count(*) into v_attendee_count
  from public.game_night_session_players
  where session_id = p_game_night_session_id
    and player_id = any(p_player_ids);
  if v_attendee_count <> v_player_count then
    raise exception 'Een of meer geselecteerde spelers zijn niet aanwezig bij deze Game Night'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.game_night_game_sessions
    where game_night_session_id = p_game_night_session_id
      and status <> 'completed'
  ) then
    raise exception 'Er wordt al een ander spel gespeeld tijdens deze Game Night'
      using errcode = '23505';
  end if;

  insert into public.game_night_game_sessions (
    game_night_session_id, game_id, status,
    uses_rounds, track_round_results, has_session_winner, result_mode,
    win_source
  )
  values (
    p_game_night_session_id, p_game_id, 'active',
    v_game.uses_rounds, v_game.track_round_results,
    v_game.has_session_winner, v_game.result_mode,
    'win_events'
  )
  returning * into v_result;

  insert into public.game_night_game_session_players (game_session_id, player_id, seat_order)
  select v_result.id, pid, (row_number() over ()) - 1
  from unnest(p_player_ids) as pid;

  -- Geen automatische ronde 1 meer (was hier vóór V2.2, zie
  -- 20260912070000): een win_events-sessie gebruikt nooit meer rondes.

  return v_result;
end;
$$;

revoke execute on function public.game_night_start_game_session(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.game_night_start_game_session(uuid, uuid, uuid[])
  to authenticated;

-- ── RPC: WIN registreren (sectie 3) ───────────────────────────────────────
-- Eén call = exact één game_night_win_events-rij. Bewust GEEN
-- dubbel-tik-bescherming server-side: twee bewuste tikken mogen twee
-- events zijn (sectie 3) — dat is een UI-verantwoordelijkheid (pending-
-- state op de knop), niet iets wat de RPC mag onderdrukken.
create or replace function public.game_night_record_win(
  p_game_session_id uuid,
  p_player_id uuid
)
returns public.game_night_win_events
language plpgsql
as $$
declare
  v_session public.game_night_game_sessions;
  v_event public.game_night_win_events;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_session
  from public.game_night_game_sessions
  where id = p_game_session_id
  for update;

  if not found then
    raise exception 'Spelsessie % niet gevonden', p_game_session_id;
  end if;
  if v_session.status <> 'active' then
    raise exception 'Deze spelsessie is niet actief' using errcode = '22023';
  end if;
  if v_session.win_source <> 'win_events' then
    raise exception 'Deze spelsessie gebruikt geen WIN-events'
      using errcode = '22023';
  end if;

  -- Impliceert dat de speler bestaat (game_session_players.player_id is
  -- zelf al FK-gebonden aan game_night_players) — mag gearchiveerd zijn,
  -- zolang hij al rechtmatig deelnemer is (sectie 3): geen aparte
  -- archived_at-check.
  if not exists (
    select 1 from public.game_night_game_session_players
    where game_session_id = p_game_session_id
      and player_id = p_player_id
  ) then
    raise exception 'Deze speler doet niet mee aan deze spelsessie'
      using errcode = '22023';
  end if;

  insert into public.game_night_win_events (game_session_id, player_id)
  values (p_game_session_id, p_player_id)
  returning * into v_event;

  return v_event;
end;
$$;

revoke execute on function public.game_night_record_win(uuid, uuid)
  from public, anon;
grant execute on function public.game_night_record_win(uuid, uuid)
  to authenticated;

-- ── RPC: WIN ongedaan maken (sectie 4) ────────────────────────────────────
-- Event-specifiek ("maak precies event X ongedaan"), nooit "haal laatste
-- WIN van speler Y weg" — de actiefeed kan zo altijd betrouwbaar exact het
-- getikte event corrigeren. Soft-delete: undone_at, NOOIT hard delete.
create or replace function public.game_night_undo_win_event(
  p_win_event_id uuid
)
returns public.game_night_win_events
language plpgsql
as $$
declare
  v_event public.game_night_win_events;
  v_session public.game_night_game_sessions;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_event
  from public.game_night_win_events
  where id = p_win_event_id
  for update;

  if not found then
    raise exception 'WIN-event % niet gevonden', p_win_event_id;
  end if;
  if v_event.undone_at is not null then
    raise exception 'Dit WIN-event is al ongedaan gemaakt' using errcode = '22023';
  end if;

  select * into v_session
  from public.game_night_game_sessions
  where id = v_event.game_session_id;

  if not found or v_session.win_source <> 'win_events' then
    raise exception 'Ongeldige spelsessie voor dit WIN-event'
      using errcode = '22023';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Deze spelsessie is niet meer actief' using errcode = '22023';
  end if;

  update public.game_night_win_events
  set undone_at = now()
  where id = p_win_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke execute on function public.game_night_undo_win_event(uuid)
  from public, anon;
grant execute on function public.game_night_undo_win_event(uuid)
  to authenticated;

-- ── RPC: WIN-sessie afsluiten (sectie 12-13) ──────────────────────────────
-- Bewust een aparte, kleine RPC i.p.v. game_night_complete_game_session
-- hergebruiken: die bestaande RPC schrijft altijd (eventueel lege)
-- game_night_game_session_results — precies het "meeste WINs = session
-- winner"-automatisme dat sectie 12 expliciet verbiedt. Een aparte RPC
-- maakt dat verschil onmiskenbaar in de database zelf, i.p.v. een
-- optioneel/impliciet leeg-resultaten-pad in de bestaande RPC te verstoppen.
-- Legacy completion (game_night_complete_game_session) blijft ongewijzigd
-- bestaan en werkt voor win_source='legacy'-sessies exact zoals vóór V2.2.
create or replace function public.game_night_complete_win_session(
  p_game_session_id uuid
)
returns public.game_night_game_sessions
language plpgsql
as $$
declare
  v_session public.game_night_game_sessions;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_session
  from public.game_night_game_sessions
  where id = p_game_session_id
  for update;

  if not found then
    raise exception 'Spelsessie % niet gevonden', p_game_session_id;
  end if;
  if v_session.win_source <> 'win_events' then
    raise exception 'Deze spelsessie gebruikt geen WIN-events'
      using errcode = '22023';
  end if;
  if v_session.status = 'completed' then
    return v_session; -- idempotent, zelfde patroon als complete_game_session
  end if;

  update public.game_night_game_sessions
  set status = 'completed', ended_at = now()
  where id = p_game_session_id
  returning * into v_session;

  return v_session;
end;
$$;

revoke execute on function public.game_night_complete_win_session(uuid)
  from public, anon;
grant execute on function public.game_night_complete_win_session(uuid)
  to authenticated;
