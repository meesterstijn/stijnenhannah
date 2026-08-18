-- Game Night V4 — "Kies voor ons" + Game Roulette.
--
-- Geen schema-wijziging: min_players, max_players, duration_minutes,
-- difficulty en tags bestonden al op game_night_games (zie
-- 20260911000000_game_night_games.sql / 20260912020000_..._result_config.sql)
-- en zijn afdoende voor de nieuwe spelkeuze-modi. Er wordt dus GEEN kolom
-- toegevoegd.
--
-- Wat wél nodig is: tags staan momenteel als vrije, hoofdlettergevoelige
-- tekst in de seed-data (bv. "Handelen", "Bouwen", "Verraad") — niet
-- bruikbaar voor betrouwbare "waar hebben we zin in"-matching. Deze
-- migratie hermapt de tags van de 19 bestaande seed-spellen naar een
-- gecontroleerde set slugs (zie src/features/game-night/lib/gameTags.ts):
-- tactisch, strategie, party, lachen, bluffen, sociaal,
-- elkaar-dwarszitten, relaxed, snel, samenwerken, kaartspel, geluk, puzzel.
--
-- Dit raakt uitsluitend beschrijvende metadata op game_night_games zelf —
-- geen game_night_game_sessions/rounds/results/checkpoints-rijen worden
-- aangeraakt. Spellen die niet in deze lijst voorkomen (handmatig
-- toegevoegd na de seed) behouden hun huidige tags ongewijzigd.

update public.game_night_games set tags = array['strategie', 'tactisch']
  where id = '9a000000-0000-4000-8000-000000000001'; -- Catan
update public.game_night_games set tags = array['party', 'geluk', 'lachen']
  where id = '9a000000-0000-4000-8000-000000000002'; -- Hitster
update public.game_night_games set tags = array['bluffen', 'sociaal', 'elkaar-dwarszitten']
  where id = '9a000000-0000-4000-8000-000000000003'; -- Secret Hitler
update public.game_night_games set tags = array['kaartspel', 'relaxed']
  where id = '9a000000-0000-4000-8000-000000000004'; -- Kaartspel (standaard)
update public.game_night_games set tags = array['strategie', 'tactisch']
  where id = '9a000000-0000-4000-8000-000000000005'; -- Sequence
update public.game_night_games set tags = array['strategie', 'tactisch', 'kaartspel']
  where id = '9a000000-0000-4000-8000-000000000006'; -- Catan kaartspel
update public.game_night_games set tags = array['strategie', 'tactisch', 'relaxed']
  where id = '9a000000-0000-4000-8000-000000000007'; -- Carcassonne
update public.game_night_games set tags = array['samenwerken', 'party', 'lachen']
  where id = '9a000000-0000-4000-8000-000000000008'; -- Just One
update public.game_night_games set tags = array['strategie', 'kaartspel', 'tactisch']
  where id = '9a000000-0000-4000-8000-000000000009'; -- Lost Cities
update public.game_night_games set tags = array['snel', 'party', 'lachen']
  where id = '9a000000-0000-4000-8000-00000000000a'; -- Hand-to-Hand Wombat
update public.game_night_games set tags = array['bluffen', 'sociaal', 'elkaar-dwarszitten']
  where id = '9a000000-0000-4000-8000-00000000000b'; -- Skull
update public.game_night_games set tags = array['kaartspel', 'snel', 'tactisch']
  where id = '9a000000-0000-4000-8000-00000000000c'; -- 1000 Bommen & Granaten
update public.game_night_games set tags = array['relaxed', 'geluk', 'sociaal']
  where id = '9a000000-0000-4000-8000-00000000000d'; -- Keezen
update public.game_night_games set tags = array['bluffen', 'party', 'lachen']
  where id = '9a000000-0000-4000-8000-00000000000e'; -- Sounds Fishy
update public.game_night_games set tags = array['kaartspel', 'party', 'lachen', 'elkaar-dwarszitten']
  where id = '9a000000-0000-4000-8000-00000000000f'; -- De Grote Dalmuti
update public.game_night_games set tags = array['kaartspel', 'snel', 'tactisch']
  where id = '9a000000-0000-4000-8000-000000000010'; -- LAMA
update public.game_night_games set tags = array['strategie', 'relaxed', 'kaartspel']
  where id = '9a000000-0000-4000-8000-000000000011'; -- Koi
update public.game_night_games set tags = array['kaartspel', 'party', 'snel', 'lachen']
  where id = '9a000000-0000-4000-8000-000000000012'; -- Exploding Kittens
update public.game_night_games set tags = array['party', 'lachen', 'elkaar-dwarszitten']
  where id = '9a000000-0000-4000-8000-000000000013'; -- Exploding Kittens bordspel
