import {
  Anchor,
  Axe,
  Bot,
  Crown,
  Gauge,
  Glasses,
  Guitar,
  Rocket,
  Skull,
  Sword,
  Swords,
  Wand2,
  type LucideIcon,
} from "lucide-react";

// Game Night V2.8/V2.9 — de ENE plek die een character-preset-id koppelt
// aan zijn weergave: een echte portrait-asset (V2.9, sectie 3/7) mét een
// tijdelijke Lucide-silhouet als fallback (V2.8, sectie 6/26 — géén
// illustratieve art zelf verzonnen). De database bewaart uitsluitend de
// preset-id (zelfde patroon als arena_symbol in gameNightArena.ts).
//
// IDs zijn ONGEWIJZIGD t.o.v. V2.8 (sectie 3: "geen breaking rename zonder
// migratie/backfill") — bestaande character_id-waarden in de database
// blijven exact geldig.
export const CHARACTER_PRESET_IDS = [
  "knight",
  "wizard",
  "astronaut",
  "pirate",
  "ninja",
  "robot",
  "viking",
  "detective",
  "bard",
  "racer",
  "royal",
  "skeleton",
] as const;

export type GameNightCharacterId = (typeof CHARACTER_PRESET_IDS)[number];

// Sectie 5 (V2.9): vaste, lokale app-assets (géén user-generated content),
// dus statisch onder public/ i.p.v. Supabase Storage — zelfde architectuur-
// keuze als de bestaande tafelobjecten (public/game-night/assets/*.webp,
// zie Candle.tsx/ScatteredTableObjects.tsx). Transparante WebP, geen
// speler-kleur/tekst/badge ingebakken (die blijven losse CSS-lagen, sectie
// 8/9) — zie het opleverrapport voor de exacte 12 bestanden die nog
// aangeleverd moeten worden.
export const CHARACTER_ASSET_DIR = "/game-night/characters";

function assetPathFor(id: GameNightCharacterId): string {
  return `${CHARACTER_ASSET_DIR}/${id}.webp`;
}

export type CharacterPreset = {
  id: GameNightCharacterId;
  label: string;
  /** Root-relatief pad naar de portrait-asset (public/, geen Storage). */
  assetPath: string;
  /** Tijdelijke/permanente silhouet-fallback als de asset ontbreekt of niet laadt. */
  fallbackIcon: LucideIcon;
};

// Twaalf van de veertien in de opdracht genoemde richtingen (V2.8 sectie 4)
// zijn opgenomen; "cowboy" en "goblin" zijn bewust weggelaten omdat er geen
// visueel ONDERSCHEIDEND Lucide-fallback-icoon voor bestaat zonder een
// tweede preset te laten samenvallen met een bestaand icoon.
export const CHARACTER_PRESETS: Record<GameNightCharacterId, CharacterPreset> =
  {
    knight: {
      id: "knight",
      label: "Ridder",
      assetPath: assetPathFor("knight"),
      fallbackIcon: Sword,
    },
    wizard: {
      id: "wizard",
      label: "Tovenaar",
      assetPath: assetPathFor("wizard"),
      fallbackIcon: Wand2,
    },
    astronaut: {
      id: "astronaut",
      label: "Astronaut",
      assetPath: assetPathFor("astronaut"),
      fallbackIcon: Rocket,
    },
    pirate: {
      id: "pirate",
      label: "Piraat",
      assetPath: assetPathFor("pirate"),
      fallbackIcon: Anchor,
    },
    ninja: {
      id: "ninja",
      label: "Ninja",
      assetPath: assetPathFor("ninja"),
      fallbackIcon: Swords,
    },
    robot: {
      id: "robot",
      label: "Robot",
      assetPath: assetPathFor("robot"),
      fallbackIcon: Bot,
    },
    viking: {
      id: "viking",
      label: "Viking",
      assetPath: assetPathFor("viking"),
      fallbackIcon: Axe,
    },
    detective: {
      id: "detective",
      label: "Detective",
      assetPath: assetPathFor("detective"),
      fallbackIcon: Glasses,
    },
    bard: {
      id: "bard",
      label: "Bard",
      assetPath: assetPathFor("bard"),
      fallbackIcon: Guitar,
    },
    racer: {
      id: "racer",
      label: "Coureur",
      assetPath: assetPathFor("racer"),
      fallbackIcon: Gauge,
    },
    royal: {
      id: "royal",
      label: "Koning/Koningin",
      assetPath: assetPathFor("royal"),
      fallbackIcon: Crown,
    },
    skeleton: {
      id: "skeleton",
      label: "Skelet",
      assetPath: assetPathFor("skeleton"),
      fallbackIcon: Skull,
    },
  };

// Backwards-compatible afgeleide exports (V2.8-callers blijven werken).
export const CHARACTER_PRESET_LABELS: Record<GameNightCharacterId, string> =
  Object.fromEntries(
    CHARACTER_PRESET_IDS.map((id) => [id, CHARACTER_PRESETS[id].label]),
  ) as Record<GameNightCharacterId, string>;

export const CHARACTER_PRESET_ICONS: Record<GameNightCharacterId, LucideIcon> =
  Object.fromEntries(
    CHARACTER_PRESET_IDS.map((id) => [id, CHARACTER_PRESETS[id].fallbackIcon]),
  ) as Record<GameNightCharacterId, LucideIcon>;

export function isCharacterId(
  value: string | null | undefined,
): value is GameNightCharacterId {
  return CHARACTER_PRESET_IDS.includes(value as GameNightCharacterId);
}

export type ResolvedCharacterPreset = {
  /** Null = geen (geldige) preset — de UI valt terug op de speler-initiaal. */
  id: GameNightCharacterId | null;
  icon: LucideIcon | null;
  label: string | null;
  assetPath: string | null;
};

// Defensief, zelfde filosofie als resolveGameArenaTheme() in
// gameNightArena.ts: een null/undefined/corrupte/verouderde waarde uit de
// database mag nooit crashen, en resolvet altijd naar een bruikbare,
// voorspelbare fallback-staat i.p.v. een gok.
export function resolveCharacterPreset(
  characterId: string | null | undefined,
): ResolvedCharacterPreset {
  if (!isCharacterId(characterId)) {
    return { id: null, icon: null, label: null, assetPath: null };
  }
  const preset = CHARACTER_PRESETS[characterId];
  return {
    id: preset.id,
    icon: preset.fallbackIcon,
    label: preset.label,
    assetPath: preset.assetPath,
  };
}

export type CharacterVisualSource =
  | { mode: "image"; assetPath: string; icon: LucideIcon }
  | { mode: "icon"; icon: LucideIcon }
  | { mode: "initial" };

// Pure beslislogica voor CharacterVisual.tsx (sectie 7/20-C): geen render-
// code, dus los testbaar zonder een component te hoeven mounten. Drie
// uitkomsten, in prioriteitsvolgorde:
//   1. een geldige preset MET nog geen bekende laadfout -> probeer de
//      echte asset (component valt zelf terug op "icon" via onError zodra
//      dat alsnog misgaat — imageFailed komt van die state).
//   2. een geldige preset waarvan de asset eerder faalde -> silhouet-icoon.
//   3. geen geldige preset -> initiaal (component regelt dat zelf, hier
//      "initial").
export function resolveCharacterVisualSource(
  characterId: string | null | undefined,
  imageFailed: boolean,
): CharacterVisualSource {
  const preset = resolveCharacterPreset(characterId);
  if (!preset.id || !preset.assetPath || !preset.icon) {
    return { mode: "initial" };
  }
  if (imageFailed) {
    return { mode: "icon", icon: preset.icon };
  }
  return { mode: "image", assetPath: preset.assetPath, icon: preset.icon };
}
