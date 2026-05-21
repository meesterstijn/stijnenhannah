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
        className="group rounded-2xl bg-card border border-border/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3 sm:min-h-[100px] w-full text-left"
      >
        <Music className="h-5 w-5 text-primary shrink-0" strokeWidth={1.6} />
        <div className="flex-1 min-w-0">
          <p className="font-serif text-base font-semibold leading-tight">Spotify</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">Verbind om muziek te zien</p>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {nowPlaying?.albumArt ? (
          <img src={nowPlaying.albumArt} alt="" className="h-10 w-10 rounded-lg shrink-0 object-cover" />
        ) : (
          <Music className="h-5 w-5 text-primary shrink-0" strokeWidth={1.6} />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-serif text-base font-semibold leading-tight truncate">
            {nowPlaying ? nowPlaying.trackName : "Spotify"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight truncate">
            {nowPlaying ? nowPlaying.artistName : "Niets aan het spelen"}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {nowPlaying && (
            <>
              <button
                onClick={(e) => { e.preventDefault(); if (!actionPending) { setActionPending(true); skipTrack("previous").then(() => setTimeout(() => { fetchNowPlaying(); setActionPending(false); }, 700)); } }}
                disabled={actionPending}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                aria-label="Vorige"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleToggle}
                disabled={actionPending}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
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
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                aria-label="Volgende"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={handleDisconnect}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/40 transition-colors"
            aria-label="Ontkoppel Spotify"
          >
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </div>

      {nowPlaying && (
        <div className="flex items-center gap-2">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="flex-1 h-1 accent-primary cursor-pointer"
            aria-label="Volume"
          />
          <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">{volume}</span>
        </div>
      )}
    </div>
  );
}
