-- Game Night V2.9E — catalogusdata voor de nieuwe 128×128 pixel-art
-- assetstandaard, uitgesneden/genormaliseerd uit de aangeleverde
-- "Game Night Character Assets V1"-spritesheet. GEEN wijziging van de
-- V2.9B-starterset (20260914030000, blijft ongewijzigd bestaan en
-- werkend) — dit is een aparte, additionele set catalogusrijen die de
-- nieuwe slots (20260915000000) gebruikt.
--
-- Alleen VISUEEL GECONTROLEERDE, daadwerkelijk bruikbare uitsnedes staan
-- hieronder met `active = true`. Onderdelen uit de brondata die niet
-- pixel-perfect op de canonical base pasten (achtergrond-matting mislukt,
-- ghosting, onvolledige content) zijn NIET geforceerd — die bestaan als
-- ruwe crop in het ontwikkel-scratchpad, niet in deze migratie, en worden
-- pas een latere `needs_asset_revision`-batch. Uitzondering: de twee
-- female-body-shape-bases (`base-female-small`/`base-female-large`) staan
-- WEL als rij hier (nodig zodat de "Lichaamsbouw"-picker alle 3 opties kan
-- tonen), maar met `active = false` en een asset_path die nog niet
-- bestaat — exact het bestaande needs_asset_revision-patroon
-- (CharacterVisual verbergt een ontbrekende laag stilzwijgend, canEquipPart
-- weigert een inactief part). Zodra echte art op dat pad staat: alleen
-- `active` op true zetten, geen codewijziging nodig.
--
-- `on conflict (key) do nothing`: heruitvoerbaar.

insert into public.game_night_character_parts
  (key, slot, label, asset_path, layer_order, is_starter, rarity, active, sort_order, body_shape, body_shape_variants, pose_key, requires_pose_key)
values

-- ── base (bestaande slot, hergebruikt) ───────────────────────────────────
('base-male-01', 'base', 'Man', '/game-night/characters/parts/v2/base/base-male-01.png', 20, true, 'common', true, 10, null, null, null, null),
('base-female-medium', 'base', 'Vrouw (gemiddeld)', '/game-night/characters/parts/v2/base/base-female-medium.png', 20, true, 'common', true, 20, 'medium', null, null, null),
('base-female-small', 'base', 'Vrouw (klein)', '/game-night/characters/parts/v2/base/base-female-small.png', 20, true, 'common', false, 21, 'small', null, null, null),
('base-female-large', 'base', 'Vrouw (groot)', '/game-night/characters/parts/v2/base/base-female-large.png', 20, true, 'common', false, 22, 'large', null, null, null),

-- ── eyes ──────────────────────────────────────────────────────────────
('eyes-round-01', 'eyes', 'Rond 1', '/game-night/characters/parts/v2/eyes/eyes-round-01.png', 32, true, 'common', true, 0, null, null, null, null),
('eyes-round-02', 'eyes', 'Rond 2', '/game-night/characters/parts/v2/eyes/eyes-round-02.png', 32, true, 'common', true, 1, null, null, null, null),
('eyes-round-03', 'eyes', 'Rond 3', '/game-night/characters/parts/v2/eyes/eyes-round-03.png', 32, true, 'common', true, 2, null, null, null, null),
('eyes-almond-01', 'eyes', 'Amandel 1', '/game-night/characters/parts/v2/eyes/eyes-almond-01.png', 32, true, 'common', true, 3, null, null, null, null),
('eyes-almond-02', 'eyes', 'Amandel 2', '/game-night/characters/parts/v2/eyes/eyes-almond-02.png', 32, true, 'common', true, 4, null, null, null, null),
('eyes-almond-03', 'eyes', 'Amandel 3', '/game-night/characters/parts/v2/eyes/eyes-almond-03.png', 32, true, 'common', true, 5, null, null, null, null),

-- ── mouth ─────────────────────────────────────────────────────────────
('mouth-01', 'mouth', 'Mond 1', '/game-night/characters/parts/v2/mouth/mouth-01.png', 36, true, 'common', true, 0, null, null, null, null),
('mouth-02', 'mouth', 'Mond 2', '/game-night/characters/parts/v2/mouth/mouth-02.png', 36, true, 'common', true, 1, null, null, null, null),
('mouth-03', 'mouth', 'Mond 3', '/game-night/characters/parts/v2/mouth/mouth-03.png', 36, true, 'common', true, 2, null, null, null, null),
('mouth-04', 'mouth', 'Mond 4', '/game-night/characters/parts/v2/mouth/mouth-04.png', 36, true, 'common', true, 3, null, null, null, null),
('mouth-05', 'mouth', 'Mond 5', '/game-night/characters/parts/v2/mouth/mouth-05.png', 36, true, 'common', true, 4, null, null, null, null),
('mouth-06', 'mouth', 'Mond 6', '/game-night/characters/parts/v2/mouth/mouth-06.png', 36, true, 'common', true, 5, null, null, null, null),
('mouth-07', 'mouth', 'Mond 7', '/game-night/characters/parts/v2/mouth/mouth-07.png', 36, true, 'common', true, 6, null, null, null, null),
('mouth-08', 'mouth', 'Mond 8', '/game-night/characters/parts/v2/mouth/mouth-08.png', 36, true, 'common', true, 7, null, null, null, null),

-- ── headwear (bestaande slot, hergebruikt) ───────────────────────────────
('headwear-cap-white', 'headwear', 'Witte pet', '/game-night/characters/parts/v2/headwear/headwear-cap-white.png', 60, true, 'common', true, 0, null, null, null, null),
('headwear-beanie-red', 'headwear', 'Rode muts', '/game-night/characters/parts/v2/headwear/headwear-beanie-red.png', 60, true, 'common', true, 1, null, null, null, null),
('headwear-beanie-gray', 'headwear', 'Grijze muts', '/game-night/characters/parts/v2/headwear/headwear-beanie-gray.png', 60, true, 'common', true, 2, null, null, null, null),
('headwear-bucket-tan', 'headwear', 'Vissershoedje', '/game-night/characters/parts/v2/headwear/headwear-bucket-tan.png', 60, true, 'common', true, 3, null, null, null, null),

-- ── glasses ───────────────────────────────────────────────────────────
('glasses-round-gold', 'glasses', 'Ronde bril (goud)', '/game-night/characters/parts/v2/glasses/glasses-round-gold.png', 55, true, 'common', true, 0, null, null, null, null),

-- ── clothing (female — met lichaamsbouw-variantenmap; alleen 'medium'
--    heeft vandaag echte art, small/large zijn needs_asset_revision en
--    vallen via resolveBodyShapeAssetPath() terug op medium) ─────────────
('clothing-hoodie-purple-f', 'clothing', 'Paarse hoodie', '/game-night/characters/parts/v2/clothing/clothing-hoodie-purple-medium.png', 25, true, 'common', true, 0, null, '{"medium": "/game-night/characters/parts/v2/clothing/clothing-hoodie-purple-medium.png"}', null, null),
('clothing-sweater-cream-f', 'clothing', 'Crème trui', '/game-night/characters/parts/v2/clothing/clothing-sweater-cream-medium.png', 25, true, 'common', true, 1, null, '{"medium": "/game-night/characters/parts/v2/clothing/clothing-sweater-cream-medium.png"}', null, null),
('clothing-sweater-red-f', 'clothing', 'Rode trui', '/game-night/characters/parts/v2/clothing/clothing-sweater-red-medium.png', 25, true, 'common', true, 2, null, '{"medium": "/game-night/characters/parts/v2/clothing/clothing-sweater-red-medium.png"}', null, null),
('clothing-jacket-denim-f', 'clothing', 'Spijkerjasje', '/game-night/characters/parts/v2/clothing/clothing-jacket-denim-medium.png', 25, true, 'common', true, 3, null, '{"medium": "/game-night/characters/parts/v2/clothing/clothing-jacket-denim-medium.png"}', null, null),
('clothing-top-green-f', 'clothing', 'Groen off-shoulder topje', '/game-night/characters/parts/v2/clothing/clothing-top-green-medium.png', 25, true, 'common', true, 4, null, '{"medium": "/game-night/characters/parts/v2/clothing/clothing-top-green-medium.png"}', null, null),

-- ── clothing (male — geen lichaamsbouw-variant nodig) ────────────────────
('clothing-flannel-red-m', 'clothing', 'Rode flanellen blouse', '/game-night/characters/parts/v2/clothing/clothing-flannel-red.png', 25, true, 'common', true, 5, null, null, null, null),
('clothing-henley-gray-m', 'clothing', 'Grijze henley', '/game-night/characters/parts/v2/clothing/clothing-henley-gray.png', 25, true, 'common', true, 6, null, null, null, null),

-- ── arms (female) — pose_key op de items die een prop kunnen dragen ──────
('arms-f-mug', 'arms', 'Hand met mok', '/game-night/characters/parts/v2/arms/arms-f-mug.png', 65, true, 'common', true, 0, null, null, 'hold-mug-f', null),
('arms-f-wine', 'arms', 'Hand met glas', '/game-night/characters/parts/v2/arms/arms-f-wine.png', 65, true, 'common', true, 1, null, null, 'hold-wine-f', null),
('arms-f-cards', 'arms', 'Hand met kaarten', '/game-night/characters/parts/v2/arms/arms-f-cards.png', 65, true, 'common', true, 2, null, null, 'hold-cards-f', null),
('arms-f-guitar', 'arms', 'Hand aan gitaar', '/game-night/characters/parts/v2/arms/arms-f-guitar.png', 65, true, 'common', true, 3, null, null, 'hold-guitar-f', null),
('arms-f-peace', 'arms', 'Peace-teken', '/game-night/characters/parts/v2/arms/arms-f-peace.png', 65, true, 'common', true, 4, null, null, null, null),
('arms-f-point', 'arms', 'Wijzende hand', '/game-night/characters/parts/v2/arms/arms-f-point.png', 65, true, 'common', true, 5, null, null, null, null),

-- ── arms (male) ───────────────────────────────────────────────────────
('arms-m-mug', 'arms', 'Hand met mok', '/game-night/characters/parts/v2/arms/arms-m-mug.png', 65, true, 'common', true, 6, null, null, 'hold-mug-m', null),
('arms-m-beer', 'arms', 'Hand met bier', '/game-night/characters/parts/v2/arms/arms-m-beer.png', 65, true, 'common', true, 7, null, null, 'hold-beer-m', null),
('arms-m-cards', 'arms', 'Hand met kaarten', '/game-night/characters/parts/v2/arms/arms-m-cards.png', 65, true, 'common', true, 8, null, null, 'hold-cards-m', null),
('arms-m-guitar', 'arms', 'Hand aan gitaar', '/game-night/characters/parts/v2/arms/arms-m-guitar.png', 65, true, 'common', true, 9, null, null, 'hold-guitar-m', null),
('arms-m-peace', 'arms', 'Peace-teken', '/game-night/characters/parts/v2/arms/arms-m-peace.png', 65, true, 'common', true, 10, null, null, null, null),
('arms-m-point', 'arms', 'Wijzende hand', '/game-night/characters/parts/v2/arms/arms-m-point.png', 65, true, 'common', true, 11, null, null, null, null),

-- ── props — requires_pose_key koppelt aan de gender-neutrale pose-id;
--    de resolver combineert die met het geslacht van de actieve base
--    (resolveCompatibleArmsPart() in gameNightCharacter.ts). Controller en
--    headphones hebben in de brondata GEEN bijpassende hand-sprite —
--    blijven bewust pose-onafhankelijk (requires_pose_key null) i.p.v. een
--    verkeerde arm te forceren. prop-beer is alleen voor de male base
--    gekoppeld (geen female "hold-beer"-arm in de brondata) — zie het
--    opleverrapport. ────────────────────────────────────────────────────
('prop-mug', 'props', 'Mok', '/game-night/characters/parts/v2/props/prop-mug.png', 75, true, 'common', true, 0, null, null, null, 'hold-mug'),
('prop-beer', 'props', 'Biertje', '/game-night/characters/parts/v2/props/prop-beer.png', 75, true, 'common', true, 1, null, null, null, 'hold-beer'),
('prop-cards', 'props', 'Speelkaarten', '/game-night/characters/parts/v2/props/prop-cards.png', 75, true, 'common', true, 2, null, null, null, 'hold-cards'),
('prop-controller', 'props', 'Controller', '/game-night/characters/parts/v2/props/prop-controller.png', 75, true, 'common', true, 3, null, null, null, null),
('prop-guitar', 'props', 'Gitaar', '/game-night/characters/parts/v2/props/prop-guitar.png', 75, true, 'common', true, 4, null, null, null, 'hold-guitar'),
('prop-headphones', 'props', 'Koptelefoon', '/game-night/characters/parts/v2/props/prop-headphones.png', 75, true, 'common', true, 5, null, null, null, null),

-- ── foreground-effects ────────────────────────────────────────────────
('effect-party-hat', 'foreground-effects', 'Feesthoedje', '/game-night/characters/parts/v2/foreground-effects/effect-party-hat.png', 95, true, 'common', true, 0, null, null, null, null),
('effect-cat-headphones', 'foreground-effects', 'Kattenoortjes-koptelefoon', '/game-night/characters/parts/v2/foreground-effects/effect-cat-headphones.png', 95, true, 'common', true, 1, null, null, null, null),
('effect-pixel-sunglasses', 'foreground-effects', 'Pixel-zonnebril', '/game-night/characters/parts/v2/foreground-effects/effect-pixel-sunglasses.png', 95, true, 'common', true, 2, null, null, null, null),
('effect-question-marks', 'foreground-effects', 'Vraagtekens', '/game-night/characters/parts/v2/foreground-effects/effect-question-marks.png', 95, true, 'common', true, 3, null, null, null, null),
('effect-sparkles', 'foreground-effects', 'Sparkles', '/game-night/characters/parts/v2/foreground-effects/effect-sparkles.png', 95, true, 'common', true, 4, null, null, null, null),
('effect-hearts', 'foreground-effects', 'Hartjes', '/game-night/characters/parts/v2/foreground-effects/effect-hearts.png', 95, true, 'common', true, 5, null, null, null, null)

on conflict (key) do nothing;
