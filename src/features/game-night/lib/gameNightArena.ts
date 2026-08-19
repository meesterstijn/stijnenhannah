// Game Night V2.7A (sectie 2/11) — de ENE plek waar de toekomstige Game
// Arena (V2.7B) haar per-spel-configuratie oplost naar veilige, altijd-
// bruikbare waarden. Doel: V2.7B mag nergens zelf null-checks/fallback-
// logica voor arena-config herimplementeren, alleen resolveGameArenaTheme()
// aanroepen. Bevat GEEN Live Play-UI, geen JSX, geen animatiecode — puur
// data in, data uit.
//
// Defensief, niet blind op TypeScript-types vertrouwd: alle vijf preset-
// achtige velden (kleuren + de drie allowlists) worden hier OPNIEUW
// gevalideerd op het moment van lezen, ook al garandeert de databasetrigger/
// CHECK-constraint dit al bij het schrijven. Supabase-responses zijn op
// runtime gewoon JSON — een verouderde cache, een handmatige databasewijziging
// of een toekomstige schema-afwijking mag nooit een corrupte waarde
// ongefilterd doorzetten naar de UI (zie testscenario's E/F/G/H/I).

import type {
  GameNightArenaStyle,
  GameNightArenaSymbol,
  GameNightCelebrationStyle,
  GameNightGame,
} from "@/lib/supabase";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { getGameSetupUrl } from "@/features/game-night/lib/gameSetupStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";

export const ARENA_STYLES: readonly GameNightArenaStyle[] = [
  "warm",
  "dark",
  "neon",
  "playful",
  "classic",
];

export const ARENA_SYMBOLS: readonly GameNightArenaSymbol[] = [
  "hex",
  "skull",
  "music",
  "cards",
  "dice",
  "crown",
  "burst",
  "star",
  "none",
];

export const CELEBRATION_STYLES: readonly GameNightCelebrationStyle[] = [
  "burst",
  "pulse",
  "spark",
  "slam",
  "glitch",
  "confetti",
];

// #RGB of #RRGGBB — zelfde vorm als de databasetrigger accepteert vóór
// normalisatie. Deze helper verwacht/retourneert de al-genormaliseerde
// "#rrggbb"-vorm uit de database, maar wijst defensief ELKE afwijkende
// waarde af (inclusief precies de gevaarlijke/ongeldige voorbeelden uit
// sectie 19-I: "red", "url(...)", "var(...)", "#GGGGGG", "<script>").
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

export function isArenaStyle(
  value: string | null | undefined,
): value is GameNightArenaStyle {
  return ARENA_STYLES.includes(value as GameNightArenaStyle);
}

export function isArenaSymbol(
  value: string | null | undefined,
): value is GameNightArenaSymbol {
  return ARENA_SYMBOLS.includes(value as GameNightArenaSymbol);
}

export function isCelebrationStyle(
  value: string | null | undefined,
): value is GameNightCelebrationStyle {
  return CELEBRATION_STYLES.includes(value as GameNightCelebrationStyle);
}

// Generieke GNV2-fallbackkleuren (sectie 4/9) — visuele benadering van de
// bestaande --gnv2-accent-warm/--gnv2-accent-cool tokens uit styles.css.
// Puur een fallback-hexwaarde voor wanneer een spel geen eigen arena-kleur
// heeft; verandert de CSS-tokens zelf niet en hoeft er niet pixelgelijk aan
// te zijn.
export const GNV2_FALLBACK_PRIMARY_COLOR = "#e08a5c";
export const GNV2_FALLBACK_SECONDARY_COLOR = "#5ec3d1";

const MAX_TAGLINE_LENGTH = 140;

export type GameNightArenaTheme = {
  /** Altijd een geldige "#rrggbb"-waarde — nooit null, valt terug op de generieke GNV2-kleur. */
  primaryColor: string;
  /** Altijd een geldige "#rrggbb"-waarde — nooit null, valt terug op de generieke GNV2-kleur. */
  secondaryColor: string;
  /** null = geen preset gekozen (of corrupt) — de toekomstige Game Arena gebruikt dan haar eigen generieke look. */
  style: GameNightArenaStyle | null;
  /** Nooit null: onbekend/ontbrekend/corrupt valt terug op "none" (geen symbool tonen). */
  symbol: GameNightArenaSymbol;
  /** Getrimd, of null als leeg/ontbrekend. */
  tagline: string | null;
  /** null = geen preset gekozen (of corrupt) — V2.7B gebruikt dan haar eigen generieke WIN-celebratie. */
  celebrationStyle: GameNightCelebrationStyle | null;
  /** setup_storage_path -> cover_storage_path -> null, in die volgorde. */
  setupImageUrl: string | null;
  /** true zodra setupImageUrl daadwerkelijk de eigen setupfoto is (niet de coverfoto-fallback). */
  isSetupPhoto: boolean;
  /** Deterministische, spelId-gebaseerde gradient — altijd beschikbaar, ook zonder enige foto. */
  placeholderGradient: string;
};

export function resolveGameArenaTheme(
  game: GameNightGame,
): GameNightArenaTheme {
  const setupImageUrl = game.setup_storage_path
    ? getGameSetupUrl(game.setup_storage_path)
    : game.cover_storage_path
      ? getGameCoverUrl(game.cover_storage_path)
      : null;

  const tagline = game.arena_tagline?.trim();

  return {
    primaryColor: isValidHexColor(game.arena_primary_color)
      ? game.arena_primary_color
      : GNV2_FALLBACK_PRIMARY_COLOR,
    secondaryColor: isValidHexColor(game.arena_secondary_color)
      ? game.arena_secondary_color
      : GNV2_FALLBACK_SECONDARY_COLOR,
    style: isArenaStyle(game.arena_style) ? game.arena_style : null,
    symbol: isArenaSymbol(game.arena_symbol) ? game.arena_symbol : "none",
    tagline:
      tagline && tagline.length > 0
        ? tagline.slice(0, MAX_TAGLINE_LENGTH)
        : null,
    celebrationStyle: isCelebrationStyle(game.celebration_style)
      ? game.celebration_style
      : null,
    setupImageUrl,
    isSetupPhoto: !!game.setup_storage_path,
    placeholderGradient: placeholderCoverGradient(game.id),
  };
}
