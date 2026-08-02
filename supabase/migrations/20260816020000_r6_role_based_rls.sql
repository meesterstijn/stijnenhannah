-- Gebruikersrollen, deel 3: rolgebonden RLS voor alle r6_*-tabellen.
--
-- Vervangt de tot nu toe brede "elke authenticated user"-voorwaarde door
-- `private.is_owner()` / `private.is_r6_or_owner()` (zie 20260816000000).
-- Alle bestaande structurele voorwaarden (live-sessie-gating, cross-sessie-
-- integriteit via de composite foreign keys, etc.) blijven ONGEWIJZIGD — er
-- wordt uitsluitend de rolvoorwaarde aan toegevoegd/vervangen, nooit een
-- bestaande voorwaarde verzwakt of verwijderd.
--
-- Rechtenmatrix (toelichting per tabel hieronder bij de policy zelf):
--  - Referentie/catalogusdata (r6_maps/r6_operators/r6_challenges/
--    r6_chaos_effects/r6_score_rules/r6_achievements): lezen voor owner +
--    r6_player, beheren (insert/update/delete) alleen owner. Deze tabellen
--    worden vandaag sowieso niet vanuit de UI geschreven (op r6_score_rules
--    na, via Actietegels beheren) — dit is dus vooral een bewuste
--    toekomstvaste afsluiting, niet het dichten van een vandaag actief
--    gebruikt gat.
--  - r6_players (huishoud-brede spelerslijst): lezen + aanmaken/upserten
--    voor owner + r6_player (nodig voor "nieuwe LAN starten" en "speler
--    toevoegen" — beide expliciet toegestaan voor r6_player), verwijderen
--    alleen owner (geen enkel UI-pad verwijdert een r6_players-rij vandaag;
--    puur defensief).
--  - r6_sessions: lezen voor owner + r6_player. Aanmaken (nieuwe LAN) en
--    naar 'completed' zetten (LAN beëindigen) voor owner + r6_player. Van
--    'completed' terug naar 'live' zetten (LAN heropenen) uitsluitend owner
--    — zie de policy zelf voor hoe dat met één UPDATE-policy wordt
--    afgedwongen (USING kijkt naar de oude rij, WITH CHECK naar de nieuwe).
--  - r6_session_players: lezen + toevoegen voor owner + r6_player,
--    verwijderen (speler uit sessie) uitsluitend owner ("spelers definitief
--    verwijderen: owner-only", expliciete voorkeur uit de opdracht).
--  - r6_matches / r6_match_players: lezen voor owner + r6_player. Aanmaken
--    en bijwerken (incl. "Gimma afronden" + MVP, en — architecturaal
--    onvermijdelijk, zie opleverrapport — ook het corrigeren van een oudere
--    Gimma via het klassieke formulier, want beide lopen via dezelfde
--    update_r6_match-RPC) voor owner + r6_player. Verwijderen ("game
--    verwijderen") uitsluitend owner.
--  - r6_events: lezen/aanmaken/verwijderen (tikken + ongedaan maken) voor
--    owner + r6_player — expliciet toegestaan.
--  - r6_game_operator_assignments, r6_session_chaos_effects, r6_session_media:
--    volledig owner + r6_player (Operator Wheel, Chaos Wheel, LAN-foto's
--    zijn alle drie expliciet toegestaan), binnen de bestaande live-sessie-
--    gating.
--  - r6_session_challenges: nog door geen enkel UI-pad gebruikt (zie
--    scoring/types-comments in de broncode) — lezen voor owner + r6_player,
--    schrijven bewust owner-only als veilige default voor een nog niet
--    gebouwde functionaliteit, i.p.v. te gokken naar toekomstig gedrag.
--  - r6_player_achievements: idem, nog ongebruikt — zelfde conservatieve
--    keuze.
do $$
declare
  v_table text;
  v_policy record;
  v_r6_tables text[] := array[
    'r6_players', 'r6_maps', 'r6_operators', 'r6_challenges',
    'r6_score_rules', 'r6_achievements', 'r6_player_achievements',
    'r6_chaos_effects', 'r6_session_challenges',
    'r6_sessions', 'r6_session_players', 'r6_matches', 'r6_match_players',
    'r6_events', 'r6_game_operator_assignments', 'r6_session_chaos_effects',
    'r6_session_media'
  ];
begin
  foreach v_table in array v_r6_tables loop
    if to_regclass('public.' || v_table) is null then
      raise notice 'Tabel public.% bestaat niet — overgeslagen.', v_table;
      continue;
    end if;
    for v_policy in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy %I on public.%I', v_policy.policyname, v_table);
    end loop;
    execute format('revoke all on public.%I from anon', v_table);
  end loop;
end $$;

-- ── r6_players ───────────────────────────────────────────────────────────
create policy "r6: read players" on public.r6_players
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner or r6_player can add players" on public.r6_players
  for insert to authenticated with check (private.is_r6_or_owner());
create policy "r6: owner or r6_player can update players" on public.r6_players
  for update to authenticated using (private.is_r6_or_owner()) with check (private.is_r6_or_owner());
create policy "r6: owner deletes players" on public.r6_players
  for delete to authenticated using (private.is_owner());

-- ── r6_maps / r6_operators / r6_challenges / r6_chaos_effects (catalogus) ─
create policy "r6: read maps" on public.r6_maps
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner manages maps" on public.r6_maps
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

create policy "r6: read operators" on public.r6_operators
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner manages operators" on public.r6_operators
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

create policy "r6: read challenges" on public.r6_challenges
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner manages challenges" on public.r6_challenges
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

create policy "r6: read chaos effects catalog" on public.r6_chaos_effects
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner manages chaos effects catalog" on public.r6_chaos_effects
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

-- ── r6_score_rules ───────────────────────────────────────────────────────
create policy "r6: read score rules" on public.r6_score_rules
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner manages score rules" on public.r6_score_rules
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

-- ── r6_achievements / r6_player_achievements (nog ongebruikt) ───────────
create policy "r6: read achievements catalog" on public.r6_achievements
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner manages achievements catalog" on public.r6_achievements
  for all to authenticated using (private.is_owner()) with check (private.is_owner());

create policy "r6: read player achievements" on public.r6_player_achievements
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner manages player achievements" on public.r6_player_achievements
  for insert to authenticated with check (private.is_owner());
create policy "r6: owner updates player achievements" on public.r6_player_achievements
  for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy "r6: owner deletes player achievements" on public.r6_player_achievements
  for delete to authenticated using (private.is_owner());

-- ── r6_session_challenges (nog ongebruikt door de UI) ───────────────────
create policy "r6: read session challenges" on public.r6_session_challenges
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner inserts session challenges" on public.r6_session_challenges
  for insert to authenticated
  with check (
    private.is_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
create policy "r6: owner updates session challenges" on public.r6_session_challenges
  for update to authenticated
  using (
    private.is_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    private.is_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
create policy "r6: owner deletes session challenges" on public.r6_session_challenges
  for delete to authenticated
  using (
    private.is_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- ── r6_sessions ──────────────────────────────────────────────────────────
create policy "r6: read sessions" on public.r6_sessions
  for select to authenticated using (private.is_r6_or_owner());

create policy "r6: owner or r6_player creates sessions" on public.r6_sessions
  for insert to authenticated with check (private.is_r6_or_owner());

-- UPDATE dekt zowel "LAN-instellingen opslaan" (naam/datum/notities, terwijl
-- status ongewijzigd blijft) als de twee statusovergangen. USING kijkt naar
-- de HUIDIGE (oude) rij, WITH CHECK naar de NIEUWE — dat is precies wat
-- nodig is om richting af te dwingen: een r6_player mag een update alleen
-- STARTEN op een rij die nu al 'live' is (USING), en het resultaat mag
-- 'live' (ongewijzigd, bv. hernoemen) of 'completed' (LAN beëindigen) zijn
-- (WITH CHECK) — nooit 'completed' -> 'live' (heropenen), want daarvoor is
-- de oude rij ('completed') al niet zichtbaar voor een r6_player via USING.
-- Owner is in beide clausules altijd onvoorwaardelijk toegestaan.
create policy "r6: update sessions" on public.r6_sessions
  for update to authenticated
  using (
    private.is_owner()
    or (private.is_r6_or_owner() and status = 'live')
  )
  with check (
    private.is_owner()
    or (private.is_r6_or_owner() and status in ('live', 'completed'))
  );

create policy "r6: owner deletes sessions" on public.r6_sessions
  for delete to authenticated using (private.is_owner());

-- ── r6_session_players ───────────────────────────────────────────────────
create policy "r6: read session players" on public.r6_session_players
  for select to authenticated using (private.is_r6_or_owner());

create policy "r6: owner or r6_player adds session players" on public.r6_session_players
  for insert to authenticated
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- "Spelers definitief verwijderen" — expliciete voorkeur: owner-only.
create policy "r6: owner removes session players" on public.r6_session_players
  for delete to authenticated
  using (
    private.is_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- ── r6_matches ───────────────────────────────────────────────────────────
create policy "r6: read matches" on public.r6_matches
  for select to authenticated using (private.is_r6_or_owner());

create policy "r6: owner or r6_player inserts matches" on public.r6_matches
  for insert to authenticated
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- Dekt zowel "Gimma afronden" (+ MVP) als het klassieke correctieformulier
-- voor een oudere Gimma — beide lopen via dezelfde update_r6_match-RPC, een
-- striktere scheiding zou een aparte RPC vereisen (zie opleverrapport).
create policy "r6: owner or r6_player updates matches" on public.r6_matches
  for update to authenticated
  using (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- "Game verwijderen" — expliciete voorkeur: owner-only.
create policy "r6: owner deletes matches" on public.r6_matches
  for delete to authenticated
  using (
    private.is_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- ── r6_match_players ─────────────────────────────────────────────────────
-- Zelfde rolgrens als r6_matches hierboven — deze rijen worden alleen
-- geschreven als onderdeel van dezelfde create_r6_match/update_r6_match-RPC-
-- transactie, nooit los.
create policy "r6: read match players" on public.r6_match_players
  for select to authenticated using (private.is_r6_or_owner());

create policy "r6: owner or r6_player inserts match players" on public.r6_match_players
  for insert to authenticated
  with check (
    private.is_r6_or_owner()
    and exists (
      select 1 from public.r6_matches m join public.r6_sessions s on s.id = m.session_id
      where m.id = match_id and s.status = 'live'
    )
  );

create policy "r6: owner or r6_player updates match players" on public.r6_match_players
  for update to authenticated
  using (
    private.is_r6_or_owner()
    and exists (
      select 1 from public.r6_matches m join public.r6_sessions s on s.id = m.session_id
      where m.id = match_id and s.status = 'live'
    )
  )
  with check (
    private.is_r6_or_owner()
    and exists (
      select 1 from public.r6_matches m join public.r6_sessions s on s.id = m.session_id
      where m.id = match_id and s.status = 'live'
    )
  );

create policy "r6: owner or r6_player deletes match players" on public.r6_match_players
  for delete to authenticated
  using (
    private.is_r6_or_owner()
    and exists (
      select 1 from public.r6_matches m join public.r6_sessions s on s.id = m.session_id
      where m.id = match_id and s.status = 'live'
    )
  );

-- ── r6_events ────────────────────────────────────────────────────────────
-- Tikken + "laatste actie ongedaan maken" — beide expliciet toegestaan.
create policy "r6: read events" on public.r6_events
  for select to authenticated using (private.is_r6_or_owner());

create policy "r6: owner or r6_player records events" on public.r6_events
  for insert to authenticated
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "r6: owner or r6_player undoes events" on public.r6_events
  for delete to authenticated
  using (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- ── r6_game_operator_assignments (Operator Wheel) ───────────────────────
create policy "r6: read operator assignments" on public.r6_game_operator_assignments
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner or r6_player inserts operator assignments" on public.r6_game_operator_assignments
  for insert to authenticated
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
create policy "r6: owner or r6_player updates operator assignments" on public.r6_game_operator_assignments
  for update to authenticated
  using (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
create policy "r6: owner or r6_player deletes operator assignments" on public.r6_game_operator_assignments
  for delete to authenticated
  using (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- ── r6_session_chaos_effects (Chaos Wheel) ──────────────────────────────
create policy "r6: read session chaos effects" on public.r6_session_chaos_effects
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner or r6_player inserts session chaos effects" on public.r6_session_chaos_effects
  for insert to authenticated
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
create policy "r6: owner or r6_player updates session chaos effects" on public.r6_session_chaos_effects
  for update to authenticated
  using (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
create policy "r6: owner or r6_player deletes session chaos effects" on public.r6_session_chaos_effects
  for delete to authenticated
  using (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- ── r6_session_media (LAN-foto's) ───────────────────────────────────────
create policy "r6: read session media" on public.r6_session_media
  for select to authenticated using (private.is_r6_or_owner());
create policy "r6: owner or r6_player inserts session media" on public.r6_session_media
  for insert to authenticated
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
create policy "r6: owner or r6_player updates session media" on public.r6_session_media
  for update to authenticated
  using (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
create policy "r6: owner or r6_player deletes session media" on public.r6_session_media
  for delete to authenticated
  using (
    private.is_r6_or_owner()
    and exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
