-- Game Night V2 — actieve speelmodus: van spelkeuze tot afronden. Additief
-- op de zes bestaande Game Night-migraties. Bevat de multi-step writes die
-- betrouwbaar/atomair moeten gebeuren (starten, pauzeren/hervatten, ronde-
-- resultaat + volgende ronde, potje afronden, Game Night afsluiten) als
-- gewone `plpgsql`-functies — GEEN `security definer` (zelfde keuze als
-- `archive_qr_label`, 20260907000000): RLS op de onderliggende tabellen
-- blijft gewoon gelden binnen de functie, de expliciete `private.is_owner()`
-- -check bovenaan is alleen voor een vriendelijke foutmelding i.p.v. een
-- kale RLS-weigering.

-- ── Timer-fundament (sectie 12) ──────────────────────────────────────────
-- `paused_at` alleen is onvoldoende om meerdere pause/resume-cycli correct
-- uit de speeltijd te houden — elke keer hervatten telt de verstreken
-- pauzeduur op bij dit totaal, waarna de verstreken speeltijd altijd
-- `now() - started_at - total_paused_seconds` is (of `ended_at` i.p.v. nu
-- bij completed).
alter table public.game_night_game_sessions
  add column if not exists total_paused_seconds integer not null default 0;

comment on column public.game_night_game_sessions.total_paused_seconds is
  'Cumulatieve tijd (seconden) die deze spelsessie gepauzeerd heeft gestaan, over eventueel meerdere pause/resume-cycli. Verstreken speeltijd = (ended_at of now()) - started_at - total_paused_seconds.';

-- ── Eén open spelsessie per Game Night (sectie 8/46) ─────────────────────
-- Database-side afgedwongen, niet alleen in de UI: een tweede active/paused
-- spelsessie voor dezelfde Game Night kan letterlijk niet ingevoegd worden.
-- "Open" = niet completed; een gepauzeerd spel telt ook mee (sectie 8: de
-- UI moet altijd weten welk spel op dit moment actief/gepauzeerd is, nooit
-- twee tegelijk).
create unique index game_night_game_sessions_one_open_idx
  on public.game_night_game_sessions (game_night_session_id)
  where status <> 'completed';

-- ── RPC: spelsessie starten ───────────────────────────────────────────────
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

  -- Elke gekozen speler moet daadwerkelijk aanwezig zijn bij deze Game Night
  -- (sectie 5: aanwezig ≠ automatisch deelnemer aan elk spel, maar wel een
  -- voorwaarde om te kunnen deelnemen).
  select count(*) into v_attendee_count
  from public.game_night_session_players
  where session_id = p_game_night_session_id
    and player_id = any(p_player_ids);
  if v_attendee_count <> v_player_count then
    raise exception 'Een of meer geselecteerde spelers zijn niet aanwezig bij deze Game Night'
      using errcode = '22023';
  end if;

  -- Vriendelijke foutmelding vóór de insert; de partial unique index
  -- hierboven is de echte bescherming tegen een race (dubbel tikken).
  if exists (
    select 1 from public.game_night_game_sessions
    where game_night_session_id = p_game_night_session_id
      and status <> 'completed'
  ) then
    raise exception 'Er wordt al een ander spel gespeeld tijdens deze Game Night'
      using errcode = '23505';
  end if;

  insert into public.game_night_game_sessions (game_night_session_id, game_id, status)
  values (p_game_night_session_id, p_game_id, 'active')
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

-- ── RPC: pauzeren ──────────────────────────────────────────────────────────
create or replace function public.game_night_pause_game_session(
  p_game_session_id uuid
)
returns public.game_night_game_sessions
language plpgsql
as $$
declare
  v_row public.game_night_game_sessions;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_row
  from public.game_night_game_sessions
  where id = p_game_session_id
  for update;

  if not found then
    raise exception 'Spelsessie % niet gevonden', p_game_session_id;
  end if;

  -- Idempotent: een dubbele tik op "Pauzeer" mag niet stuklopen.
  if v_row.status <> 'active' then
    return v_row;
  end if;

  update public.game_night_game_sessions
  set status = 'paused', paused_at = now()
  where id = p_game_session_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_pause_game_session(uuid)
  from public, anon;
grant execute on function public.game_night_pause_game_session(uuid)
  to authenticated;

-- ── RPC: hervatten ─────────────────────────────────────────────────────────
create or replace function public.game_night_resume_game_session(
  p_game_session_id uuid
)
returns public.game_night_game_sessions
language plpgsql
as $$
declare
  v_row public.game_night_game_sessions;
  v_elapsed integer;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_row
  from public.game_night_game_sessions
  where id = p_game_session_id
  for update;

  if not found then
    raise exception 'Spelsessie % niet gevonden', p_game_session_id;
  end if;

  if v_row.status <> 'paused' then
    return v_row; -- idempotent
  end if;

  v_elapsed := greatest(0, extract(epoch from (now() - v_row.paused_at))::integer);

  update public.game_night_game_sessions
  set status = 'active',
      total_paused_seconds = total_paused_seconds + v_elapsed,
      paused_at = null
  where id = p_game_session_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_resume_game_session(uuid)
  from public, anon;
grant execute on function public.game_night_resume_game_session(uuid)
  to authenticated;

-- ── RPC: ronde-winnaar vastleggen + volgende ronde klaarzetten ────────────
-- Eén tik = ronde afsluiten + resultaat opslaan + volgende ronde aanmaken,
-- zodat snelle rondespellen (Skull) geen tussenscherm nodig hebben (sectie
-- 15-17). Slaat voor ALLE deelnemers van de spelsessie een resultaatrij op
-- (niet alleen de winnaar) zodat "wie deed mee maar won niet" ook
-- herleidbaar blijft.
create or replace function public.game_night_record_round_winner(
  p_round_id uuid,
  p_winner_player_id uuid
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

  select coalesce(max(round_number), 0) + 1 into v_next_round_number
  from public.game_night_rounds
  where game_session_id = v_round.game_session_id;

  insert into public.game_night_rounds (game_session_id, round_number)
  values (v_round.game_session_id, v_next_round_number)
  returning * into v_next_round;

  return v_next_round;
end;
$$;

revoke execute on function public.game_night_record_round_winner(uuid, uuid)
  from public, anon;
grant execute on function public.game_night_record_round_winner(uuid, uuid)
  to authenticated;

-- ── RPC: laatste ronderesultaat corrigeren ────────────────────────────────
-- Past alleen de resultaten van een AL afgeronde ronde aan (geen nieuwe
-- ronde, geen nieuwe rijen — de unique (round_id, player_id) constraint
-- voorkomt sowieso dubbele winnaarrecords, dit is een update).
create or replace function public.game_night_correct_round_result(
  p_round_id uuid,
  p_winner_player_id uuid
)
returns void
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

  if not exists (
    select 1 from public.game_night_game_session_players
    where game_session_id = v_round.game_session_id
      and player_id = p_winner_player_id
  ) then
    raise exception 'Deze speler doet niet mee aan deze spelsessie'
      using errcode = '22023';
  end if;

  update public.game_night_round_results
  set is_winner = (player_id = p_winner_player_id)
  where round_id = p_round_id;
end;
$$;

revoke execute on function public.game_night_correct_round_result(uuid, uuid)
  from public, anon;
grant execute on function public.game_night_correct_round_result(uuid, uuid)
  to authenticated;

-- ── RPC: spelsessie afronden ───────────────────────────────────────────────
-- p_results: jsonb-array van {"player_id": uuid, "is_winner": bool,
-- "score": int|null, "rank": int|null} — resultaat wegschrijven en
-- afronden gebeuren bewust in dezelfde functie/transactie (sectie 21: nooit
-- een spelsessie die completed is zonder resultaat, of andersom).
create or replace function public.game_night_complete_game_session(
  p_game_session_id uuid,
  p_results jsonb
)
returns public.game_night_game_sessions
language plpgsql
as $$
declare
  v_row public.game_night_game_sessions;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_row
  from public.game_night_game_sessions
  where id = p_game_session_id
  for update;

  if not found then
    raise exception 'Spelsessie % niet gevonden', p_game_session_id;
  end if;
  if v_row.status = 'completed' then
    return v_row; -- idempotent
  end if;

  insert into public.game_night_game_session_results
    (game_session_id, player_id, is_winner, score, rank)
  select
    p_game_session_id,
    (r->>'player_id')::uuid,
    coalesce((r->>'is_winner')::boolean, false),
    nullif(r->>'score', '')::integer,
    nullif(r->>'rank', '')::integer
  from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) as r
  on conflict (game_session_id, player_id) do update
    set is_winner = excluded.is_winner,
        score = excluded.score,
        rank = excluded.rank;

  update public.game_night_game_sessions
  set status = 'completed', ended_at = now()
  where id = p_game_session_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_complete_game_session(uuid, jsonb)
  from public, anon;
grant execute on function public.game_night_complete_game_session(uuid, jsonb)
  to authenticated;

-- ── RPC: Game Night afsluiten ──────────────────────────────────────────────
create or replace function public.game_night_complete_session(
  p_session_id uuid
)
returns public.game_night_sessions
language plpgsql
as $$
declare
  v_row public.game_night_sessions;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner heeft toegang tot Game Night'
      using errcode = '42501';
  end if;

  select * into v_row
  from public.game_night_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Game Night % niet gevonden', p_session_id;
  end if;
  if v_row.status = 'completed' then
    return v_row; -- idempotent
  end if;

  if exists (
    select 1 from public.game_night_game_sessions
    where game_night_session_id = p_session_id
      and status <> 'completed'
  ) then
    raise exception 'Rond eerst het huidige spel af voordat je de Game Night afsluit'
      using errcode = '22023';
  end if;

  update public.game_night_sessions
  set status = 'completed', ended_at = now()
  where id = p_session_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_complete_session(uuid)
  from public, anon;
grant execute on function public.game_night_complete_session(uuid)
  to authenticated;
