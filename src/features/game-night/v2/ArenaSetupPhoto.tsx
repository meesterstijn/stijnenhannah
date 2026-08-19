import { Camera } from "lucide-react";
import type { GameNightArenaTheme } from "@/features/game-night/lib/gameNightArena";

// Game Night V2.7B/V2.8 (sectie 2/3/13/20) — "het hart van de arena": de
// foto van het daadwerkelijk opgebouwde spel, via resolveGameArenaTheme()'s
// eigen fallbackketen (setup -> cover -> placeholder, ONGEWIJZIGD — V2.8
// voegt hier geen nieuwe fallback-stap aan toe). Bewust NIET fullscreen —
// nu ~40-55% van de bruikbare Arena-breedte (V2.8 sectie 2, was 25-40% in
// V2.7B), de exacte grootte komt uit de CSS (.gnv2-arena-board/
// .gnv2-setup-photo in styles.css).
//
// `liveBoardPhoto` (V2.8 sectie 13) is een APARTE, optionele laag: alleen
// aanwezig wanneer er betrouwbaar een recente, expliciet als "Speelbord"
// gecategoriseerde checkpointfoto bestaat (useLatestBoardPhoto). De
// setupfoto blijft de standaard/default weergave — de gebruiker schakelt
// zelf naar de live foto via de toggle-chip, nooit automatisch.
export function ArenaSetupPhoto({
  gameName,
  theme,
  liveBoardPhotoUrl,
  showLive,
  onToggleLive,
}: {
  gameName: string;
  theme: GameNightArenaTheme;
  liveBoardPhotoUrl?: string | null;
  showLive?: boolean;
  onToggleLive?: () => void;
}) {
  const hasLivePhoto = !!liveBoardPhotoUrl;
  const displayUrl =
    hasLivePhoto && showLive ? liveBoardPhotoUrl! : theme.setupImageUrl;

  return (
    <div
      className="gnv2-setup-photo"
      data-arena-style={theme.style ?? "default"}
    >
      <div className="gnv2-setup-photo-glow" aria-hidden />
      <div className="gnv2-setup-photo-frame">
        {displayUrl ? (
          <img src={displayUrl} alt="" />
        ) : (
          <div
            className="gnv2-setup-photo-fallback"
            style={{ background: theme.placeholderGradient }}
          >
            <span>{gameName.charAt(0)}</span>
          </div>
        )}

        {hasLivePhoto && (
          <button
            type="button"
            onClick={onToggleLive}
            className="gnv2-setup-photo-live-toggle"
            aria-pressed={!!showLive}
          >
            <Camera className="h-3.5 w-3.5" />
            {showLive ? "Live tafelfoto" : "Setupfoto"}
          </button>
        )}
      </div>
      <div className="gnv2-setup-photo-caption">
        <p className="gnv2-setup-photo-name">{gameName}</p>
        {theme.tagline && (
          <p className="gnv2-setup-photo-tagline">{theme.tagline}</p>
        )}
      </div>
    </div>
  );
}
