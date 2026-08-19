import type { GameNightArenaTheme } from "@/features/game-night/lib/gameNightArena";

// Game Night V2.7B (sectie 3) — "het hart van de arena": de foto van het
// daadwerkelijk opgebouwde spel, via resolveGameArenaTheme()'s eigen
// fallbackketen (setup -> cover -> placeholder). Bewust NIET fullscreen —
// de grootte (~25-40% van het scherm) komt uit de CSS
// (.gnv2-arena-center/.gnv2-setup-photo in styles.css), hier alleen het
// element zelf + de spel-naam/tagline-overlay.
export function ArenaSetupPhoto({
  gameName,
  theme,
}: {
  gameName: string;
  theme: GameNightArenaTheme;
}) {
  return (
    <div
      className="gnv2-setup-photo"
      data-arena-style={theme.style ?? "default"}
    >
      <div className="gnv2-setup-photo-glow" aria-hidden />
      <div className="gnv2-setup-photo-frame">
        {theme.setupImageUrl ? (
          <img src={theme.setupImageUrl} alt="" />
        ) : (
          <div
            className="gnv2-setup-photo-fallback"
            style={{ background: theme.placeholderGradient }}
          >
            <span>{gameName.charAt(0)}</span>
          </div>
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
