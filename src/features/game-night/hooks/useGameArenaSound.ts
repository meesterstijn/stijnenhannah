import { useCallback, useState } from "react";
import {
  playUndoSound,
  playWinSound,
} from "@/features/game-night/lib/gameNightArenaSound";

// Game Night V2.7B (sectie 10) — globale "geluidseffecten aan/uit"-voorkeur.
// localStorage i.p.v. een databaseveld: dit betreft geen identiteit/data
// ("we willen geen migratie voor deze voorkeur", sectie 10) en is
// bewust per-apparaat (het tablet dat op tafel ligt), niet per-account.
const STORAGE_KEY = "game-night-arena-sound-enabled";

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === null ? true : raw === "true";
}

export function useGameArenaSound() {
  const [enabled, setEnabled] = useState(readStoredPreference);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const playWin = useCallback(() => {
    if (enabled) playWinSound();
  }, [enabled]);

  const playUndo = useCallback(() => {
    if (enabled) playUndoSound();
  }, [enabled]);

  return { enabled, toggle, playWin, playUndo };
}
