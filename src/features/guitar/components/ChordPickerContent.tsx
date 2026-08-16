import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  diatonicChordsForKey,
  toDisplayNote,
} from "@/features/guitar/lib/transpose";
import {
  isRecognizedChord,
  suggestChords,
} from "@/features/guitar/lib/chordSheetEditor";

const QUICK_ROOTS = ["C", "D", "E", "F", "G", "A", "B"];

export type ChordPickerContentProps = {
  currentChord: string | null;
  originalKey?: string;
  recentChords: string[];
  onCommit: (chord: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  /** Alleen aanwezig wanneer een akkoord aan een specifiek woord gekoppeld
   * wordt — voedt de "Precieze positie"-optie uit section 5. */
  word?: {
    text: string;
    offset: number;
    onOffsetChange: (offset: number) => void;
  };
};

// Gedeelde inhoud van de chord picker — desktop (Popover) en mobiel (Sheet)
// renderen dit exact dezelfde component, alleen de omhullende container
// verschilt (zie ChordPicker.tsx). Zo blijft gedrag/logica op één plek.
export function ChordPickerContent({
  currentChord,
  originalKey,
  recentChords,
  onCommit,
  onRemove,
  onClose,
  word,
}: ChordPickerContentProps) {
  const [value, setValue] = useState(currentChord ?? "");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const suggestions = suggestChords(value).filter((s) => s !== value);
  const inKey = originalKey ? diatonicChordsForKey(originalKey) : [];
  const trimmed = value.trim();
  const recognized = trimmed === "" || isRecognizedChord(trimmed);

  function commit(chord: string) {
    const clean = chord.trim();
    if (!clean) return;
    onCommit(clean);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Akkoord, bv. Esus4"
          className={`w-full h-10 px-3 text-sm font-medium rounded-lg ${!recognized ? "text-amber-600" : ""}`}
        />
        {!recognized && (
          <p className="wa-muted text-[11px] mt-1">
            Onbekende notatie — wordt wel opgeslagen zoals getypt.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_ROOTS.map((root) => (
          <button
            key={root}
            type="button"
            onClick={() => {
              setValue(root);
              inputRef.current?.focus();
            }}
            className="wa-chip h-7 px-2.5 text-xs"
          >
            {root}
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="wa-chip h-7 px-2.5 text-xs"
            >
              {toDisplayNote(s)}
            </button>
          ))}
        </div>
      )}

      {recentChords.length > 0 && (
        <div className="space-y-1.5">
          <p className="wa-eyebrow">Recent</p>
          <div className="flex flex-wrap gap-1.5">
            {recentChords.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => commit(c)}
                className="wa-chip h-7 px-2.5 text-xs"
              >
                {toDisplayNote(c)}
              </button>
            ))}
          </div>
        </div>
      )}

      {inKey.length > 0 && (
        <div className="space-y-1.5">
          <p className="wa-eyebrow">In key</p>
          <div className="flex flex-wrap gap-1.5">
            {inKey.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => commit(c)}
                className="wa-chip h-7 px-2.5 text-xs"
              >
                {toDisplayNote(c)}
              </button>
            ))}
          </div>
        </div>
      )}

      {word && (
        <div className="space-y-1.5 border-t border-[var(--wa-border)] pt-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="wa-muted text-[11px] hover:text-[var(--wa-text)] underline underline-offset-2"
          >
            Precieze positie
          </button>
          {advancedOpen && (
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-sm">
                {word.text.slice(0, word.offset)}
                <span className="wa-chord">|</span>
                {word.text.slice(word.offset)}
              </p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: word.text.length + 1 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => word.onOffsetChange(i)}
                    className={`h-5 w-5 rounded text-[10px] flex items-center justify-center transition-colors ${
                      i === word.offset
                        ? "font-semibold"
                        : "wa-muted hover:bg-[var(--wa-surface-strong)]"
                    }`}
                    style={
                      i === word.offset
                        ? {
                            background: "var(--wa-accent-soft)",
                            color: "var(--wa-accent-soft-text)",
                          }
                        : undefined
                    }
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 text-xs text-destructive hover:underline underline-offset-2"
          >
            <Trash2 className="h-3.5 w-3.5" /> Verwijder akkoord
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => commit(value)}
          className="wa-button h-8 px-4 text-xs"
          disabled={!trimmed}
        >
          {currentChord ? "Opslaan" : "Toevoegen"}
        </button>
      </div>
    </div>
  );
}
