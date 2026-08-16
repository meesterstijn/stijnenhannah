import { useEffect, useRef, useState } from "react";
import { Columns2, Maximize2, Minimize2, X } from "lucide-react";
import { ChordSheetView } from "./ChordSheetView";
import { PlayModeBar } from "./PlayModeBar";
import { useAutoScroll } from "@/features/guitar/hooks/useAutoScroll";
import { useWakeLock } from "@/features/guitar/hooks/useWakeLock";
import type { ChordSheetSection } from "@/features/guitar/lib/chordSheet";

// Speelmodus (section 12): zoveel mogelijk interface weg, grote leesbare
// lyrics, vaste compacte bediening die met één tik op de songtekst zelf te
// verbergen/tonen is. `position: fixed; inset: 0` i.p.v. een aparte route —
// dat laat de speelmodus de sidebar/pagina-breedte van GitaarLayout volledig
// negeren zonder dat er een aparte layoutboom nodig is, en behoudt song-state
// in de ouder (GitaarSong) bij het sluiten.
export function GuitarPlayMode({
  title,
  artist,
  sections,
  originalKey,
  transposeOffset,
  capo,
  onTransposeChange,
  onExit,
  preferFlat,
}: {
  title: string;
  artist: string;
  sections: ChordSheetSection[];
  originalKey: string;
  transposeOffset: number;
  capo: number;
  onTransposeChange: (value: number) => void;
  onExit: () => void;
  preferFlat?: boolean;
}) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [columns, setColumns] = useState<1 | 2>(1);
  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const wakeLock = useWakeLock();
  const autoScroll = useAutoScroll(scrollRef);

  const fullscreenSupported =
    typeof document.documentElement.requestFullscreen === "function";

  useEffect(() => {
    wakeLock.request();
    return () => {
      wakeLock.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Escape sluit de speelmodus — vooral prettig als de gebruiker net uit
  // fullscreen kwam (browser-Escape sluit dan al fullscreen, een tweede
  // druk sluit ook de speelmodus zelf).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !document.fullscreenElement) onExit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Sommige browsers/embedded webviews weigeren fullscreen-verzoeken
      // (bv. zonder directe user-gesture-context) — dan blijft de speelmodus
      // gewoon werken zonder fullscreen, geen foutmelding nodig.
    }
  }

  return (
    <div className="guitar-theme wa-play-surface fixed inset-0 z-50 flex flex-col text-[var(--wa-text)]">
      <div
        className={`shrink-0 flex items-center justify-between gap-3 px-4 sm:px-8 py-4 transition-opacity duration-200 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="min-w-0">
          <p className="text-lg sm:text-xl font-semibold tracking-tight truncate">
            {title}
          </p>
          <p className="wa-muted text-xs sm:text-sm truncate">{artist}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setColumns((c) => (c === 1 ? 2 : 1))}
            className={`wa-button-ghost h-9 w-9 hidden lg:inline-flex ${columns === 2 ? "active" : ""}`}
            aria-label="Twee kolommen wisselen"
          >
            <Columns2 className="h-4 w-4" />
          </button>
          {fullscreenSupported && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="wa-button-ghost h-9 w-9"
              aria-label={
                isFullscreen ? "Volledig scherm afsluiten" : "Volledig scherm"
              }
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="wa-button-ghost h-9 w-9"
            aria-label="Speelmodus sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onClick={() => setControlsVisible((v) => !v)}
        className="flex-1 overflow-y-auto px-5 sm:px-10 pb-36 pt-2"
      >
        <ChordSheetView sections={sections} columns={columns} size="play" />
      </div>

      <div
        className={`fixed inset-x-0 bottom-5 flex justify-center px-4 transition-all duration-200 ${
          controlsVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <PlayModeBar
          originalKey={originalKey}
          transposeOffset={transposeOffset}
          capo={capo}
          onTransposeChange={onTransposeChange}
          preferFlat={preferFlat}
          autoScroll={autoScroll}
        />
      </div>
    </div>
  );
}
