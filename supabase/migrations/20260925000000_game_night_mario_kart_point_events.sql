-- Game Night — Mario Kart-puntenklassement, van mutable totaal naar
-- append-only event-log. Vervangt 20260924010000_game_night_mario_kart_points.sql:
-- die tabel hield per (Game Night, speler) één rij met een lopend totaal bij
-- (game_night_add_mario_kart_points telde er steeds `points += delta` bij
-- op). Daarmee kan een "laatste wijziging ongedaan maken"-knop niet
-- correct terugdraaien zonder zelf al een geschiedenis bij te houden — dus
-- die geschiedenis wordt nu de bron van waarheid zelf, exact hetzelfde
-- patroon als game_night_win_events (20260912140000_game_night_win_engine.sql):
-- elke toekenning is een eigen rij, `undone_at` markeert "ongedaan gemaakt"
-- i.p.v. de rij te verwijderen of een tweede compenserende rij te schrijven,
-- en het puntentotaal per speler is altijd de som van de delta's van
-- niet-ongedaan-gemaakte rijen (client-side opgeteld, zie
-- MarioKartLeaderboard.tsx — zelfde aanpak als activeWinsByPlayer in
-- GameNightV2Arena.tsx).
create table public.game_night_mario_kart_point_events (
  id uuid primary key default gen_random_uuid(),
  game_night_session_id uuid not null references public.game_night_sessions(id) on delete cascade,
  player_id uuid not null references public.game_night_players(id) on delete cascade,
  delta integer not null,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create index game_night_mario_kart_point_events_session_idx
  on public.game_night_mario_kart_point_events (game_night_session_id, created_at);

alter table public.game_night_mario_kart_point_events enable row level security;

create policy "game_night_mario_kart_point_events: owner only" on public.game_night_mario_kart_point_events
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- Zelfde patroon als 20260912160000_game_night_member_rls.sql: een member
-- mag het klassement van de lopende avond zien, alleen de owner mag punten
-- toekennen/ongedaan maken (zie de RPC's hieronder).
create policy "game_night_mario_kart_point_events: member select" on public.game_night_mario_kart_point_events
  for select to authenticated
  using (private.is_game_night_member_or_owner());

revoke all on public.game_night_mario_kart_point_events from anon;

-- Migreer bestaande totalen (indien deze migratie op een omgeving draait
-- waar al punten zijn toegekend) als één synthetische event-rij per
-- speler, zodat al gegeven punten niet verloren gaan bij de overstap.
insert into public.game_night_mario_kart_point_events (game_night_session_id, player_id, delta, created_at)
select game_night_session_id, player_id, points, created_at
from public.game_night_mario_kart_points
where points <> 0;

drop function if exists public.game_night_add_mario_kart_points(uuid, uuid, integer);
drop table public.game_night_mario_kart_points;

-- ── Punten toekennen (owner only) — vervangt game_night_add_mario_kart_points.
-- Bewust GEEN SECURITY DEFINER, zelfde patroon als elders: de owner heeft via
-- de FOR ALL-policy hierboven al volledige toegang, dit is puur een nette
-- foutmelding voor een niet-owner.
create or replace function public.game_night_award_mario_kart_points(
  p_game_night_session_id uuid,
  p_player_id uuid,
  p_delta integer
)
returns public.game_night_mario_kart_point_events
language plpgsql
as $$
declare
  v_session public.game_night_sessions;
  v_row public.game_night_mario_kart_point_events;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag Mario Kart-punten toekennen' using errcode = '42501';
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

  insert into public.game_night_mario_kart_point_events (game_night_session_id, player_id, delta)
  values (p_game_night_session_id, p_player_id, p_delta)
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_award_mario_kart_points(uuid, uuid, integer) from public, anon;
grant execute on function public.game_night_award_mario_kart_points(uuid, uuid, integer) to authenticated;

-- ── Laatste wijziging ongedaan maken (owner only) — pakt de meest recente
-- niet-ongedaan-gemaakte rij van DEZE Game Night (welke speler dan ook, het
-- is één gedeelde "ongedaan maken"-knop, geen per-speler-knop) en markeert
-- 'm. `for update` op die ene rij voorkomt dat twee snel na elkaar
-- ingedrukte klikken dezelfde rij dubbel zouden proberen ongedaan te maken.
-- Bewust GEEN sessie-status-check zoals bij award hierboven: corrigeren van
-- een fout mag ook nog na het afsluiten van de Game Night.
create or replace function public.game_night_undo_last_mario_kart_point_event(
  p_game_night_session_id uuid
)
returns public.game_night_mario_kart_point_events
language plpgsql
as $$
declare
  v_row public.game_night_mario_kart_point_events;
begin
  if not private.is_owner() then
    raise exception 'Alleen owner mag Mario Kart-punten ongedaan maken' using errcode = '42501';
  end if;

  select * into v_row
  from public.game_night_mario_kart_point_events
  where game_night_session_id = p_game_night_session_id
    and undone_at is null
  order by created_at desc
  for update
  limit 1;

  if not found then
    raise exception 'Geen puntenwijziging om ongedaan te maken' using errcode = '22023';
  end if;

  update public.game_night_mario_kart_point_events
  set undone_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_undo_last_mario_kart_point_event(uuid) from public, anon;
grant execute on function public.game_night_undo_last_mario_kart_point_event(uuid) to authenticated;
