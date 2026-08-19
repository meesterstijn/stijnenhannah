import { useCallback, useEffect, useState } from "react";
import {
  initiateSpotifyLogin,
  isSpotifyConnected,
  getNowPlaying,
  togglePlayback,
  skipTrack,
  type NowPlaying,
} from "@/lib/spotify";

// Game Night V2.7B — de Spotify-status/-acties uit GameNightNowPlaying.tsx
// geëxtraheerd naar een gedeelde hook, zodat zowel de bestaande (legacy,
// brass-styled) GameNightNowPlaying-component ALS het nieuwe .gnv2-*
// Game-Arena-paneel (ArenaSpotifyPanel.tsx) exact dezelfde onderliggende
// PKCE-auth/tokens/polling-logica hergebruiken (sectie 27: "Hergebruik
// bestaande GameNightNowPlaying/spotify.ts/tokens/controls. Geen
// OAuth-wijziging.") — alleen de PRESENTATIE mag per component verschillen,
// nooit de logica zelf. Gedrag is bewust 1-op-1 hetzelfde als vóór deze
// extractie: polling elke 10s zolang `connected`, dezelfde 500/700ms
// optimistic-refetch-vertraging na toggle/skip.
export function useSpotifyNowPlaying() {
  const [connected, setConnected] = useState(isSpotifyConnected);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const fetchNowPlaying = useCallback(async () => {
    if (!isSpotifyConnected()) return;
    const result = await getNowPlaying();
    setNowPlaying(result);
    setHasFetchedOnce(true);
  }, []);

  useEffect(() => {
    if (!connected) return;
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 10_000);
    return () => clearInterval(interval);
  }, [connected, fetchNowPlaying]);

  async function connect() {
    await initiateSpotifyLogin();
    setConnected(true);
  }

  async function toggle() {
    if (!nowPlaying || actionPending) return;
    setActionPending(true);
    await togglePlayback(nowPlaying.isPlaying);
    setTimeout(() => {
      fetchNowPlaying();
      setActionPending(false);
    }, 500);
  }

  async function skip(direction: "next" | "previous") {
    if (actionPending) return;
    setActionPending(true);
    await skipTrack(direction);
    setTimeout(() => {
      fetchNowPlaying();
      setActionPending(false);
    }, 700);
  }

  return {
    connected,
    nowPlaying,
    hasFetchedOnce,
    actionPending,
    connect,
    toggle,
    skip,
  };
}
