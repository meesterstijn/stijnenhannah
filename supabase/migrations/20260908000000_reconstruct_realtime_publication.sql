-- Reconstructie van Supabase Realtime publication-membership. De eerdere
-- repository-audit stelde vast dat de frontend op 12 tabellen realtime
-- subscribet (7 Cocktail Bar + R6 kanalen — zie useCocktailShowcaseRealtimeSync.ts,
-- useCocktailOrderRealtimeSync.ts, useCocktailBarHighlightWatch.ts,
-- useCocktailBarActiveOrderWatch.ts, useCocktailBarConnectionStatus.ts,
-- useR6SessionRealtimeSync.ts, RainbowSixSiegeBigScreenContent.tsx,
-- useR6ActiveSessionWatch.ts), maar dat geen enkele migratie ooit
-- `ALTER PUBLICATION supabase_realtime ADD TABLE ...` heeft uitgevoerd —
-- deze membership is dus tot nu toe volledig buiten de migratiehistorie om
-- ontstaan (waarschijnlijk via de Supabase Dashboard "Realtime"-toggle).
--
-- Een live read-only audit (pg_publication_tables) heeft bevestigd dat alle
-- 12 tabellen daadwerkelijk lid zijn van `supabase_realtime`. Dit bestand
-- reproduceert exact die membership, zodat een verse database na het
-- doorlopen van alle migrations dezelfde publication-inhoud heeft.
--
-- Alle 12 tabellen bestaan al vóór dit punt in de migratieketen
-- (r6_sessions/r6_matches: 20260805010000, r6_session_chaos_effects:
-- 20260807020000, r6_events: 20260808010000, r6_game_operator_assignments:
-- 20260812000000, cocktails/cocktail_variants/cocktail_flavour_profiles/
-- cocktail_variant_ingredients: 20260818020000, cocktail_orders:
-- 20260819020000, cocktail_highlights/cocktail_bar_state: 20260819030000) —
-- dus geen enkele "relation does not exist"-fout mogelijk.
--
-- Idempotentie: `alter publication ... add table` faalt op Postgres met
-- "relation is already member of publication" als de tabel er al in zit —
-- dus GEEN kaal `alter publication add table` (dat zou op de huidige live
-- database, waar alle 12 al lid zijn, gegarandeerd stuklopen). In plaats
-- daarvan per tabel eerst controleren via pg_publication_tables en alleen
-- toevoegen wanneer nog afwezig. Op live is dit bestand daardoor een
-- volledige no-op; op een verse database voegt elk blok zijn tabel voor het
-- eerst toe.
--
-- GEEN replica identity-wijziging: een live audit bevestigt dat alle 12
-- tabellen op `REPLICA IDENTITY DEFAULT` staan (relreplident = 'd'). De
-- bestaande DELETE-workarounds in useR6SessionRealtimeSync.ts en
-- RainbowSixSiegeBigScreenContent.tsx (ongefilterde DELETE-listeners i.p.v.
-- filteren op een niet-PK-kolom) bestaan precies OMDAT replica identity hier
-- niet FULL is — dat gedrag blijft dus bewust ongewijzigd.
--
-- GEEN RLS/policy-wijziging en GEEN ALTER PUBLICATION ... DROP TABLE: deze
-- migratie garandeert alleen dat de 12 benodigde tabellen lid zijn, en raakt
-- verder niets aan (ook niet als live de publication nog meer tabellen zou
-- bevatten dan deze 12 — die blijven onaangeroerd).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cocktails'
  ) then
    alter publication supabase_realtime add table public.cocktails;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cocktail_variants'
  ) then
    alter publication supabase_realtime add table public.cocktail_variants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cocktail_flavour_profiles'
  ) then
    alter publication supabase_realtime add table public.cocktail_flavour_profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cocktail_variant_ingredients'
  ) then
    alter publication supabase_realtime add table public.cocktail_variant_ingredients;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cocktail_orders'
  ) then
    alter publication supabase_realtime add table public.cocktail_orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cocktail_bar_state'
  ) then
    alter publication supabase_realtime add table public.cocktail_bar_state;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cocktail_highlights'
  ) then
    alter publication supabase_realtime add table public.cocktail_highlights;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'r6_events'
  ) then
    alter publication supabase_realtime add table public.r6_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'r6_matches'
  ) then
    alter publication supabase_realtime add table public.r6_matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'r6_sessions'
  ) then
    alter publication supabase_realtime add table public.r6_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'r6_game_operator_assignments'
  ) then
    alter publication supabase_realtime add table public.r6_game_operator_assignments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'r6_session_chaos_effects'
  ) then
    alter publication supabase_realtime add table public.r6_session_chaos_effects;
  end if;
end
$$;

-- Handmatige controle na het draaien van deze migratie:
--
-- select schemaname, tablename
-- from pg_publication_tables
-- where pubname = 'supabase_realtime'
-- order by schemaname, tablename;
