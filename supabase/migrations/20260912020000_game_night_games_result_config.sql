-- Game Night — resultaatconfiguratie per spel, additief op de bestaande
-- game_night_games (20260911000000). Puur nieuwe kolommen met defaults,
-- geen bestaande kolom/rij wijzigt van betekenis (sectie 29: breekt de
-- bestaande tabel niet).
--
-- Dit is de kern van sectie 8: het gedrag van een spelsessie (heeft het
-- rondes? volgt het rondes? heeft het één sessiewinnaar? hoe ziet een
-- resultaat eruit?) komt uit deze rijen, niet uit hardcoded spelnaam-
-- checks in React. Catan (lange sessie, wel een sessiewinnaar, geen losse
-- rondes) en Skull (veel korte rondes, resultaat per ronde) hebben dus
-- gewoon verschillende waarden in dezelfde kolommen.

alter table public.game_night_games
  add column if not exists uses_rounds boolean not null default false,
  add column if not exists track_round_results boolean not null default false,
  add column if not exists has_session_winner boolean not null default true,
  add column if not exists result_mode text not null default 'winner',
  -- Zelfde soft-delete-vorm als game_night_players.archived_at (sectie 27):
  -- een spel dat ooit gespeeld is (game_night_game_sessions.game_id
  -- verwijst ernaar met `on delete restrict`, zie 20260912030000) mag nooit
  -- hard verwijderd worden zolang die historie bestaat. Archiveren
  -- verbergt het spel uit de actieve Spellenkast zonder resultaten te
  -- verliezen.
  add column if not exists archived_at timestamptz;

alter table public.game_night_games
  add constraint game_night_games_result_mode_check
  check (result_mode in ('winner', 'score', 'ranking', 'team', 'coop'));

comment on column public.game_night_games.uses_rounds is
  'True als een spelsessie uit meerdere afzonderlijke rondes bestaat (bv. Skull). False voor spellen met één doorlopende sessie (bv. Catan).';
comment on column public.game_night_games.track_round_results is
  'True als losse ronde-resultaten worden bijgehouden (game_night_round_results), niet alleen het sessie-eindresultaat.';
comment on column public.game_night_games.has_session_winner is
  'True als de hele spelsessie (niet per se elke ronde) een winnaar/resultaat heeft, opgeslagen in game_night_game_session_results.';
comment on column public.game_night_games.result_mode is
  'Hoe een resultaat voor dit spel eruitziet: winner (aftikken wie won), score (punten), ranking (volgorde), team (teamresultaat) of coop (iedereen wint/verliest samen).';

create index game_night_games_active_idx
  on public.game_night_games (name)
  where archived_at is null;
