-- Game Night — Mario Kart-puntenklassement. Bewust GEEN gebruik van het
-- bestaande rondes/sessieresultaten-systeem (game_night_rounds/
-- game_night_game_session_results): dat systeem is opgebouwd rond "wie won
-- deze ronde/sessie" (booleans), niet rond vrij door de owner toegekende
-- puntentotalen. Dit is een eigen, kleine tabel: één rij per (Game Night,
-- speler) met een lopend puntentotaal dat de owner na elke race ophoogt
-- (of verlaagt, bij een correctie) — en dat dus vanzelf weer op nul begint
-- zodra een nieuwe game_night_sessions-rij ontstaat (geen aparte
-- reset-actie nodig).
create table public.game_night_mario_kart_points (
  id uuid primary key default gen_random_uuid(),
  game_night_session_id uuid not null references public.game_night_sessions(id) on delete cascade,
  player_id uuid not null references public.game_night_players(id) on delete cascade,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_night_session_id, player_id)
);

create trigger set_game_night_mario_kart_points_updated_at
  before update on public.game_night_mario_kart_points
  for each row execute function public.set_updated_at();

alter table public.game_night_mario_kart_points enable row level security;

create policy "game_night_mario_kart_points: owner only" on public.game_night_mario_kart_points
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- Zelfde patroon als 20260912160000_game_night_member_rls.sql: een member
-- mag het klassement van de lopende avond zien (gedeelde, sociale Game
-- Night-data), maar alleen de owner mag punten toekennen — zie de RPC
-- hieronder.
create policy "game_night_mario_kart_points: member select" on public.game_night_mario_kart_points
  for select to authenticated
  using (private.is_game_night_member_or_owner());

revoke all on public.game_night_mario_kart_points from anon;

-- ── Punten toekennen (owner only) ────────────────────────────────────────
-- `p_delta` is het getal dat de owner net intypt (bv. 15 na een gewonnen
-- race, of -5 om een fout te corrigeren) en wordt bij het bestaande totaal
-- van deze speler in deze Game Night opgeteld — nooit een absoluut totaal
-- overschrijven, zodat twee snel na elkaar ingevoerde races nooit elkaars
-- punten overschrijven. Bewust GEEN SECURITY DEFINER: de owner heeft via de
-- FOR ALL-policy hierboven al volledige toegang, dit is puur een nette
-- foutmelding voor een niet-owner, zelfde patroon als
-- game_night_add_to_party.
create or replace function public.game_night_add_mario_kart_points(
  p_game_night_session_id uuid,
  p_player_id uuid,
  p_delta integer
)
returns public.game_night_mario_kart_points
language plpgsql
as $$
declare
  v_session public.game_night_sessions;
  v_row public.game_night_mario_kart_points;
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

  insert into public.game_night_mario_kart_points (game_night_session_id, player_id, points)
  values (p_game_night_session_id, p_player_id, p_delta)
  on conflict (game_night_session_id, player_id) do update
    set points = public.game_night_mario_kart_points.points + excluded.points
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.game_night_add_mario_kart_points(uuid, uuid, integer) from public, anon;
grant execute on function public.game_night_add_mario_kart_points(uuid, uuid, integer) to authenticated;
