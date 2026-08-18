-- Game Night V2.1 — fundament voor het universele WIN-model (opdracht
-- "FASE V2.1: FUNDAMENT VOOR HET UNIVERSELE WIN-MODEL"). Additief op de
-- veertien bestaande Game Night-migraties. Verandert GEEN bestaand gedrag:
-- er wordt in deze fase nog niets geschreven naar de nieuwe tabel, en het
-- bestaande start-RPC (20260912070000) blijft ongewijzigd — de nieuwe
-- kolom hieronder krijgt zijn waarde uitsluitend via de kolomdefault.
--
-- ── Waarom een nieuwe tabel i.p.v. round_results hergebruiken ────────────
-- Doel van V2: "speler aantikken = één WIN" moet werken voor elk spel,
-- ongeacht of dat spel ooit een rondestructuur had. Rondes/round_results
-- (20260912040000) blijven historisch exact zoals ze zijn — bestaande
-- Skull-avonden, Hall of Fame, rivaliteiten en Skullcrusher blijven daarop
-- leunen. game_night_win_events is een NIEUWE, aparte laag voor toekomstige
-- spelsessies: één rij = één positieve gebeurtenis ("speler X kreeg op
-- tijdstip Y één WIN"), geen totaalstand, geen rondeadministratie. Tellingen
-- worden altijd afgeleid via `undone_at is null` — undo is een soft-delete,
-- nooit een hard delete (historische win-events mogen niet verdwijnen).

create table public.game_night_win_events (
  id uuid primary key default gen_random_uuid(),
  -- `restrict` past hier niet (game_sessions worden nooit verwijderd door
  -- app-logica) — `cascade` volgt dezelfde FK-vorm als
  -- game_night_rounds.game_session_id (20260912040000): als een spelsessie
  -- ooit toch verwijderd zou worden, horen haar win-events niet als wees
  -- achter te blijven.
  game_session_id uuid not null references public.game_night_game_sessions(id) on delete cascade,
  -- Zelfde vorm als game_night_round_results.player_id (`restrict`): een
  -- speler met win-events mag nooit hard verwijderd worden — alleen
  -- archiveren (game_night_players.archived_at) is toegestaan zolang er
  -- historie aan hangt.
  player_id uuid not null references public.game_night_players(id) on delete restrict,
  created_at timestamptz not null default now(),
  -- Soft-delete voor undo. NULL = actief/telt mee. Niet-NULL = ongedaan
  -- gemaakt, blijft staan voor audit maar telt nergens meer mee.
  undone_at timestamptz
);

comment on table public.game_night_win_events is
  'Eén rij = één WIN-gebeurtenis voor één speler binnen één spelsessie (Game Night V2). Geen totaalstand, geen rondeadministratie — tellingen worden afgeleid via "undone_at is null". Wordt in V2.1 nog door niets geschreven; V2.2 introduceert de RPC''s die deze tabel vullen.';
comment on column public.game_night_win_events.undone_at is
  'Soft-delete voor undo. NULL = actief, telt mee in elke telling. Niet-NULL = ongedaan gemaakt — de rij blijft staan (audit-trail), maar wordt overal uitgesloten via "undone_at is null". Nooit hard verwijderen.';

-- "Alle win-events van deze spelsessie" (incl. ongedaan gemaakte, bv. voor
-- een volledig audit-overzicht) — los van de partial index hieronder, die
-- alleen de actieve subset dekt.
create index game_night_win_events_game_session_idx
  on public.game_night_win_events (game_session_id);

-- "Alle win-events van deze speler" (cross-sessie/cross-avond statistieken).
create index game_night_win_events_player_idx
  on public.game_night_win_events (player_id);

-- De eigenlijke bedieningsquery: actieve (niet-ongedaan-gemaakte) events van
-- één spelsessie, chronologisch — precies wat de action-feed en elke
-- generieke-win-telling nodig hebben. Partial + reeds op created_at desc
-- gesorteerd, dus geen extra sort nodig voor "laatste 5".
create index game_night_win_events_active_feed_idx
  on public.game_night_win_events (game_session_id, created_at desc)
  where undone_at is null;

alter table public.game_night_win_events enable row level security;

-- Exact hetzelfde effectieve beveiligingspatroon als elke andere Game
-- Night-tabel (private.is_owner(), zie o.a. 20260911000000). Game Night
-- blijft in V2.1 volledig owner-only — geen game_night_member-rol, geen
-- versoepeling.
create policy "game_night_win_events: owner only" on public.game_night_win_events
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

revoke all on public.game_night_win_events from anon;

-- ── Expliciete resultaatbron-snapshot op de spelsessie ────────────────────
-- Zonder dit veld zou analytics moeten RADEN of een spelsessie legacy-rondes
-- of nieuwe win-events gebruikt (bv. "als er win_events bestaan is het wel
-- V2") — een impliciete aanname die bij lege/corrupte tussenstanden fout
-- kan gaan. `win_source` maakt die keuze een expliciet, bevroren onderdeel
-- van dezelfde configuratiesnapshot als uses_rounds/track_round_results/
-- has_session_winner/result_mode (20260912070000): één keer gezet bij het
-- starten van de spelsessie, daarna nooit meer gewijzigd.
--
-- Naamgeving: "win_source" (niet "interaction_mode" of "result_source")
-- gekozen omdat het exact één ding beschrijft — welke tabel de WinRecords
-- van déze spelsessie levert — zonder te overlappen met de betekenis van
-- het bestaande `result_mode` (dat gaat over HOE een resultaat eruitziet:
-- winner/score/ranking/team/coop, niet over WAAR de winst vandaan komt).
--
-- Default 'legacy' dekt twee dingen tegelijk zonder het start-RPC aan te
-- raken: (1) alle bestaande spelsessies interpreteren zichzelf automatisch
-- als 'legacy' zodra deze kolom bestaat, en (2) elke NIEUWE spelsessie die
-- via het huidige, ongewijzigde game_night_start_game_session ontstaat,
-- krijgt ook automatisch 'legacy' — precies de eis dat V2.1 het start-RPC
-- nog niet naar win_events omzet. V2.2 zal die RPC (of een nieuwe variant
-- ervan) expliciet 'win_events' laten meegeven voor nieuwe WIN-sessies.
alter table public.game_night_game_sessions
  add column if not exists win_source text not null default 'legacy';

alter table public.game_night_game_sessions
  add constraint game_night_game_sessions_win_source_check
  check (win_source in ('legacy', 'win_events'));

comment on column public.game_night_game_sessions.win_source is
  'Snapshot: welke tabel de WinRecords van DEZE spelsessie levert. ''legacy'' = game_night_rounds/game_night_round_results (alle bestaande en, tot V2.2 het start-RPC aanpast, ook alle nieuwe spelsessies). ''win_events'' = game_night_win_events met undone_at is null. Nooit beide tegelijk voor dezelfde sessie — normalizeWinRecords() in gameNightStats.ts gebruikt uitsluitend dit veld om de bron te kiezen, wat dubbeltelling structureel onmogelijk maakt, ook bij corrupte/gemengde data.';
