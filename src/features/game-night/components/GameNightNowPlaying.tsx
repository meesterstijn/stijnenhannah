import { useCallback, useEffect, useState } from "react";
import { Music, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import {
  initiateSpotifyLogin,
  isSpotifyConnected,
  getNowPlaying,
  togglePlayback,
  skipTrack,
  type NowPlaying,
} from "@/lib/spotify";

// Compact "fysiek muziekkaartje" tijdens een actieve Game Night (sectie
// 22). Hergebruikt bewust de BESTAANDE Spotify-koppeling (src/lib/spotify.ts
// — dezelfde PKCE-authenticatie/tokens/refresh-logica als de widget op de
// hoofdpagina, src/components/spotify-widget.tsx) i.p.v. een tweede OAuth-
// flow te bouwen. Alleen de presentatie is nieuw (gn-*-styling i.p.v.
// sv-*), de onderliggende service/token-laag is exact hetzelfde bestand.
//
// Sectie 23: Spotify is ambiance, geen kernfunctionaliteit — elke fout/
// afwezige koppeling/geen actief device resulteert hier hooguit in een
// onopvallende staat, nooit in een geblokkeerde Game Night. Bestaande
// foutafhandeling van lib/spotify.ts (getNowPlaying geeft null terug bij
// elke fout) wordt hier één-op-één overgenomen.
export function GameNightNowPlaying() {
  const [connected, setConnected] = useState(isSpotifyConnected);
  const [expanded, setExpanded] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [actionPending, setActionPending] = useState(false);

  const fetchNowPlaying = useCallback(async () => {
    if (!isSpotifyConnected()) return;
    setNowPlaying(await getNowPlaying());
  }, []);

  useEffect(() => {
    if (!connected) return;
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 10_000);
    return () => clearInterval(interval);
  }, [connected, fetchNowPlaying]);

  async function handleToggle() {
    if (!nowPlaying || actionPending) return;
    setActionPending(true);
    await togglePlayback(nowPlaying.isPlaying);
    setTimeout(() => {
      fetchNowPlaying();
      setActionPending(false);
    }, 500);
  }

  async function handleSkip(direction: "next" | "previous") {
    if (actionPending) return;
    setActionPending(true);
    await skipTrack(direction);
    setTimeout(() => {
      fetchNowPlaying();
      setActionPending(false);
    }, 700);
  }

  if (!connected) {
    return (
      <button
        type="button"
        onClick={() => initiateSpotifyLogin().then(() => setConnected(true))}
        className="gn-nowplaying-collapsed"
        aria-label="Spotify verbinden"
        title="Spotify verbinden"
      >
        <Music className="h-4 w-4" strokeWidth={1.7} />
      </button>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="gn-nowplaying-collapsed"
        aria-label="Now Playing tonen"
        title="Now Playing"
      >
        {nowPlaying?.albumArt ? (
          <img
            src={nowPlaying.albumArt}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <Music className="h-4 w-4" strokeWidth={1.7} />
        )}
      </button>
    );
  }

  return (
    <div className="gn-nowplaying-card">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="gn-eyebrow mb-2 flex items-center gap-1.5"
      >
        <Music className="h-3 w-3" /> Now Playing
      </button>

      <div className="flex items-center gap-2.5">
        {nowPlaying?.albumArt ? (
          <img
            src={nowPlaying.albumArt}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--gn-brass-soft)" }}
          >
            <Music className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {nowPlaying?.trackName ?? "Niets aan het spelen"}
          </p>
          <p className="gn-faint truncate text-xs">
            {nowPlaying?.artistName ?? "Speel iets af op Spotify"}
          </p>
        </div>
      </div>

      {nowPlaying && (
        <div className="mt-2.5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => handleSkip("previous")}
            disabled={actionPending}
            className="gn-topnav-icon-btn"
            aria-label="Vorige"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggle}
            disabled={actionPending}
            className="gn-topnav-icon-btn"
            aria-label={nowPlaying.isPlaying ? "Pauzeer" : "Speel af"}
          >
            {nowPlaying.isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSkip("next")}
            disabled={actionPending}
            className="gn-topnav-icon-btn"
            aria-label="Volgende"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
