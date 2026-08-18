-- Site-brede auth-correctie (V2.4-review) — GEEN Game Night-specifieke
-- migratie, maar bewust vóór de drie V2.4-bestanden genummerd omdat de
-- Game Night QR-signup-flow er direct van afhangt. Corrigeert
-- 20260816000000_app_roles_and_profiles.sql (al uitgevoerd, dus hier NIET
-- aangepast — deze migratie herdefinieert alleen de functie/default,
-- schrijft geen bestaande rijen).
--
-- ── Wat er verandert ───────────────────────────────────────────────────
-- Vóór deze migratie: elk nieuw auth.users-account kreeg via
-- handle_new_user() (en de kolomdefault) automatisch app_role='r6_player'
-- — impliciete, "vertrouw-eerst"-toegang. Voor de Game Night V2.4 QR-
-- signup-flow betekende dat een kort maar reëel venster waarin een
-- zojuist aangemaakt account (nog vóór de join/provisioning-RPC draait)
-- technisch echte Rainbow Six-rechten had.
--
-- Ná deze migratie: elk nieuw account krijgt 'no_access' — authenticated
-- betekent niet langer automatisch toegang tot een feature. Toegang wordt
-- vanaf nu ALTIJD expliciet toegekend:
--   - Game Night join-token (game_night_join_via_token) → game_night_member
--   - owneractie (set_profile_role)                     → r6_player
--   - owneractie (set_profile_role)                     → cocktail_guest
--   - owner blijft owner (nooit via deze trigger geraakt)
--
-- ── Gevolgen voor bestaande accounts ───────────────────────────────────
-- GEEN — dit raakt uitsluitend NIEUWE auth.users-rijen vanaf nu. Geen
-- bestaande profielrij wordt hier aangepast/overschreven.
--
-- ── Gevolgen voor de R6-accountprocedure ───────────────────────────────
-- Tot nu toe was er (impliciet, nooit vanuit de frontend aangeroepen)
-- geen enkele stap nodig om een nieuw Supabase-account R6-toegang te
-- geven — het was gewoon al zo. Vanaf nu moet de owner na het aanmaken
-- van een account (Supabase Dashboard → Authentication → Users) er
-- expliciet 'r6_player' aan toekennen via de bestaande set_profile_role-
-- RPC, bv. in de Supabase SQL-editor:
--   select public.set_profile_role('<nieuw-account-uuid>', 'r6_player');
-- Er bestaat geen frontend-UI voor rolbeheer (bevestigd bij inspectie) —
-- deze ene regel SQL is de volledige nieuwe procedure. Zie het
-- opleverrapport voor de exacte instructie.

alter table public.profiles alter column app_role set default 'no_access';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, app_role)
  values (new.id, 'no_access')
  on conflict (id) do nothing;
  return new;
end;
$$;
