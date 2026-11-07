-- Oude, te ruime policies sluiten (gevonden bij het toevoegen van de rol
-- training_user, 7 nov 2026).
--
-- Deze policies stammen uit de tijd vóór de rollen en zijn nooit opgeruimd.
-- Ze gaven ELK ingelogd account (ook r6_player, cocktail_guest,
-- game_night_member en zelfs no_access) lees- en schrijfrecht, en
-- product_history_upfront zelfs aan niet-ingelogde bezoekers (rol public,
-- dus ook anon met de publieke sleutel). De pagina-bewaker in de app hield
-- andere rollen weg van de schermen, maar niet van de API.
--
-- Na deze migratie:
--   * kalender, taken, boodschappen, BBQ en producthistorie: alleen owner;
--   * profiles: alleen nog de bestaande policies "Owner reads all profiles"
--     (owner alles, iedereen het eigen profiel) en "Users update own display
--     name" (kolomrechten staan alleen display_name/updated_at toe).
--
-- Gevolgen: owners merken niets. Andere rollen gebruikten deze tabellen
-- nergens in de app (gecontroleerd in src/ en supabase/functions/).

begin;

drop policy if exists "calendar family access" on public.calendar_events;
create policy "calendar: owner" on public.calendar_events
  for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

drop policy if exists "tasks family access" on public.tasks;
create policy "tasks: owner" on public.tasks
  for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

drop policy if exists "shopping family access" on public.shopping_items;
create policy "shopping: owner" on public.shopping_items
  for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

drop policy if exists "bbq family access" on public.bbq_bookings;
create policy "bbq: owner" on public.bbq_bookings
  for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

drop policy if exists "allow_authenticated" on public.product_history;
create policy "product_history: owner" on public.product_history
  for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

drop policy if exists "Allow all" on public.product_history_upfront;
create policy "product_history_upfront: owner" on public.product_history_upfront
  for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- Overblijfselen naast de policies uit 20260816000000_app_roles_and_profiles.sql.
drop policy if exists "profiles viewable by authenticated" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;

commit;
