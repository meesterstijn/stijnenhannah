-- Game Night — rondes en resultaten (sectie 9-12). Kernregel (sectie 12):
-- een overwinning mag NOOIT alleen aan player_id hangen — hij moet altijd
-- herleidbaar zijn via ronde/resultaat → spelsessie → spel → Game Night.
-- Dat is hier structureel geborgd doordat elke resultaatrij verplicht naar
-- een round_id of game_session_id verwijst, die op hun beurt weer naar
-- game_id / game_night_session_id verwijzen — nooit een losse
-- player_id + "won" zonder die keten.

create table public.game_night_rounds (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_night_game_sessions(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  -- Impliceert meteen de index "rondes per spelsessie, op volgorde".
  unique (game_session_id, round_number)
);

alter table public.game_night_rounds enable row level security;

create policy "game_night_rounds: owner only" on public.game_night_rounds
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_rounds from anon;

-- ── Resultaat per ronde (bv. elke Skull-ronde) ───────────────────────────
-- Flexibel genoeg voor één winnaar, meerdere winnaars (gelijkspel: gewoon
-- meerdere rijen met is_winner = true), punten, ranking en teams — de UI
-- bepaalt per result_mode (game_night_games.result_mode) welke kolommen
-- ze gebruikt, het model dwingt geen enkele modus af.
create table public.game_night_round_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_night_rounds(id) on delete cascade,
  player_id uuid not null references public.game_night_players(id) on delete restrict,
  team_id uuid,
  is_winner boolean not null default false,
  score integer,
  rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, player_id)
);

-- "Alle ronde-resultaten van deze speler" (cross-ronde statistieken, bv.
-- "hoeveel Skull-rondes heeft Hannah gewonnen").
create index game_night_round_results_player_idx
  on public.game_night_round_results (player_id);

create trigger set_game_night_round_results_updated_at
  before update on public.game_night_round_results
  for each row execute function public.set_updated_at();

alter table public.game_night_round_results enable row level security;

create policy "game_night_round_results: owner only" on public.game_night_round_results
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_round_results from anon;

-- ── Eindresultaat van een hele spelsessie ────────────────────────────────
-- Bewust LOS van ronde-resultaten (sectie 11): een Skull-avond heeft
-- meerdere ronde-winnaars (game_night_round_results) ÉN eventueel één
-- sessiewinnaar (hier) — dit maakt "meeste Skull-rondes gewonnen" en
-- "meeste Skull-sessies gewonnen" onafhankelijk beantwoordbare vragen.
create table public.game_night_game_session_results (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_night_game_sessions(id) on delete cascade,
  player_id uuid not null references public.game_night_players(id) on delete restrict,
  team_id uuid,
  is_winner boolean not null default false,
  score integer,
  rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_session_id, player_id)
);

create index game_night_game_session_results_player_idx
  on public.game_night_game_session_results (player_id);

create trigger set_game_night_game_session_results_updated_at
  before update on public.game_night_game_session_results
  for each row execute function public.set_updated_at();

alter table public.game_night_game_session_results enable row level security;

create policy "game_night_game_session_results: owner only" on public.game_night_game_session_results
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_game_session_results from anon;
