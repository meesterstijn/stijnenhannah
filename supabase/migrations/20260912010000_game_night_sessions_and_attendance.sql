-- Game Night — sessies (één volledige spelavond) + wie er die avond bij was.
-- Een sessie bestaat ALTIJD in Supabase vanaf het moment dat de avond
-- start (sectie 3: nooit alleen React-state/localStorage) zodat "Verder met
-- Game Night" na een reload/nieuwe browser altijd werkt (sectie 17).
--
-- game_night_session_players is bewust een APARTE tabel van de kern-
-- attendance in plaats van een array-kolom: hiermee weten we wie de hele
-- avond aanwezig was, los van wie een specifiek spel meespeelt (dat is
-- game_night_game_session_players, zie 20260912030000) — sectie 5/7.

create table public.game_night_sessions (
  id uuid primary key default gen_random_uuid(),
  -- Automatisch gegenereerd na spelerselectie (sectie 4: datum + namen),
  -- later handmatig aanpasbaar — daarom een gewone text-kolom, geen
  -- afgeleide/computed value.
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed')),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Bestaat er een actieve/gepauzeerde Game Night?" is de query die de
-- home-pagina bij elk bezoek uitvoert (sectie 17) — partial index houdt
-- die goedkoop ook als de tabel na jaren vol staat met completed sessies.
create index game_night_sessions_active_idx
  on public.game_night_sessions (started_at desc)
  where status <> 'completed';

create trigger set_game_night_sessions_updated_at
  before update on public.game_night_sessions
  for each row execute function public.set_updated_at();

alter table public.game_night_sessions enable row level security;

create policy "game_night_sessions: owner only" on public.game_night_sessions
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_sessions from anon;

-- ── Aanwezigheid: wie schoof er die avond aan ────────────────────────────
create table public.game_night_session_players (
  session_id uuid not null references public.game_night_sessions(id) on delete cascade,
  -- `restrict` (niet cascade): een speler mag nooit stilletjes uit een
  -- afgeronde Game Night verdwijnen omdat iemand zijn profiel later
  -- probeert te verwijderen — archiveren (archived_at) is de juiste weg,
  -- hard-delete van een speler met historie moet hier al op vastlopen.
  player_id uuid not null references public.game_night_players(id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (session_id, player_id)
);

-- Omgekeerde richting: "aan welke Game Nights deed deze speler mee" (voor
-- latere per-speler statistieken).
create index game_night_session_players_player_idx
  on public.game_night_session_players (player_id);

alter table public.game_night_session_players enable row level security;

create policy "game_night_session_players: owner only" on public.game_night_session_players
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_session_players from anon;
