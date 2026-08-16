import { Minus, Plus, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAPO_OPTIONS,
  displayedOriginalKey,
  playKey,
  toDisplayNote,
} from "@/features/guitar/lib/transpose";

// De kernuitleg uit section 7/11: Original (klinkende toonhoogte, evt. na
// handmatig transponeren) -> Capo -> Play (de akkoordvormen die de gitarist
// daadwerkelijk grijpt). Alle drie worden hier live herberekend — nooit
// vanuit een los stukje state dat uit sync kan raken met de daadwerkelijke
// transpositie.
export function KeyCapoBar({
  originalKey,
  transposeOffset,
  capo,
  onTransposeChange,
  onCapoChange,
  preferFlat,
}: {
  originalKey: string;
  transposeOffset: number;
  capo: number;
  onTransposeChange: (value: number) => void;
  onCapoChange: (value: number) => void;
  preferFlat?: boolean;
}) {
  const original = displayedOriginalKey(
    originalKey,
    transposeOffset,
    preferFlat,
  );
  const play = playKey(originalKey, transposeOffset, capo, preferFlat);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-3 border-b border-[var(--wa-border)]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base">
        <span className="wa-eyebrow !tracking-wider">Original</span>
        <span className="wa-chord">{toDisplayNote(original)}</span>
        {capo > 0 && (
          <>
            <ArrowRight className="h-3.5 w-3.5 wa-muted" strokeWidth={1.8} />
            <span className="wa-eyebrow !tracking-wider">Capo {capo}</span>
            <ArrowRight className="h-3.5 w-3.5 wa-muted" strokeWidth={1.8} />
            <span className="wa-eyebrow !tracking-wider">Play</span>
            <span className="wa-chord">{toDisplayNote(play)}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 sm:ml-auto">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTransposeChange(transposeOffset - 1)}
            className="wa-button-ghost h-8 w-8"
            aria-label="Transponeer lager"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          {transposeOffset !== 0 && (
            <button
              type="button"
              onClick={() => onTransposeChange(0)}
              className="wa-muted text-xs px-1 hover:underline underline-offset-2"
            >
              reset
            </button>
          )}
          <button
            type="button"
            onClick={() => onTransposeChange(transposeOffset + 1)}
            className="wa-button-ghost h-8 w-8"
            aria-label="Transponeer hoger"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <Select
          value={String(capo)}
          onValueChange={(v) => onCapoChange(Number(v))}
        >
          <SelectTrigger className="h-8 w-[92px] text-xs !bg-[var(--wa-surface)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="guitar-theme">
            {CAPO_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                Capo {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
