import type {
  GameNightCelebrationStyle,
  GameNightPlayer,
} from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import {
  characterVisualPropsFor,
  type ResolvedCharacter,
} from "@/features/game-night/lib/gameNightCharacter";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

// Game Night V2.10.5 (Arena Fase 1, sectie "winner spotlight") — na ELKE
// WIN (niet alleen de "bijzondere" — dat was de oude, kleinere
// `celebratingPlayerId`-pulse + optionele `GameArenaMomentBanner`)
// onderbreekt dit de scène-rotatie kort: winnaar groot naar voren, gloed/
// burst, "X WINT", en een regel context (bestaande competitive-moment-
// tekst als die er is, anders een van de vaste droge one-liners
// hieronder — GEEN AI-call). Hergebruikt de bestaande celebratie-CSS
// (`.gnv2-celebrate-*`-keyframes, styles.css) — nu ook toegepast op de
// grote, kaderloze `.gnv2-party-character-art` i.p.v. alleen de kleine
// cirkel-variant, zie de toelichting daar.
const FALLBACK_LINES = [
  "Zoals verwacht, eigenlijk.",
  "De rest mag het nog een keer proberen.",
  "Noteer dit voor de eeuwigheid.",
  "Dat ging… best overtuigend.",
  "Weer eentje voor de statistieken.",
];

function pickFallbackLine(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_LINES[hash % FALLBACK_LINES.length];
}

export function ArenaWinnerSpotlight({
  player,
  resolvedCharacter,
  colorHex,
  celebrationStyle,
  winsTonight,
  momentText,
  eventId,
}: {
  player: GameNightPlayer;
  resolvedCharacter: ResolvedCharacter;
  colorHex: string | null;
  celebrationStyle: GameNightCelebrationStyle | null;
  winsTonight: number;
  momentText: string | null;
  // Puur voor een stabiele, deterministische fallback-onelinerkeuze per
  // WIN-event (zie pickFallbackLine) — geen Math.random(), dus geen
  // flakiness bij een eventuele re-render vóór de auto-dismiss.
  eventId: string;
}) {
  const visualProps = characterVisualPropsFor(resolvedCharacter);
  const subline =
    momentText ??
    `${winsTonight === 1 ? "Eerste WIN" : `${winsTonight}e WIN`} van vanavond — ${pickFallbackLine(eventId)}`;

  return (
    <div className="gnv2-winner-spotlight" role="status" aria-live="polite">
      <div
        className={`gnv2-party-character gnv2-winner-spotlight-character gnv2-celebrate-${celebrationStyle ?? "burst"}`}
        style={{
          ["--gnv2-party-char-size" as string]: "300px",
          ["--gnv2-ring" as string]: colorHex ?? "var(--gnv2-accent-warm)",
        }}
      >
        <span className="gnv2-party-character-art">
          <CharacterVisual
            player={player}
            characterId={visualProps.characterId}
            layers={visualProps.layers}
            loading="eager"
          />
        </span>
      </div>
      <p className="gnv2-winner-spotlight-headline">
        {getPlayerDisplayName(player).toUpperCase()} WINT
      </p>
      <p className="gnv2-winner-spotlight-subline">{subline}</p>
    </div>
  );
}
