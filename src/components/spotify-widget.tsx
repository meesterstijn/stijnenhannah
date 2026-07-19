import { useState, useEffect, useCallback, useRef } from "react";
import { Music, Play, Pause, SkipBack, SkipForward, LogOut, Volume2 } from "lucide-react";
import {
  initiateSpotifyLogin,
  isSpotifyConnected,
  clearSpotifyTokens,
  getNowPlaying,
  togglePlayback,
  skipTrack,
  setVolume,
  type NowPlaying,
} from "@/lib/spotify";

export function SpotifyWidget() {
  const [connected, setConnected] = useState(isSpotifyConnected);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [actionPending, setActionPending] = useState(false);
  const [volume, setVolumeState] = useState(50);
  const volumeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNowPlaying = useCallback(async () => {
    if (!isSpotifyConnected()) return;
    const result = await getNowPlaying();
    setNowPlaying(result);
    if (result) setVolumeState(result.volume);
  }, []);

  useEffect(() => {
    if (!connected) return;
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 10_000);
    return () => clearInterval(interval);
  }, [connected, fetchNowPlaying]);

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    if (!nowPlaying || actionPending) return;
    setActionPending(true);
    await togglePlayback(nowPlaying.isPlaying);
    setTimeout(() => { fetchNowPlaying(); setActionPending(false); }, 500);
  }

  async function handleSkip(e: React.MouseEvent) {
    e.preventDefault();
    if (actionPending) return;
    setActionPending(true);
    await skipTrack("next");
    setTimeout(() => { fetchNowPlaying(); setActionPending(false); }, 700);
  }

  function handleVolumeChange(value: number) {
    setVolumeState(value);
    if (volumeDebounce.current) clearTimeout(volumeDebounce.current);
    volumeDebounce.current = setTimeout(() => setVolume(value), 300);
  }

  function handleDisconnect(e: React.MouseEvent) {
    e.preventDefault();
    clearSpotifyTokens();
    setConnected(false);
    setNowPlaying(null);
  }

  if (!connected) {
    return (
      <button
        onClick={() => initiateSpotifyLogin()}
        className="sv-panel group p-4 hover:-translate-y-0.5 transition-transform flex items-center gap-3 sm:min-h-[100px] w-full text-left"
      >
        <div className="sv-icon-slot h-10 w-10 flex items-center justify-center shrink-0">
          <Music className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="sv-heading text-2xl leading-tight">Spotify</p>
          <p className="text-xs sv-muted mt-0.5 leading-tight">Verbind om muziek te zien</p>
        </div>
      </button>
    );
  }

  return (
    <div className="sv-panel p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {nowPlaying?.albumArt ? (
          <img src={nowPlaying.albumArt} alt="" className="sv-icon-slot h-10 w-10 rounded-lg shrink-0 object-cover" />
        ) : (
          <div className="sv-icon-slot h-10 w-10 flex items-center justify-center shrink-0">
            <Music className="h-5 w-5" strokeWidth={1.6} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="sv-heading text-2xl leading-tight truncate">
            {nowPlaying ? nowPlaying.trackName : "Spotify"}
          </p>
          <p className="text-xs sv-muted mt-0.5 leading-tight truncate">
            {nowPlaying ? nowPlaying.artistName : "Niets aan het spelen"}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {nowPlaying && (
            <>
              <button
                onClick={(e) => { e.preventDefault(); if (!actionPending) { setActionPending(true); skipTrack("previous").then(() => setTimeout(() => { fetchNowPlaying(); setActionPending(false); }, 700)); } }}
                disabled={actionPending}
                className="sv-icon-slot h-8 w-8 flex items-center justify-center transition-colors"
                aria-label="Vorige"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleToggle}
                disabled={actionPending}
                className="sv-icon-slot h-8 w-8 flex items-center justify-center transition-colors"
                aria-label={nowPlaying.isPlaying ? "Pauzeer" : "Speel af"}
              >
                {nowPlaying.isPlaying
                  ? <Pause className="h-3.5 w-3.5" />
                  : <Play className="h-3.5 w-3.5" />
                }
              </button>
              <button
                onClick={handleSkip}
                disabled={actionPending}
                className="sv-icon-slot h-8 w-8 flex items-center justify-center transition-colors"
                aria-label="Volgende"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={handleDisconnect}
            className="sv-icon-slot h-8 w-8 flex items-center justify-center transition-colors opacity-50"
            aria-label="Ontkoppel Spotify"
          >
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </div>

      {nowPlaying && (
        <div className="flex items-center gap-2">
          <Volume2 className="h-3.5 w-3.5 sv-muted shrink-0" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="flex-1 h-1 accent-primary cursor-pointer"
            aria-label="Volume"
          />
          <span className="text-xs sv-muted w-6 text-right tabular-nums">{volume}</span>
        </div>
      )}
    </div>
  );
}
