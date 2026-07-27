-- Rainbow Six Siege LAN Companion — fase 2.2, deel 7: RLS voor de nieuwe
-- sessie-gebonden tabellen uit deze fase, zelfde live-only-schrijven-patroon
-- als 20260806020000_r6_lock_completed_sessions.sql. SELECT blijft altijd
-- open (galerij/challenges/chaos-effecten van afgeronde LAN's moeten
-- leesbaar blijven); alleen INSERT/UPDATE/DELETE zijn aan
-- status = 'live' gebonden — "bij een afgesloten sessie is de galerij
-- alleen-lezen totdat de LAN wordt heropend" geldt zo ook meteen voor
-- challenges/chaos-effecten, consistent met de rest van de architectuur.

-- ── r6_session_media ─────────────────────────────────────────────────────
create policy "Authenticated users can read session media" on public.r6_session_media
  for select to authenticated using (true);

create policy "Authenticated users can insert session media into live sessions" on public.r6_session_media
  for insert to authenticated
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can update session media in live sessions" on public.r6_session_media
  for update to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can delete session media from live sessions" on public.r6_session_media
  for delete to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- ── r6_session_challenges ────────────────────────────────────────────────
create policy "Authenticated users can read session challenges" on public.r6_session_challenges
  for select to authenticated using (true);

create policy "Authenticated users can insert session challenges into live sessions" on public.r6_session_challenges
  for insert to authenticated
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can update session challenges in live sessions" on public.r6_session_challenges
  for update to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can delete session challenges from live sessions" on public.r6_session_challenges
  for delete to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

-- ── r6_session_chaos_effects ─────────────────────────────────────────────
create policy "Authenticated users can read session chaos effects" on public.r6_session_chaos_effects
  for select to authenticated using (true);

create policy "Authenticated users can insert session chaos effects into live sessions" on public.r6_session_chaos_effects
  for insert to authenticated
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can update session chaos effects in live sessions" on public.r6_session_chaos_effects
  for update to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  )
  with check (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );

create policy "Authenticated users can delete session chaos effects from live sessions" on public.r6_session_chaos_effects
  for delete to authenticated
  using (
    exists (select 1 from public.r6_sessions s where s.id = session_id and s.status = 'live')
  );
