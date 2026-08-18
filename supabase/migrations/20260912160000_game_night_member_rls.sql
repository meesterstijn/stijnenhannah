-- Game Night V2.3 — RLS voor de nieuwe game_night_member-rol. Losse
-- migratie t.o.v. 20260912150000 (die de rol/RPC's zelf regelt) zodat deze
-- ene, puur declaratieve set beleidsregels op zichzelf te reviewen is —
-- precies het soort bestand waar een RLS fail-closed-review (sectie 25 van
-- de opdracht) op gericht is.
--
-- Patroon, overal identiek: de bestaande "<table>: owner only" FOR ALL-
-- policy blijft ONGEWIJZIGD staan (owner behoudt exact zijn huidige volledige
-- toegang, geen regressierisico). Daarnaast komt precies één NIEUWE, puur
-- lezende policy voor game_night_member — Postgres RLS combineert meerdere
-- permissive policies met OR, dus dit VERBREEDT alleen wie mag LEZEN, en
-- verandert nergens wie mag SCHRIJVEN. Member-schrijftoegang bestaat in
-- V2.3 uitsluitend via de smalle, expliciet gecontroleerde RPC's uit
-- 20260912150000 (game_night_update_my_profile) en de bestaande
-- owner-only WIN-RPC's (game_night_record_win/undo_win_event/
-- complete_win_session blijven letterlijk `if not private.is_owner()`
-- controleren — member-WIN-schrijven vanaf telefoon is expliciet V2.4+
-- scope, sectie 16 van de opdracht).
--
-- Bewuste keuze (sectie 7 van de opdracht): een member mag ALLE Game
-- Night-statistiekdata van alle spelers lezen (Hall of Fame/rivaliteiten/
-- geschiedenis zijn sociale, gedeelde Game Night-data, geen privédata per
-- speler) — maar NIETS ervan schrijven behalve het eigen profiel. Checkpoint-
-- tabellen zijn hier BEWUST NIET opgenomen (sectie 8: checkpointfoto's zijn
-- gevoeliger en blijven in V2.3 volledig owner-only, zowel tabel als storage).

create policy "game_night_games: member select" on public.game_night_games
  for select to authenticated
  using (private.is_game_night_member_or_owner());

create policy "game_night_players: member select" on public.game_night_players
  for select to authenticated
  using (private.is_game_night_member_or_owner());

create policy "game_night_sessions: member select" on public.game_night_sessions
  for select to authenticated
  using (private.is_game_night_member_or_owner());

create policy "game_night_session_players: member select" on public.game_night_session_players
  for select to authenticated
  using (private.is_game_night_member_or_owner());

create policy "game_night_game_sessions: member select" on public.game_night_game_sessions
  for select to authenticated
  using (private.is_game_night_member_or_owner());

create policy "game_night_game_session_players: member select" on public.game_night_game_session_players
  for select to authenticated
  using (private.is_game_night_member_or_owner());

create policy "game_night_rounds: member select" on public.game_night_rounds
  for select to authenticated
  using (private.is_game_night_member_or_owner());

create policy "game_night_round_results: member select" on public.game_night_round_results
  for select to authenticated
  using (private.is_game_night_member_or_owner());

create policy "game_night_game_session_results: member select" on public.game_night_game_session_results
  for select to authenticated
  using (private.is_game_night_member_or_owner());

create policy "game_night_win_events: member select" on public.game_night_win_events
  for select to authenticated
  using (private.is_game_night_member_or_owner());

-- Kleurpalet: member ziet alleen ACTIEVE kleuren (sectie 6) — een
-- gearchiveerde/inactieve kleur is voor de owner nog zichtbaar via de
-- bestaande owner-ALL-policy, maar hoort niet in de keuzelijst van een
-- speler die zijn eigen kleur kiest.
create policy "game_night_color_palette: member select active" on public.game_night_color_palette
  for select to authenticated
  using (private.is_game_night_member_or_owner() and active);
