-- Game Night — live character-updates (body/face) tussen geopende clients.
-- Voegt `game_night_players` en `game_night_player_character_equipment` toe
-- aan de BESTAANDE `supabase_realtime`-publication (dezelfde publication die
-- Cocktail Bar/R6/game_night_session_players al gebruiken — GEEN nieuwe,
-- tweede publication).
--
-- Root cause/inspectie: geen enkele eerdere migratie heeft deze twee tabellen
-- ooit aan `supabase_realtime` toegevoegd. De expliciete audit-reconstructie
-- in 20260908000000_reconstruct_realtime_publication.sql somt alle 12 tabellen
-- op die op dat moment live lid waren van de publication (7 Cocktail Bar + 5
-- R6) — game_night_players/game_night_player_character_equipment staan daar
-- NIET tussen. De enige Game Night-tabel die wél al eerder is toegevoegd is
-- `game_night_session_players`, via 20260912170000_game_night_party_model.sql
-- (voor usePartyRealtimeSync/de lobby-tafel) — dat bestand blijft ongewijzigd,
-- dit is een nieuw, apart, additief bestand voor de twee tabellen die nu voor
-- live character/face-synchronisatie nodig zijn (zie
-- useGameNightRealtimeSync.ts).
--
-- Idempotentie: exact hetzelfde patroon als beide bovengenoemde migraties —
-- `alter publication ... add table` faalt op Postgres met "relation is
-- already member of publication" als de tabel er al in zit, dus eerst via
-- pg_publication_tables controleren en alleen toevoegen wanneer nog afwezig.
-- Veilig herhaalbaar; op een database waar dit al (bv. handmatig via het
-- Dashboard) is toegevoegd is dit bestand een volledige no-op.
--
-- GEEN replica identity-wijziging, GEEN RLS/policy-wijziging, GEEN
-- ALTER PUBLICATION ... DROP TABLE — raakt verder niets aan de publication.
-- Beide tabellen bestaan al ruim vóór dit punt in de migratieketen
-- (game_night_players: 20260912000000; game_night_player_character_equipment:
-- 20260914010000), dus geen "relation does not exist"-risico.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_night_players'
  ) then
    alter publication supabase_realtime add table public.game_night_players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_night_player_character_equipment'
  ) then
    alter publication supabase_realtime add table public.game_night_player_character_equipment;
  end if;
end
$$;

-- Handmatige controle na het draaien van deze migratie:
--
-- select schemaname, tablename
-- from pg_publication_tables
-- where pubname = 'supabase_realtime'
--   and tablename in ('game_night_players', 'game_night_player_character_equipment');
-- -- verwacht: beide rijen aanwezig
