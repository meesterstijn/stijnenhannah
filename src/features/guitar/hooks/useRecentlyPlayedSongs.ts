// "Recent gespeeld" is bewust per-device/lokaal (localStorage, zelfde
// patroon als useLocalStorage elders in de app) i.p.v. een aparte
// Supabase-tabel: het is precies zo persoonlijk als "recently played" in elke
// muziek-app (per toestel), en een tabel + RLS + realtime-sync zou voor deze
// puur cosmetische lijst duidelijke overkill zijn t.o.v. wat er gevraagd is.

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useGuitarSongs } from "./useGuitarSongs";
import type { GuitarSongWithAlbum } from "@/lib/supabase";

const STORAGE_KEY = "guitar-recently-played";
const MAX_ENTRIES = 20;

type RecentEntry = { songId: string; playedAt: string };

export function useRecentlyPlayedIds() {
  const [entries, setEntries] = useLocalStorage<RecentEntry[]>(STORAGE_KEY, []);

  const recordPlay = useCallback(
    (songId: string) => {
      setEntries((prev) => {
        const withoutCurrent = prev.filter((e) => e.songId !== songId);
        return [
          { songId, playedAt: new Date().toISOString() },
          ...withoutCurrent,
        ].slice(0, MAX_ENTRIES);
      });
    },
    [setEntries],
  );

  return { entries, recordPlay };
}

/** Resolvet de lokale recency-lijst naar volledige songobjecten, in
 * recency-volgorde, incl. join op album voor cover/artiest-weergave. */
export function useRecentlyPlayedGuitarSongs(limit?: number) {
  const { entries } = useRecentlyPlayedIds();
  const { data: songs = [], isLoading } = useGuitarSongs();

  const resolved = useMemo(() => {
    const byId = new Map(songs.map((s) => [s.id, s]));
    const result: GuitarSongWithAlbum[] = [];
    for (const entry of entries) {
      const song = byId.get(entry.songId);
      if (song) result.push(song);
    }
    return typeof limit === "number" ? result.slice(0, limit) : result;
  }, [entries, songs, limit]);

  return { data: resolved, isLoading };
}
