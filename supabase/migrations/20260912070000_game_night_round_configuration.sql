-- Game Night — rondeconfiguratie instelbaar per spel + stabiele snapshot
-- per spelsessie. Additief op de zeven bestaande Game Night-migraties.
--
-- Root cause van "ik zie nooit RONDE 1 bij Skull" (zie het opleverrapport):
-- de rondearchitectuur (rounds/round_results/RoundPlayPanel/RPC's) werkte
-- al correct, maar er bestond nergens een manier — SQL of UI — om
-- `game_night_games.uses_rounds` daadwerkelijk op true te zetten. Elk spel
-- stond dus altijd op de kolomdefault (false), dus de rondetak in
-- ActiveGameSessionPanel werd nooit bereikt. Deze migratie voegt geen
-- tweede rondesysteem toe — alleen de ontbrekende configuratie-laag + een
-- stabiele snapshot zodat lopende/historische spelsessies niet met
-- terugwerkende kracht van gedrag veranderen als de spelconfiguratie later
-- wijzigt (sectie 29-31).

-- ── Configuratie-snapshot op de spelsessie ────────────────────────────────
-- Kopie van game_night_games.{uses_rounds,track_round_results,
-- has_session_winner,result_mode} op het moment dat de spelsessie start.
-- Alle latere UI/logica leest deze kolommen op de spelsessie zelf, NOOIT
-- meer live game_night_games.uses_rounds e.d. — zo blijft een lopende of
-- afgeronde spelsessie zijn eigen gedrag houden, ook als iemand de
-- spelconfiguratie in de Spellenkast daarna aanpast.
alter table public.game_night_game_sessions
  add column if not exists uses_rounds boolean not null default false,
  add column if not exists track_round_results boolean not null default false,
  add column if not exists has_session_winner boolean not null default true,
  add column if not exists result_mode text not null default 'winner';

alter table public.game_night_game_sessions
  add constraint game_night_game_sessions_result_mode_check
  check (result_mode in ('winner', 'score', 'ranking', 'team', 'coop'));

comment on column public.game_night_game_sessions.uses_rounds is
  'Snapshot van game_night_games.uses_rounds op het moment dat deze spelsessie startte — bepaalt of deze specifieke sessie de rondeflow toont, onafhankelijk van latere configuratiewijzigingen.';

-- ── RPC: spelsessie starten — nu met configuratiesnapshot ────────────────
-- Volledige herdefinitie (create or replace, zelfde signature) van de RPC
-- uit 20260912060000: enige inhoudelijke wijziging is dat de vier
-- configuratievelden nu mee de insert in gaan.
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
    uses_rounds, track_round_results, has_session_winner, result_mode
  )
  values (
    p_game_night_session_id, p_game_id, 'active',
    v_game.uses_rounds, v_game.track_round_results,
    v_game.has_session_winner, v_game.result_mode
  )
  returning * into v_result;

  insert into public.game_night_game_session_players (game_session_id, player_id, seat_order)
  select v_result.id, pid, (row_number() over ()) - 1
  from unnest(p_player_ids) as pid;

  if v_game.uses_rounds then
    insert into public.game_night_rounds (game_session_id, round_number)
    values (v_result.id, 1);
  end if;

  return v_result;
end;
$$;

revoke execute on function public.game_night_start_game_session(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.game_night_start_game_session(uuid, uuid, uuid[])
  to authenticated;

-- ── RPC: ronde afronden ZONDER resultaat ──────────────────────────────────
-- Voor uses_rounds=true + track_round_results=false (sectie 18): sluit de
-- huidige ronde en maakt de volgende klaar, zonder ook maar één rij in
-- game_night_round_results te schrijven — geen nepwinnaar.
create or replace function public.game_night_end_round(
  p_round_id uuid
)
returns public.game_night_rounds
language plpgsql
as $$
declare
  v_round public.game_night_rounds;
  v_next_round_number integer;
  v_next_round public.game_night_rounds;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_round
  from public.game_night_rounds
  where id = p_round_id
  for update;

  if not found then
    raise exception 'Ronde % niet gevonden', p_round_id;
  end if;
  if v_round.ended_at is not null then
    raise exception 'Deze ronde is al afgerond' using errcode = '22023';
  end if;

  update public.game_night_rounds set ended_at = now() where id = p_round_id;

  select coalesce(max(round_number), 0) + 1 into v_next_round_number
  from public.game_night_rounds
  where game_session_id = v_round.game_session_id;

  insert into public.game_night_rounds (game_session_id, round_number)
  values (v_round.game_session_id, v_next_round_number)
  returning * into v_next_round;

  return v_next_round;
end;
$$;

revoke execute on function public.game_night_end_round(uuid) from public, anon;
grant execute on function public.game_night_end_round(uuid) to authenticated;

-- ── RPC: nog-actieve ronde weggooien ───────────────────────────────────────
-- Voor sectie 24: als de gebruiker het hele spel wil afronden terwijl de
-- huidige ronde nog loopt, mag die ronde nooit stilletjes als gewonnen/
-- verloren worden opgeslagen. Een ronde zonder resultaten heeft nooit echt
-- "plaatsgevonden" in de statistieken, dus weggooien (i.p.v. afsluiten-
-- zonder-resultaat) houdt game_night_rounds vrij van lege afgeronde rijen.
-- Weigert expliciet als er toch al resultaten aan hangen (kan in de
-- huidige flow niet gebeuren, maar de check kost niets en voorkomt stille
-- dataverlies bij toekomstige uitbreidingen).
create or replace function public.game_night_discard_open_round(
  p_round_id uuid
)
returns void
language plpgsql
as $$
declare
  v_round public.game_night_rounds;
  v_result_count integer;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_round
  from public.game_night_rounds
  where id = p_round_id
  for update;

  if not found then
    raise exception 'Ronde % niet gevonden', p_round_id;
  end if;
  if v_round.ended_at is not null then
    raise exception 'Deze ronde is al afgerond, kan niet meer worden weggegooid'
      using errcode = '22023';
  end if;

  select count(*) into v_result_count
  from public.game_night_round_results
  where round_id = p_round_id;

  if v_result_count > 0 then
    raise exception 'Deze ronde heeft al resultaten, kan niet zomaar worden weggegooid'
      using errcode = '22023';
  end if;

  delete from public.game_night_rounds where id = p_round_id;
end;
$$;

revoke execute on function public.game_night_discard_open_round(uuid) from public, anon;
grant execute on function public.game_night_discard_open_round(uuid) to authenticated;
