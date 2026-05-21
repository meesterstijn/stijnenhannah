import { useState, useEffect, useCallback } from "react";
import { Music, Play, Pause, SkipForward, LogOut } from "lucide-react";
import {
  initiateSpotifyLogin,
  isSpotifyConnected,
  clearSpotifyTokens,
  getNowPlaying,
  togglePlayback,
  skipTrack,
  type NowPlaying,
} from "@/lib/spotify";

export function SpotifyWidget() {
  const [connected, setConnected] = useState(isSpotifyConnected);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [actionPending, setActionPending] = useState(false);

  const fetchNowPlaying = useCallback(async () => {
    if (!isSpotifyConnected()) return;
    const result = await getNowPlaying();
    setNowPlaying(result);
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
    <div className="group rounded-2xl bg-card border border-border/60 p-4 shadow-sm flex items-center gap-3 sm:min-h-[100px]">
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
  );
}
