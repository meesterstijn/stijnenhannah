import { Minus, Plus } from "lucide-react";
import {
  displayedOriginalKey,
  playKey,
  toDisplayNote,
} from "@/features/guitar/lib/transpose";
import type { useAutoScroll } from "@/features/guitar/hooks/useAutoScroll";

// De vaste, compacte bediening tijdens het spelen (section 12):
// "−  F♯  +        CAPO 2 · PLAY E        AUTO". Capo zelf wijzig je hier
// bewust niet — dat gebeurt via KeyCapoBar buiten de speelmodus; hier alleen
// het essentiële minimum: transponeren en autoscroll.
export function PlayModeBar({
  originalKey,
  transposeOffset,
  capo,
  onTransposeChange,
  preferFlat,
  autoScroll,
}: {
  originalKey: string;
  transposeOffset: number;
  capo: number;
  onTransposeChange: (value: number) => void;
  preferFlat?: boolean;
  autoScroll: ReturnType<typeof useAutoScroll>;
}) {
  const original = displayedOriginalKey(
    originalKey,
    transposeOffset,
    preferFlat,
  );
  const play = playKey(originalKey, transposeOffset, capo, preferFlat);

  return (
    <div className="wa-play-bar flex items-center gap-0.5 px-2 py-1.5 sm:px-2.5">
      <button
        type="button"
        onClick={() => onTransposeChange(transposeOffset - 1)}
        className="wa-button-ghost h-10 w-10 !border-0 !bg-transparent"
        aria-label="Transponeer lager"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="wa-chord text-base sm:text-lg w-11 text-center shrink-0">
        {toDisplayNote(original)}
      </span>
      <button
        type="button"
        onClick={() => onTransposeChange(transposeOffset + 1)}
        className="wa-button-ghost h-10 w-10 !border-0 !bg-transparent"
        aria-label="Transponeer hoger"
      >
        <Plus className="h-4 w-4" />
      </button>

      <span className="wa-muted text-[11px] sm:text-xs px-2.5 sm:px-4 whitespace-nowrap">
        CAPO {capo} · PLAY {toDisplayNote(play)}
      </span>

      <button
        type="button"
        onClick={autoScroll.active ? autoScroll.stop : autoScroll.start}
        className={`wa-chip !border-0 h-10 px-4 text-xs font-semibold ${autoScroll.active ? "active" : ""}`}
      >
        AUTO
      </button>
      {autoScroll.active && (
        <button
          type="button"
          onClick={autoScroll.cycleSpeed}
          className="wa-muted text-[11px] pl-2 pr-1 whitespace-nowrap"
          aria-label="Autoscroll-snelheid wijzigen"
        >
          {autoScroll.speedLabel}
        </button>
      )}
    </div>
  );
}
