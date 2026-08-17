-- Game Night — handmatige rondeflow. Additief op de acht bestaande Game
-- Night-migraties.
--
-- Root cause van "het springt automatisch door naar de volgende ronde": dat
-- was geen bug, maar bewust zo gebouwd in 20260912060000/20260912070000 —
-- `game_night_record_round_winner` en `game_night_end_round` deden ronde
-- sluiten + resultaat opslaan + volgende ronde aanmaken in één atomaire
-- stap, met als expliciet doel een zo snel mogelijk rondetempo (destijds
-- een letterlijke opdrachteis: "Idealiter kan de volgende ronde automatisch
-- worden aangemaakt"). Deze migratie draait dat gedrag bewust terug: beide
-- functies sluiten nu ALLEEN de huidige ronde af (met of zonder resultaat),
-- een nieuwe ronde ontstaat voortaan uitsluitend via de nieuwe
-- game_night_start_next_round, expliciet aangeroepen door de gebruiker.

-- ── RPC: ronde-winnaar vastleggen (nu ZONDER volgende ronde) ─────────────
create or replace function public.game_night_record_round_winner(
  p_round_id uuid,
  p_winner_player_id uuid
)
returns public.game_night_rounds
language plpgsql
as $$
declare
  v_round public.game_night_rounds;
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

  if not exists (
    select 1 from public.game_night_game_session_players
    where game_session_id = v_round.game_session_id
      and player_id = p_winner_player_id
  ) then
    raise exception 'Deze speler doet niet mee aan deze spelsessie'
      using errcode = '22023';
  end if;

  update public.game_night_rounds set ended_at = now() where id = p_round_id;

  insert into public.game_night_round_results (round_id, player_id, is_winner)
  select p_round_id, gsp.player_id, gsp.player_id = p_winner_player_id
  from public.game_night_game_session_players gsp
  where gsp.game_session_id = v_round.game_session_id
  on conflict (round_id, player_id) do update
    set is_winner = excluded.is_winner;

  select * into v_round from public.game_night_rounds where id = p_round_id;
  return v_round;
end;
$$;

revoke execute on function public.game_night_record_round_winner(uuid, uuid)
  from public, anon;
grant execute on function public.game_night_record_round_winner(uuid, uuid)
  to authenticated;

-- ── RPC: ronde afronden zonder resultaat (nu ZONDER volgende ronde) ──────
create or replace function public.game_night_end_round(
  p_round_id uuid
)
returns public.game_night_rounds
language plpgsql
as $$
declare
  v_round public.game_night_rounds;
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

  update public.game_night_rounds
  set ended_at = now()
  where id = p_round_id
  returning * into v_round;

  return v_round;
end;
$$;

revoke execute on function public.game_night_end_round(uuid) from public, anon;
grant execute on function public.game_night_end_round(uuid) to authenticated;

-- ── RPC: volgende ronde starten (nieuw, expliciet) ────────────────────────
-- De enige plek waar nu nog een game_night_rounds-rij ontstaat buiten het
-- starten van de spelsessie zelf (ronde 1, zie game_night_start_game_session
-- in 20260912070000, ongewijzigd). Locking op de game_session-rij (for
-- update) zorgt dat twee gelijktijdige aanroepen voor dezelfde spelsessie
-- serialiseren — de tweede aanroep ziet dan de zojuist aangemaakte ronde
-- van de eerste en wordt correct geweigerd door de "geen open ronde"-check,
-- i.p.v. een dubbele ronde aan te maken. De unique constraint op
-- (game_session_id, round_number) is de laatste, harde backstop.
create or replace function public.game_night_start_next_round(
  p_game_session_id uuid
)
returns public.game_night_rounds
language plpgsql
as $$
declare
  v_session public.game_night_game_sessions;
  v_next_round_number integer;
  v_next_round public.game_night_rounds;
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
  if not v_session.uses_rounds then
    raise exception 'Deze spelsessie gebruikt geen rondes' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.game_night_rounds
    where game_session_id = p_game_session_id
      and ended_at is null
  ) then
    raise exception 'Er is nog een actieve ronde — rond die eerst af'
      using errcode = '22023';
  end if;

  select coalesce(max(round_number), 0) + 1 into v_next_round_number
  from public.game_night_rounds
  where game_session_id = p_game_session_id;

  insert into public.game_night_rounds (game_session_id, round_number)
  values (p_game_session_id, v_next_round_number)
  returning * into v_next_round;

  return v_next_round;
end;
$$;

revoke execute on function public.game_night_start_next_round(uuid)
  from public, anon;
grant execute on function public.game_night_start_next_round(uuid)
  to authenticated;
