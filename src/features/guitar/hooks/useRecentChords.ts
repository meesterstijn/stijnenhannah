// "Recent gebruikte akkoorden" in de chord picker — lokaal per toestel,
// zelfde patroon als useRecentlyPlayedSongs.ts (localStorage via
// useLocalStorage). Geen databasewijziging nodig, section 10 vraagt dit
// expliciet alleen als er nog geen betere bestaande opslag is — die is er
// niet, dus dit is de lichtste passende oplossing.

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

const STORAGE_KEY = "guitar-recent-chords";
const MAX_RECENT = 10;

export function useRecentChords() {
  const [recent, setRecent] = useLocalStorage<string[]>(STORAGE_KEY, []);

  const recordChord = useCallback(
    (chord: string) => {
      const trimmed = chord.trim();
      if (!trimmed) return;
      setRecent((prev) =>
        [trimmed, ...prev.filter((c) => c !== trimmed)].slice(0, MAX_RECENT),
      );
    },
    [setRecent],
  );

  return { recent, recordChord };
}
