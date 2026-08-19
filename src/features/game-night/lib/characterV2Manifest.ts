import type {
  GameNightBodyShape,
  GameNightCharacterPart,
  GameNightCharacterSlot,
} from "@/lib/supabase";

// Game Night V2.9E — STATISCHE spiegel van de nieuwe pixel-art seed uit
// supabase/migrations/20260915010000_game_night_character_v2_seed.sql,
// uitsluitend voor development-tooling (CharacterAssetQaGrid.tsx). Net als
// characterStarterManifest.ts (V2.9D): geen nieuwe databron, de LIVE
// Creator/Lobby/Arena lezen nog altijd uitsluitend de echte catalogus via
// useCharacterParts(). Handmatig in sync houden met de migratie.
//
// `id` ontbreekt bewust (pas bij INSERT gegenereerd) — `key` is de
// stabiele identifier.
export type CharacterV2ManifestEntry = Pick<
  GameNightCharacterPart,
  | "key"
  | "slot"
  | "label"
  | "asset_path"
  | "layer_order"
  | "active"
  | "body_shape"
  | "body_shape_variants"
  | "pose_key"
  | "requires_pose_key"
>;

function entry(
  key: string,
  slot: GameNightCharacterSlot,
  label: string,
  asset_path: string,
  layer_order: number,
  overrides: Partial<CharacterV2ManifestEntry> = {},
): CharacterV2ManifestEntry {
  return {
    key,
    slot,
    label,
    asset_path,
    layer_order,
    active: true,
    body_shape: null,
    body_shape_variants: null,
    pose_key: null,
    requires_pose_key: null,
    ...overrides,
  };
}

const P = "/game-night/characters/parts/v2";

export const CHARACTER_V2_MANIFEST: readonly CharacterV2ManifestEntry[] = [
  // ── base ──────────────────────────────────────────────────────────────
  entry("base-male-01", "base", "Man", `${P}/base/base-male-01.png`, 20),
  entry(
    "base-female-medium",
    "base",
    "Vrouw (gemiddeld)",
    `${P}/base/base-female-medium.png`,
    20,
    { body_shape: "medium" },
  ),
  entry(
    "base-female-small",
    "base",
    "Vrouw (klein)",
    `${P}/base/base-female-small.png`,
    20,
    { body_shape: "small", active: false },
  ),
  entry(
    "base-female-large",
    "base",
    "Vrouw (groot)",
    `${P}/base/base-female-large.png`,
    20,
    { body_shape: "large", active: false },
  ),

  // ── eyes ──────────────────────────────────────────────────────────────
  entry("eyes-round-01", "eyes", "Rond 1", `${P}/eyes/eyes-round-01.png`, 32),
  entry("eyes-round-02", "eyes", "Rond 2", `${P}/eyes/eyes-round-02.png`, 32),
  entry("eyes-round-03", "eyes", "Rond 3", `${P}/eyes/eyes-round-03.png`, 32),
  entry(
    "eyes-almond-01",
    "eyes",
    "Amandel 1",
    `${P}/eyes/eyes-almond-01.png`,
    32,
  ),
  entry(
    "eyes-almond-02",
    "eyes",
    "Amandel 2",
    `${P}/eyes/eyes-almond-02.png`,
    32,
  ),
  entry(
    "eyes-almond-03",
    "eyes",
    "Amandel 3",
    `${P}/eyes/eyes-almond-03.png`,
    32,
  ),

  // ── mouth ─────────────────────────────────────────────────────────────
  entry("mouth-01", "mouth", "Mond 1", `${P}/mouth/mouth-01.png`, 36),
  entry("mouth-02", "mouth", "Mond 2", `${P}/mouth/mouth-02.png`, 36),
  entry("mouth-03", "mouth", "Mond 3", `${P}/mouth/mouth-03.png`, 36),
  entry("mouth-04", "mouth", "Mond 4", `${P}/mouth/mouth-04.png`, 36),
  entry("mouth-05", "mouth", "Mond 5", `${P}/mouth/mouth-05.png`, 36),
  entry("mouth-06", "mouth", "Mond 6", `${P}/mouth/mouth-06.png`, 36),
  entry("mouth-07", "mouth", "Mond 7", `${P}/mouth/mouth-07.png`, 36),
  entry("mouth-08", "mouth", "Mond 8", `${P}/mouth/mouth-08.png`, 36),

  // ── headwear ──────────────────────────────────────────────────────────
  entry(
    "headwear-cap-white",
    "headwear",
    "Witte pet",
    `${P}/headwear/headwear-cap-white.png`,
    60,
  ),
  entry(
    "headwear-beanie-red",
    "headwear",
    "Rode muts",
    `${P}/headwear/headwear-beanie-red.png`,
    60,
  ),
  entry(
    "headwear-beanie-gray",
    "headwear",
    "Grijze muts",
    `${P}/headwear/headwear-beanie-gray.png`,
    60,
  ),
  entry(
    "headwear-bucket-tan",
    "headwear",
    "Vissershoedje",
    `${P}/headwear/headwear-bucket-tan.png`,
    60,
  ),

  // ── glasses ───────────────────────────────────────────────────────────
  entry(
    "glasses-round-gold",
    "glasses",
    "Ronde bril (goud)",
    `${P}/glasses/glasses-round-gold.png`,
    55,
  ),

  // ── clothing (female — body_shape_variants) ─────────────────────────────
  entry(
    "clothing-hoodie-purple-f",
    "clothing",
    "Paarse hoodie",
    `${P}/clothing/clothing-hoodie-purple-medium.png`,
    25,
    {
      body_shape_variants: {
        medium: `${P}/clothing/clothing-hoodie-purple-medium.png`,
      },
    },
  ),
  entry(
    "clothing-sweater-cream-f",
    "clothing",
    "Crème trui",
    `${P}/clothing/clothing-sweater-cream-medium.png`,
    25,
    {
      body_shape_variants: {
        medium: `${P}/clothing/clothing-sweater-cream-medium.png`,
      },
    },
  ),
  entry(
    "clothing-sweater-red-f",
    "clothing",
    "Rode trui",
    `${P}/clothing/clothing-sweater-red-medium.png`,
    25,
    {
      body_shape_variants: {
        medium: `${P}/clothing/clothing-sweater-red-medium.png`,
      },
    },
  ),
  entry(
    "clothing-jacket-denim-f",
    "clothing",
    "Spijkerjasje",
    `${P}/clothing/clothing-jacket-denim-medium.png`,
    25,
    {
      body_shape_variants: {
        medium: `${P}/clothing/clothing-jacket-denim-medium.png`,
      },
    },
  ),
  entry(
    "clothing-top-green-f",
    "clothing",
    "Groen off-shoulder topje",
    `${P}/clothing/clothing-top-green-medium.png`,
    25,
    {
      body_shape_variants: {
        medium: `${P}/clothing/clothing-top-green-medium.png`,
      },
    },
  ),

  // ── clothing (male) ───────────────────────────────────────────────────
  entry(
    "clothing-flannel-red-m",
    "clothing",
    "Rode flanellen blouse",
    `${P}/clothing/clothing-flannel-red.png`,
    25,
  ),
  entry(
    "clothing-henley-gray-m",
    "clothing",
    "Grijze henley",
    `${P}/clothing/clothing-henley-gray.png`,
    25,
  ),

  // ── arms (female) ─────────────────────────────────────────────────────
  entry("arms-f-mug", "arms", "Hand met mok", `${P}/arms/arms-f-mug.png`, 65, {
    pose_key: "hold-mug-f",
  }),
  entry(
    "arms-f-wine",
    "arms",
    "Hand met glas",
    `${P}/arms/arms-f-wine.png`,
    65,
    { pose_key: "hold-wine-f" },
  ),
  entry(
    "arms-f-cards",
    "arms",
    "Hand met kaarten",
    `${P}/arms/arms-f-cards.png`,
    65,
    { pose_key: "hold-cards-f" },
  ),
  entry(
    "arms-f-guitar",
    "arms",
    "Hand aan gitaar",
    `${P}/arms/arms-f-guitar.png`,
    65,
    { pose_key: "hold-guitar-f" },
  ),
  entry(
    "arms-f-peace",
    "arms",
    "Peace-teken",
    `${P}/arms/arms-f-peace.png`,
    65,
  ),
  entry(
    "arms-f-point",
    "arms",
    "Wijzende hand",
    `${P}/arms/arms-f-point.png`,
    65,
  ),

  // ── arms (male) ───────────────────────────────────────────────────────
  entry("arms-m-mug", "arms", "Hand met mok", `${P}/arms/arms-m-mug.png`, 65, {
    pose_key: "hold-mug-m",
  }),
  entry(
    "arms-m-beer",
    "arms",
    "Hand met bier",
    `${P}/arms/arms-m-beer.png`,
    65,
    { pose_key: "hold-beer-m" },
  ),
  entry(
    "arms-m-cards",
    "arms",
    "Hand met kaarten",
    `${P}/arms/arms-m-cards.png`,
    65,
    { pose_key: "hold-cards-m" },
  ),
  entry(
    "arms-m-guitar",
    "arms",
    "Hand aan gitaar",
    `${P}/arms/arms-m-guitar.png`,
    65,
    { pose_key: "hold-guitar-m" },
  ),
  entry(
    "arms-m-peace",
    "arms",
    "Peace-teken",
    `${P}/arms/arms-m-peace.png`,
    65,
  ),
  entry(
    "arms-m-point",
    "arms",
    "Wijzende hand",
    `${P}/arms/arms-m-point.png`,
    65,
  ),

  // ── props ─────────────────────────────────────────────────────────────
  entry("prop-mug", "props", "Mok", `${P}/props/prop-mug.png`, 75, {
    requires_pose_key: "hold-mug",
  }),
  entry("prop-beer", "props", "Biertje", `${P}/props/prop-beer.png`, 75, {
    requires_pose_key: "hold-beer",
  }),
  entry(
    "prop-cards",
    "props",
    "Speelkaarten",
    `${P}/props/prop-cards.png`,
    75,
    { requires_pose_key: "hold-cards" },
  ),
  entry(
    "prop-controller",
    "props",
    "Controller",
    `${P}/props/prop-controller.png`,
    75,
  ),
  entry("prop-guitar", "props", "Gitaar", `${P}/props/prop-guitar.png`, 75, {
    requires_pose_key: "hold-guitar",
  }),
  entry(
    "prop-headphones",
    "props",
    "Koptelefoon",
    `${P}/props/prop-headphones.png`,
    75,
  ),

  // ── foreground-effects ────────────────────────────────────────────────
  entry(
    "effect-party-hat",
    "foreground-effects",
    "Feesthoedje",
    `${P}/foreground-effects/effect-party-hat.png`,
    95,
  ),
  entry(
    "effect-cat-headphones",
    "foreground-effects",
    "Kattenoortjes-koptelefoon",
    `${P}/foreground-effects/effect-cat-headphones.png`,
    95,
  ),
  entry(
    "effect-pixel-sunglasses",
    "foreground-effects",
    "Pixel-zonnebril",
    `${P}/foreground-effects/effect-pixel-sunglasses.png`,
    95,
  ),
  entry(
    "effect-question-marks",
    "foreground-effects",
    "Vraagtekens",
    `${P}/foreground-effects/effect-question-marks.png`,
    95,
  ),
  entry(
    "effect-sparkles",
    "foreground-effects",
    "Sparkles",
    `${P}/foreground-effects/effect-sparkles.png`,
    95,
  ),
  entry(
    "effect-hearts",
    "foreground-effects",
    "Hartjes",
    `${P}/foreground-effects/effect-hearts.png`,
    95,
  ),
] as const;

export function v2ManifestBySlot(): Map<
  GameNightCharacterSlot,
  CharacterV2ManifestEntry[]
> {
  const map = new Map<GameNightCharacterSlot, CharacterV2ManifestEntry[]>();
  for (const item of CHARACTER_V2_MANIFEST) {
    const arr = map.get(item.slot);
    if (arr) arr.push(item);
    else map.set(item.slot, [item]);
  }
  return map;
}

export function getV2BodyShapeBaseEntries(): CharacterV2ManifestEntry[] {
  return CHARACTER_V2_MANIFEST.filter(
    (e) => e.slot === "base" && e.body_shape != null,
  );
}

export const V2_NEEDS_ASSET_REVISION_SLOTS: readonly {
  slot: GameNightCharacterSlot;
  note: string;
}[] = [
  {
    slot: "eyebrows",
    note: "5/8 uitgesneden, kwaliteit onvoldoende geverifieerd",
  },
  {
    slot: "facial-hair",
    note: "matting mislukte voor alle 6 varianten (ghosting)",
  },
] as const;
