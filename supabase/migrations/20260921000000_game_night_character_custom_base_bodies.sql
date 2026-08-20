-- Game Night — eerste integratietest van echte, handgetekende/gegenereerde
-- 512×512 body-PNG's in de bestaande modulaire Character Creator. Puur
-- catalogusdata bovenop de reeds volledig bestaande infrastructuur
-- (game_night_character_parts/unlocks/equipment, equip/unequip-RPC's,
-- CharacterVisual, resolvePlayerCharacter/resolveDraftLayers) — GEEN nieuwe
-- tabel, GEEN nieuwe kolom, GEEN nieuw systeem.
--
-- ── Bestandsinventarisatie (daadwerkelijk gescand, niets verzonnen) ────────
-- public/game-night/characters/parts/custom/base/ bevat 9 PNG's, elk
-- geverifieerd 512×512 met alfakanaal (RGBA, PNG-colorType 6):
--   manbody2.png, manbody5.png, manbody6.png, manbody7.png, manbody8.png,
--   manbody9.png, manbody10.png, manbody11.png, manbody12.png
-- (bewust geen manbody1/3/4 — die bestaan niet in de repo, niet aangevuld).
--
-- ── Slotkeuze: 'base' (niet 'clothing' of een nieuwe slot) ────────────────
-- 1. 'base' is al gedefinieerd (20260914000000, tabelcommentaar) als "de
--    combinatie van lichaam+huidtint als één samenhangende laag" — een
--    volledig-canvas body/outfit-in-één-PNG past hier 1-op-1 in, geen
--    herinterpretatie van een bestaand concept nodig.
-- 2. 'base' is LOCKED_SLOT (gameNightCharacter.ts) — altijd precies één
--    gekozen, kan niet leeggemaakt worden — geeft "één canonieke bodyvorm,
--    geen shape-complexiteit" (opdracht sectie 11) volledig gratis, zonder
--    dat de website daar iets voor hoeft af te dwingen.
-- 3. layer_order-conventie voor 'base' is al 20, ruim onder personal-face
--    (PERSONAL_FACE_LAYER_ORDER = 40, gameNightFaceCanvas.ts) — "body onder
--    gezicht" (opdracht sectie 10) is dus de bestaande default, niet iets
--    wat deze migratie moet regelen.
-- 4. body_shape/body_shape_variants blijven op deze rijen NULL — dat is
--    precies wat canEquipPart()/resolveBodyShapeAssetPath() nodig hebben om
--    GEEN small/medium/large-picker te tonen en de asset_path direct,
--    ongewijzigd te gebruiken (geen variant-lookup).
-- 5. Belangrijke, bij inspectie ontdekte reden om NIET 'clothing' (of een
--    andere V2.9E-slot) te kiezen: de CHECK-constraint op
--    game_night_player_character_equipment.slot (20260914010000) is NOOIT
--    verbreed toen 20260915000000 de nieuwe V2.9E-slots aan de catalogus-
--    tabel toevoegde — een 'clothing'-part zou vandaag dus simpelweg NIET
--    equipbaar zijn (database-CHECK-violation in de equip-RPC). 'base' zit
--    al in de oorspronkelijke, nog altijd geldige 8-slot-allowlist op de
--    equipment-tabel, dus dit werkt vandaag daadwerkelijk end-to-end zonder
--    een aanvullende, ongerelateerde constraint-migratie.
--
-- ── Starter/unlock ──────────────────────────────────────────────────────
-- is_starter = true: de bestaande, reeds-geïmplementeerde manier om een
-- catalogus-item zonder enige progression-drempel beschikbaar te maken (zie
-- getStarterParts()/isPartUnlocked()/canEquipPart() in gameNightCharacter.ts
-- en stap 4 van game_night_equip_character_part). Geen owner-only bypass,
-- geen hardcoded frontend-uitzondering — exact hetzelfde mechanisme als de
-- (inmiddels gedeactiveerde) V2.9B-starterset gebruikte.
--
-- ── Idempotentie ────────────────────────────────────────────────────────
-- `on conflict (key) do nothing` (zelfde patroon als
-- 20260914030000_game_night_character_starter_seed.sql) — een tweede run
-- voegt niets dubbel toe en overschrijft nooit een eventuele latere,
-- handmatige owner-aanpassing (bv. active=false, label-wijziging) aan een
-- reeds bestaande rij.

insert into public.game_night_character_parts
  (key, slot, label, asset_path, layer_order, is_starter, rarity, active, sort_order)
values
  ('body-manbody-02', 'base', 'Body 2', '/game-night/characters/parts/custom/base/manbody2.png', 20, true, 'common', true, 2),
  ('body-manbody-05', 'base', 'Body 5', '/game-night/characters/parts/custom/base/manbody5.png', 20, true, 'common', true, 5),
  ('body-manbody-06', 'base', 'Body 6', '/game-night/characters/parts/custom/base/manbody6.png', 20, true, 'common', true, 6),
  ('body-manbody-07', 'base', 'Body 7', '/game-night/characters/parts/custom/base/manbody7.png', 20, true, 'common', true, 7),
  ('body-manbody-08', 'base', 'Body 8', '/game-night/characters/parts/custom/base/manbody8.png', 20, true, 'common', true, 8),
  ('body-manbody-09', 'base', 'Body 9', '/game-night/characters/parts/custom/base/manbody9.png', 20, true, 'common', true, 9),
  ('body-manbody-10', 'base', 'Body 10', '/game-night/characters/parts/custom/base/manbody10.png', 20, true, 'common', true, 10),
  ('body-manbody-11', 'base', 'Body 11', '/game-night/characters/parts/custom/base/manbody11.png', 20, true, 'common', true, 11),
  ('body-manbody-12', 'base', 'Body 12', '/game-night/characters/parts/custom/base/manbody12.png', 20, true, 'common', true, 12)
on conflict (key) do nothing;

-- Handmatige controle na het draaien van deze migratie:
--
-- select key, label, slot, layer_order, is_starter, active, sort_order
-- from public.game_night_character_parts
-- where key like 'body-manbody-%'
-- order by sort_order;
-- -- verwacht: 9 rijen, allemaal slot='base', is_starter=true, active=true
