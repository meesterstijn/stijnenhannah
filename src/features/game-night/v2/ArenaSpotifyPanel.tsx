import { Music, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useSpotifyNowPlaying } from "@/features/game-night/hooks/useSpotifyNowPlaying";

// Game Night V2.7B (sectie 27) — GNV2-eigen Spotify-paneel: zelfde
// onderliggende hook/logica als de legacy GameNightNowPlaying (geen tweede
// OAuth, geen nieuwe tokenopslag), maar met een frisse .gnv2-* presentatie
// zodat het muziekicoon in de Arena nooit terugvalt op de oude
// messing/brass-styling. Zweeft als compact floating paneel over de arena
// (sectie 1: geen hout/messing in de actieve V2-flow).
export function ArenaSpotifyPanel({ onClose }: { onClose: () => void }) {
  const {
    connected,
    nowPlaying,
    hasFetchedOnce,
    actionPending,
    connect,
    toggle,
    skip,
  } = useSpotifyNowPlaying();

  return (
    <div className="gnv2-spotify-panel">
      <div className="gnv2-spotify-panel-header">
        <span className="gnv2-tray-label" style={{ marginBottom: 0 }}>
          Muziek
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="gnv2-icon-btn"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!connected ? (
        <div className="gnv2-spotify-panel-body">
          <p
            className="gnv2-preview-warning"
            style={{ color: "var(--gnv2-text-muted)" }}
          >
            Spotify niet verbonden
          </p>
          <button
            type="button"
            onClick={() => connect()}
            className="gnv2-btn gnv2-btn-ghost"
          >
            Spotify koppelen
          </button>
        </div>
      ) : !hasFetchedOnce ? (
        <div className="gnv2-spotify-panel-body">
          <Music
            className="h-5 w-5"
            style={{ color: "var(--gnv2-text-faint)" }}
          />
        </div>
      ) : !nowPlaying ? (
        <div className="gnv2-spotify-panel-body">
          <p
            className="gnv2-preview-warning"
            style={{ color: "var(--gnv2-text-muted)" }}
          >
            Geen actief apparaat
          </p>
          <p className="gnv2-lib-card-meta" style={{ padding: 0 }}>
            Open Spotify op een apparaat
          </p>
        </div>
      ) : (
        <>
          <div className="gnv2-spotify-track">
            {nowPlaying.albumArt ? (
              <img src={nowPlaying.albumArt} alt="" />
            ) : (
              <div className="gnv2-spotify-track-fallback">
                <Music className="h-5 w-5" />
              </div>
            )}
            <div className="gnv2-spotify-track-info">
              <p className="gnv2-spotify-track-name">{nowPlaying.trackName}</p>
              <p className="gnv2-spotify-track-artist">
                {nowPlaying.artistName}
              </p>
            </div>
          </div>

          <div className="gnv2-spotify-controls">
            <button
              type="button"
              onClick={() => skip("previous")}
              disabled={actionPending}
              className="gnv2-nav-btn"
              aria-label="Vorige"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => toggle()}
              disabled={actionPending}
              className="gnv2-nav-btn gnv2-spotify-play"
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
              className="gnv2-nav-btn"
              aria-label="Volgende"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
