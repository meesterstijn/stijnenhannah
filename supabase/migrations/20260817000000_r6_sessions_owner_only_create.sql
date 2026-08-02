-- r6_player mag geen nieuwe LAN meer starten — die bevoegdheid was in
-- 20260816020000 expliciet aan owner + r6_player gegeven ("nieuwe LAN
-- starten" stond met zoveel woorden in de rechtenmatrix), maar dat blijkt
-- ongewenst: alleen owner mag nog een r6_sessions-rij aanmaken.
--
-- create_r6_session (20260805020000) is SECURITY INVOKER en heeft zelf geen
-- rolcheck (zie 20260816030000 — die migratie stelt expliciet dat de
-- r6-RPC's bewust ongewijzigd blijven omdat RLS al afdwingt), dus het
-- vervangen van de INSERT-policy hieronder is voldoende: de RPC loopt
-- vanzelf tegen dezelfde muur als een rechtstreekse insert.
--
-- Lezen, "LAN beëindigen" (status -> completed) en de rest van de
-- rolgebonden rechten uit 20260816020000 blijven ongewijzigd — alleen het
-- AANMAKEN van een sessie wordt owner-only.
drop policy if exists "r6: owner or r6_player creates sessions" on public.r6_sessions;

create policy "r6: owner creates sessions" on public.r6_sessions
  for insert to authenticated with check (private.is_owner());
