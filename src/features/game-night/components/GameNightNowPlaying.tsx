import { Music, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useSpotifyNowPlaying } from "@/features/game-night/hooks/useSpotifyNowPlaying";

// Ingebouwde playback-controller tijdens een actieve Game Night (correctie:
// "Spotify ombouwen naar controller") — hergebruikt uitsluitend de
// BESTAANDE Spotify-koppeling (src/lib/spotify.ts: zelfde PKCE-auth/tokens/
// refresh-logica als src/components/spotify-widget.tsx op de hoofdpagina).
// Geen tweede OAuth, geen nieuwe tokenopslag, geen nieuwe Spotify-app.
//
// Game Night V2.7B: de eigenlijke status/acties zijn geëxtraheerd naar
// useSpotifyNowPlaying (zie dat bestand) zodat het nieuwe .gnv2-*
// Game-Arena-paneel (ArenaSpotifyPanel.tsx) exact dezelfde logica kan
// hergebruiken zonder deze legacy brass-styling over te nemen — dit
// bestand blijft ONGEWIJZIGD in gedrag/uiterlijk, het is nu alleen een
// dunne presentatielaag over die hook. Nog steeds nodig voor de legacy
// Live Play-fallback (niet-win_events-sessies), dus niet verwijderd.
export function GameNightNowPlaying() {
  const {
    connected,
    nowPlaying,
    hasFetchedOnce,
    actionPending,
    connect,
    toggle,
    skip,
  } = useSpotifyNowPlaying();

  if (!connected) {
    return (
      <div className="gn-nowplaying-card gn-nowplaying-card-compact">
        <span className="gn-eyebrow gn-nowplaying-eyebrow">Muziek</span>
        <p className="gn-faint text-xs">Spotify niet verbonden</p>
        <button
          type="button"
          onClick={() => connect()}
          className="gn-button mt-2 flex min-h-[44px] w-full items-center justify-center px-4 text-xs"
        >
          Spotify koppelen
        </button>
      </div>
    );
  }

  if (!hasFetchedOnce) {
    return (
      <div className="gn-nowplaying-card gn-nowplaying-card-compact">
        <span className="gn-eyebrow gn-nowplaying-eyebrow">Muziek</span>
        <Music className="gn-faint h-4 w-4" strokeWidth={1.7} />
      </div>
    );
  }

  if (!nowPlaying) {
    return (
      <div className="gn-nowplaying-card gn-nowplaying-card-compact">
        <span className="gn-eyebrow gn-nowplaying-eyebrow">Muziek</span>
        <p className="text-xs font-medium">Geen actief apparaat</p>
        <p className="gn-faint mt-1 text-xs leading-snug">
          Open Spotify op een apparaat
        </p>
      </div>
    );
  }

  return (
    <div className="gn-nowplaying-card">
      <span className="gn-eyebrow gn-nowplaying-eyebrow">Muziek</span>
      <div className="flex items-center gap-2.5">
        {nowPlaying.albumArt ? (
          <img
            src={nowPlaying.albumArt}
            alt=""
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--gn-brass-soft)" }}
          >
            <Music className="h-5 w-5" style={{ color: "var(--gn-brass)" }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {nowPlaying.trackName}
          </p>
          <p className="gn-faint truncate text-xs">{nowPlaying.artistName}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => skip("previous")}
          disabled={actionPending}
          className="gn-nowplaying-btn"
          aria-label="Vorige"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => toggle()}
          disabled={actionPending}
          className="gn-nowplaying-btn gn-nowplaying-btn-primary"
          aria-label={nowPlaying.isPlaying ? "Pauzeer" : "Speel af"}
        >
          {nowPlaying.isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => skip("next")}
          disabled={actionPending}
          className="gn-nowplaying-btn"
          aria-label="Volgende"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
