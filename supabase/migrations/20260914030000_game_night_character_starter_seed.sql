-- Game Night V2.9B (4/4) — starterset (opdracht sectie 7): genoeg
-- catalogusdata om het model en de frontendhelpers te kunnen testen, GEEN
-- echte art (asset_path verwijst naar nog-niet-bestaande bestanden, exact
-- zoals character_id/arena_symbol dat eerder ook deden — de frontend valt
-- daar al netjes op terug, zie CharacterVisual.tsx). `on conflict (key) do
-- nothing`: heruitvoerbaar, nooit een bestaande rij overschrijven (bv. als
-- een owner een starter-item later handmatig heeft aangepast).
--
-- Twee opties per slot (behalve effect/badge: één, om de set overzichtelijk
-- te houden) — "base" heeft er minimaal twee zodat een nieuwe speler
-- meteen al iets te kiezen heeft voor de verplichte laag (sectie 12: base
-- kan niet leeggemaakt worden). Alle asset_path-waarden volgen de conventie
-- uit public/game-night/characters/parts/README.md (20260914-serie).

insert into public.game_night_character_parts
  (key, slot, label, asset_path, layer_order, is_starter, rarity, active, sort_order)
values
  ('base-default-01', 'base', 'Basis 1', '/game-night/characters/parts/base/base-default-01.webp', 20, true, 'common', true, 0),
  ('base-default-02', 'base', 'Basis 2', '/game-night/characters/parts/base/base-default-02.webp', 20, true, 'common', true, 1),

  ('face-neutral-01', 'face', 'Neutraal', '/game-night/characters/parts/face/face-neutral-01.webp', 40, true, 'common', true, 0),
  ('face-smile-01', 'face', 'Glimlach', '/game-night/characters/parts/face/face-smile-01.webp', 40, true, 'common', true, 1),

  ('hair-short-01', 'hair', 'Kort haar', '/game-night/characters/parts/hair/hair-short-01.webp', 50, true, 'common', true, 0),
  ('hair-short-02', 'hair', 'Kort haar (donker)', '/game-night/characters/parts/hair/hair-short-02.webp', 50, true, 'common', true, 1),

  ('outfit-casual-01', 'outfit', 'Casual outfit', '/game-night/characters/parts/outfit/outfit-casual-01.webp', 30, true, 'common', true, 0),
  ('outfit-casual-02', 'outfit', 'Casual outfit (donker)', '/game-night/characters/parts/outfit/outfit-casual-02.webp', 30, true, 'common', true, 1),

  ('headwear-cap-01', 'headwear', 'Pet', '/game-night/characters/parts/headwear/headwear-cap-01.webp', 60, true, 'common', true, 0),
  ('headwear-beanie-01', 'headwear', 'Muts', '/game-night/characters/parts/headwear/headwear-beanie-01.webp', 60, true, 'common', true, 1),

  ('accessory-glasses-01', 'accessory', 'Bril', '/game-night/characters/parts/accessory/accessory-glasses-01.webp', 70, true, 'common', true, 0),
  ('accessory-mug-01', 'accessory', 'Koffiemok', '/game-night/characters/parts/accessory/accessory-mug-01.webp', 70, true, 'common', true, 1),

  ('effect-glow-01', 'effect', 'Zachte gloed', '/game-night/characters/parts/effect/effect-glow-01.webp', 10, true, 'common', true, 0),

  ('badge-star-01', 'badge', 'Ster', '/game-night/characters/parts/badge/badge-star-01.webp', 80, true, 'common', true, 0)
on conflict (key) do nothing;
