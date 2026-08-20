-- Game Night — deactiveert de 14 V2.9B-starterrijen
-- (20260914030000_game_night_character_starter_seed.sql) waarvan de
-- asset_path-bestanden NOOIT fysiek zijn aangeleverd. Dit is de daadwerkelijke
-- oorzaak van de door de speler gemelde broken-image-tegels "Basis 1"/
-- "Basis 2" (en, minder zichtbaar, alle overige 12 starter-onderdelen:
-- Neutraal/Glimlach/Kort haar/Kort haar (donker)/Casual outfit/Casual
-- outfit (donker)/Pet/Muts/Bril/Koffiemok/Zachte gloed/Ster) in de
-- speler-facing Character Creator.
--
-- Root cause (getraceerd, zie ook public/game-night/characters/parts/
-- README.md): 20260914030000 zette bewust is_starter=true, active=true op
-- alle 14 rijen ("genoeg catalogusdata om het model/de frontendhelpers te
-- kunnen testen, GEEN echte art... de frontend valt daar al netjes op
-- terug") — bedoeld als tijdelijke placeholder-data, nooit opgevolgd door
-- echte bestanden onder public/game-night/characters/parts/base|face|hair|
-- outfit|headwear|accessory|effect|badge/ (die mappen bestaan vandaag niet
-- eens meer op disk). Omdat active=true EN is_starter=true, zijn deze rijen
-- vandaag nog altijd zowel zichtbaar/kiesbaar in de echte Creator
-- (useCharacterParts() filtert alleen op active) ALS de stille default-
-- keuze voor een nieuwe speler zonder enige equipment
-- (pickDefaultStarterPart()/buildInitialDraft() in gameNightCharacter.ts
-- kiezen de eerste actieve starter-rij per slot) — een speler die nog nooit
-- iets heeft aangepast krijgt zo zonder het te weten een kapotte
-- "base-default-01" als draft-basis.
--
-- Fix: exact hetzelfde bewezen patroon als
-- 20260917000000_game_night_character_v2_deactivate_extracted_batch.sql —
-- UPDATE active=false, GEEN hard delete. Een hard delete zou via
-- game_night_player_character_equipment_part_id_fkey/
-- game_night_player_character_unlocks_part_id_fkey (beide ON DELETE
-- CASCADE) bestaande equipment-/unlock-rijen van spelers kunnen wegvagen;
-- active=false laat die volledig intact — resolvePlayerCharacter() slaat
-- een equipment-rij die naar een inactief part wijst simpelweg over (geen
-- crash, geen kapot-plaatje). Na deze migratie:
--   - useCharacterParts() (speler-facing) geeft deze 14 rijen niet meer
--     terug -> verdwijnen uit de Creator-grid, kunnen niet meer als
--     stille default gekozen worden;
--   - useAllCharacterPartsForQa() (CharacterAssetQaGrid.tsx) blijft ze WEL
--     tonen (nu gelabeld "inactief"), zoals gevraagd: "QA mag ze wel als
--     missing asset tonen";
--   - CHARACTER_STARTER_MANIFEST (characterStarterManifest.ts, de
--     hardcoded QA-spiegel) blijft ongewijzigd de broken-image-previews
--     tonen — dat bestand leest de database niet, puur diagnostisch, zoals
--     het al deed vóór deze migratie.
--
-- Nadrukkelijk GEEN vervangende artwork gegenereerd of gereconstrueerd —
-- de opdracht was expliciet dat niet te doen. Zodra er echte, handgetekende
-- Photoshop-assets voor deze slots worden aangeleverd (onder
-- parts/custom/<slot>/, zie README.md), registreert een latere, aparte
-- migratie die als nieuwe, actieve rijen — deze 14 legacy-rijen blijven
-- daarna gewoon inactief/historisch.
--
-- GEEN wijziging aan RLS/policies/functies/andere tabellen. Idempotent: de
-- `and active = true`-voorwaarde maakt herhaald draaien onschadelijk.

update public.game_night_character_parts
set active = false
where active = true
  and key in (
    'base-default-01',
    'base-default-02',
    'face-neutral-01',
    'face-smile-01',
    'hair-short-01',
    'hair-short-02',
    'outfit-casual-01',
    'outfit-casual-02',
    'headwear-cap-01',
    'headwear-beanie-01',
    'accessory-glasses-01',
    'accessory-mug-01',
    'effect-glow-01',
    'badge-star-01'
  );

-- Handmatige controle na het draaien van deze migratie:
--
-- select key, label, active from public.game_night_character_parts
-- where key in (
--   'base-default-01','base-default-02','face-neutral-01','face-smile-01',
--   'hair-short-01','hair-short-02','outfit-casual-01','outfit-casual-02',
--   'headwear-cap-01','headwear-beanie-01','accessory-glasses-01',
--   'accessory-mug-01','effect-glow-01','badge-star-01'
-- );
-- -- verwacht: active = false voor alle 14 rijen
--
-- select player_id, slot, part_id
-- from public.game_night_player_character_equipment e
-- join public.game_night_character_parts p on p.id = e.part_id
-- where p.key in (
--   'base-default-01','base-default-02','face-neutral-01','face-smile-01',
--   'hair-short-01','hair-short-02','outfit-casual-01','outfit-casual-02',
--   'headwear-cap-01','headwear-beanie-01','accessory-glasses-01',
--   'accessory-mug-01','effect-glow-01','badge-star-01'
-- );
-- -- toont welke spelers (indien van toepassing) een nu-gedeactiveerd
-- -- legacy-onderdeel droegen — hun equipment-rij blijft bestaan, alleen
-- -- het render-resultaat verliest die ene laag totdat ze iets nieuws kiezen.
