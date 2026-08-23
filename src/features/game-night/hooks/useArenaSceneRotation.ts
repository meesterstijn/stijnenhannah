import { useEffect, useState } from "react";

// Game Night V2.10.5 (Arena Fase 1) — cyclet rustig door een vaste
// volgorde scène-id's (sectie "automatische scènerotatie": "geen drukke
// slideshow", "iedere 25-40 seconden"). Puur round-robin door de
// meegegeven array, GEEN willekeur (voorspelbaar, testbaar). `paused`
// bevriest de rotatie (bv. tijdens de Winner Spotlight) zonder de timer te
// resetten zodra 'm weer verdergaat. Als de beschikbare scènes-array van
// grootte wisselt (bv. de rivaliteit-scène verschijnt/verdwijnt doordat er
// een nieuwe WIN bijkomt) wordt de index defensief geclampt i.p.v. te
// verwijzen naar een niet-bestaande entry.
export function useArenaSceneRotation<T extends string>(
  sceneIds: readonly T[],
  options: { intervalMs: number; paused: boolean },
): T {
  const { intervalMs, paused } = options;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= sceneIds.length) setIndex(0);
  }, [sceneIds.length, index]);

  useEffect(() => {
    if (paused || sceneIds.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % sceneIds.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [paused, sceneIds.length, intervalMs]);

  return sceneIds[index] ?? sceneIds[0];
}
