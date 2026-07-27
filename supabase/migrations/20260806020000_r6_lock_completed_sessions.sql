-- Rainbow Six Siege LAN Companion — fase 2.1, deel 3: database-niveau
-- bescherming van afgeronde sessies. UI-blokkering alleen is onvoldoende
-- (een directe API-call met de anon/authenticated-key zou anders nog steeds
-- een match kunnen toevoegen/wijzigen/verwijderen in een afgeronde LAN) —
-- dit vervangt de brede "Authenticated users can do everything"-policy van
-- 20260805010000_r6_sessions_and_matches.sql door per-actie policies die de
-- sessiestatus controleren. SELECT blijft altijd toegestaan (de historie
-- moet leesbaar blijven); alleen INSERT/UPDATE/DELETE worden aan
-- status = 'live' gebonden.
--
-- r6_sessions zelf blijft bewust op zijn oorspronkelijke brede policy —
-- beëindigen/heropenen is zelf een update op die tabel en moet altijd
-- mogelijk blijven; de trigger uit 20260806010000 bewaakt daar al specifiek
-- dat naam/notities/datum niet stiekem meeveranderen tijdens die update.

-- ── r6_matches ───────────────────────────────────────────────────────────
drop policy if exists "Authenticated users can do everything" on public.r6_matches;

create policy "Authenticated users can read matches" on public.r6_matches
  for select to authenticated using (true);

create policy "Authenticated users can insert matches into live sessions" on public.r6_matches
  for insert to authenticated
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can update matches in live sessions" on public.r6_matches
  for update to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can delete matches in live sessions" on public.r6_matches
  for delete to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- ── r6_match_players ─────────────────────────────────────────────────────
drop policy if exists "Authenticated users can do everything" on public.r6_match_players;

create policy "Authenticated users can read match players" on public.r6_match_players
  for select to authenticated using (true);

create policy "Authenticated users can insert match players into live sessions" on public.r6_match_players
  for insert to authenticated
  with check (
    exists (
      select 1 from public.r6_matches m
      join public.r6_sessions s on s.id = m.session_id
      where m.id = match_id and s.status = 'live'
    )
  );

create policy "Authenticated users can update match players in live sessions" on public.r6_match_players
  for update to authenticated
  using (
    exists (
      select 1 from public.r6_matches m
      join public.r6_sessions s on s.id = m.session_id
      where m.id = match_id and s.status = 'live'
    )
  )
  with check (
    exists (
      select 1 from public.r6_matches m
      join public.r6_sessions s on s.id = m.session_id
      where m.id = match_id and s.status = 'live'
    )
  );

create policy "Authenticated users can delete match players in live sessions" on public.r6_match_players
  for delete to authenticated
  using (
    exists (
      select 1 from public.r6_matches m
      join public.r6_sessions s on s.id = m.session_id
      where m.id = match_id and s.status = 'live'
    )
  );

-- ── r6_session_players ───────────────────────────────────────────────────
drop policy if exists "Authenticated users can do everything" on public.r6_session_players;

create policy "Authenticated users can read session players" on public.r6_session_players
  for select to authenticated using (true);

create policy "Authenticated users can insert session players into live sessions" on public.r6_session_players
  for insert to authenticated
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can delete session players from live sessions" on public.r6_session_players
  for delete to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
