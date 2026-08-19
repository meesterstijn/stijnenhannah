import type {
  GameNightCharacterPart,
  GameNightCharacterSlot,
} from "@/lib/supabase";

// Game Night V2.9D (sectie 1/17/25) — een STATISCHE spiegel van de 14
// starter-rijen uit
// supabase/migrations/20260914030000_game_night_character_starter_seed.sql,
// uitsluitend voor development-tooling (de asset-manifestcheck hieronder
// en CharacterAssetQaGrid.tsx): geen nieuwe backend, geen nieuwe databron —
// de LIVE Creator/Lobby/Arena lezen nog altijd uitsluitend de echte
// catalogus via useCharacterParts() (Supabase). Handmatig in sync houden
// met de migratie als die ooit wijzigt (rapportageplicht, niet
// afgedwongen).
//
// `id` ontbreekt bewust — dat is een gen_random_uuid() die pas bij INSERT
// ontstaat, dus nooit vooraf gekend/stabiel voor dev-tooling. `key` is de
// praktische stabiele identifier.
export type CharacterStarterManifestEntry = Pick<
  GameNightCharacterPart,
  "key" | "slot" | "label" | "asset_path" | "layer_order"
>;

export const CHARACTER_STARTER_MANIFEST: readonly CharacterStarterManifestEntry[] =
  [
    {
      key: "base-default-01",
      slot: "base",
      label: "Basis 1",
      asset_path: "/game-night/characters/parts/base/base-default-01.webp",
      layer_order: 20,
    },
    {
      key: "base-default-02",
      slot: "base",
      label: "Basis 2",
      asset_path: "/game-night/characters/parts/base/base-default-02.webp",
      layer_order: 20,
    },
    {
      key: "face-neutral-01",
      slot: "face",
      label: "Neutraal",
      asset_path: "/game-night/characters/parts/face/face-neutral-01.webp",
      layer_order: 40,
    },
    {
      key: "face-smile-01",
      slot: "face",
      label: "Glimlach",
      asset_path: "/game-night/characters/parts/face/face-smile-01.webp",
      layer_order: 40,
    },
    {
      key: "hair-short-01",
      slot: "hair",
      label: "Kort haar",
      asset_path: "/game-night/characters/parts/hair/hair-short-01.webp",
      layer_order: 50,
    },
    {
      key: "hair-short-02",
      slot: "hair",
      label: "Kort haar (donker)",
      asset_path: "/game-night/characters/parts/hair/hair-short-02.webp",
      layer_order: 50,
    },
    {
      key: "outfit-casual-01",
      slot: "outfit",
      label: "Casual outfit",
      asset_path: "/game-night/characters/parts/outfit/outfit-casual-01.webp",
      layer_order: 30,
    },
    {
      key: "outfit-casual-02",
      slot: "outfit",
      label: "Casual outfit (donker)",
      asset_path: "/game-night/characters/parts/outfit/outfit-casual-02.webp",
      layer_order: 30,
    },
    {
      key: "headwear-cap-01",
      slot: "headwear",
      label: "Pet",
      asset_path: "/game-night/characters/parts/headwear/headwear-cap-01.webp",
      layer_order: 60,
    },
    {
      key: "headwear-beanie-01",
      slot: "headwear",
      label: "Muts",
      asset_path:
        "/game-night/characters/parts/headwear/headwear-beanie-01.webp",
      layer_order: 60,
    },
    {
      key: "accessory-glasses-01",
      slot: "accessory",
      label: "Bril",
      asset_path:
        "/game-night/characters/parts/accessory/accessory-glasses-01.webp",
      layer_order: 70,
    },
    {
      key: "accessory-mug-01",
      slot: "accessory",
      label: "Koffiemok",
      asset_path:
        "/game-night/characters/parts/accessory/accessory-mug-01.webp",
      layer_order: 70,
    },
    {
      key: "effect-glow-01",
      slot: "effect",
      label: "Zachte gloed",
      asset_path: "/game-night/characters/parts/effect/effect-glow-01.webp",
      layer_order: 10,
    },
    {
      key: "badge-star-01",
      slot: "badge",
      label: "Ster",
      asset_path: "/game-night/characters/parts/badge/badge-star-01.webp",
      layer_order: 80,
    },
  ] as const;

export function starterManifestBySlot(): Map<
  GameNightCharacterSlot,
  CharacterStarterManifestEntry[]
> {
  const map = new Map<
    GameNightCharacterSlot,
    CharacterStarterManifestEntry[]
  >();
  for (const entry of CHARACTER_STARTER_MANIFEST) {
    const arr = map.get(entry.slot);
    if (arr) arr.push(entry);
    else map.set(entry.slot, [entry]);
  }
  return map;
}
