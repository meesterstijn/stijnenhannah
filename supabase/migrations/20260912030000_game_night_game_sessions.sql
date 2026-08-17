-- Game Night — spelsessies: "tijdens deze Game Night spelen we nu één
-- specifiek spel" (sectie 6). Bewust een aparte laag tussen de avond
-- (game_night_sessions) en losse rondes/resultaten, zodat één Game Night
-- meerdere spellen na elkaar kan bevatten en elk spel zijn eigen
-- start/pauze/einde en deelnemerslijst heeft.

create table public.game_night_game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_night_session_id uuid not null references public.game_night_sessions(id) on delete cascade,
  -- `restrict`: een spel met gespeelde geschiedenis mag nooit stilletjes
  -- verdwijnen omdat het uit de actieve Spellenkast gehaald wordt —
  -- archiveren (game_night_games.archived_at, 20260912020000) is de juiste
  -- weg (sectie 27).
  game_id uuid not null references public.game_night_games(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed')),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Alle spelsessies van deze Game Night" (bv. bij hervatten/overzicht).
create index game_night_game_sessions_session_idx
  on public.game_night_game_sessions (game_night_session_id);

-- "Alle keren dat dit specifieke spel gespeeld is" (per-spel statistieken).
create index game_night_game_sessions_game_idx
  on public.game_night_game_sessions (game_id);

-- "Is er nu een actieve/gepauzeerde spelsessie binnen deze Game Night?"
create index game_night_game_sessions_active_idx
  on public.game_night_game_sessions (game_night_session_id)
  where status <> 'completed';

create trigger set_game_night_game_sessions_updated_at
  before update on public.game_night_game_sessions
  for each row execute function public.set_updated_at();

alter table public.game_night_game_sessions enable row level security;

create policy "game_night_game_sessions: owner only" on public.game_night_game_sessions
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_game_sessions from anon;

-- ── Deelnemers per spelsessie ─────────────────────────────────────────────
-- Los van game_night_session_players (sectie 7): iemand kan de hele avond
-- aanwezig zijn zonder elk spel mee te spelen.
create table public.game_night_game_session_players (
  game_session_id uuid not null references public.game_night_game_sessions(id) on delete cascade,
  player_id uuid not null references public.game_night_players(id) on delete restrict,
  -- Nog geen teams-tabel in deze fase — gereserveerd voor een latere
  -- teamsfunctie (sectie 7 vraagt alleen "eventueel team_id nullable").
  -- Bewust geen FK zolang er geen teams-tabel bestaat.
  team_id uuid,
  seat_order integer,
  created_at timestamptz not null default now(),
  primary key (game_session_id, player_id)
);

create index game_night_game_session_players_player_idx
  on public.game_night_game_session_players (player_id);

alter table public.game_night_game_session_players enable row level security;

create policy "game_night_game_session_players: owner only" on public.game_night_game_session_players
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_game_session_players from anon;
