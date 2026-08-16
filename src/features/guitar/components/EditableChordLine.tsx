import { useEffect, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import {
  type ChordSheetLine,
  isChordOnlyLine,
  parseChordOnlyInput,
  serializeLine,
} from "@/features/guitar/lib/chordSheet";
import {
  type LyricsLine,
  addChordToChordOnlyLine,
  chordOnlyLineFromInput,
  removeChordTokenAt,
  setChordAtOffset,
  textToLine,
  tokenizeLineWords,
} from "@/features/guitar/lib/chordSheetEditor";
import { toDisplayNote } from "@/features/guitar/lib/transpose";
import { ChordPicker } from "./ChordPicker";

type EditableChordLineProps = {
  line: ChordSheetLine;
  originalKey?: string;
  recentChords: string[];
  onRecordRecent: (chord: string) => void;
  isWordSelected: (segIndex: number, offsetInSegment: number) => boolean;
  onSelectWord: (segIndex: number, offsetInSegment: number) => void;
  onDeselect: () => void;
  onCommitChord: (
    segIndex: number,
    offsetInSegment: number,
    chord: string | null,
  ) => void;
  onReplaceLine: (line: ChordSheetLine) => void;
  onInsertLineAfter: () => void;
  onInsertMultilineText: (lines: string[]) => void;
  onDuplicateLine: () => void;
  onRemoveLine: () => void;
};

// Eén regel binnen de visuele editor — drie verschijningsvormen (blank /
// chord-only / gewone lyricregel met klikbare woorden), plus een subtiele,
// alleen-bij-hover zichtbare toolbar voor regelbeheer (section 13). Tekst
// rechtstreeks bewerken (het potlood-icoon) toont de regel als bracket-tekst
// en hergebruikt bij het opslaan gewoon parseLyricLine (via textToLine) —
// geen aparte tekst-diff-logica om akkoordposities door willekeurige edits
// heen te "raden".
export function EditableChordLine({
  line,
  originalKey,
  recentChords,
  onRecordRecent,
  isWordSelected,
  onSelectWord,
  onDeselect,
  onCommitChord,
  onReplaceLine,
  onInsertLineAfter,
  onInsertMultilineText,
  onDuplicateLine,
  onRemoveLine,
}: EditableChordLineProps) {
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState("");

  function startTextEdit() {
    setTextDraft(line.type === "blank" ? "" : serializeLine(line));
    setEditingText(true);
  }

  function commitTextEdit() {
    onReplaceLine(textToLine(textDraft));
    setEditingText(false);
  }

  const toolbar = (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 shrink-0">
      <button
        type="button"
        onClick={startTextEdit}
        className="h-6 w-6 rounded-md flex items-center justify-center wa-muted hover:bg-[var(--wa-surface-strong)] hover:text-[var(--wa-text)]"
        aria-label="Tekst bewerken"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onDuplicateLine}
        className="h-6 w-6 rounded-md flex items-center justify-center wa-muted hover:bg-[var(--wa-surface-strong)] hover:text-[var(--wa-text)]"
        aria-label="Regel dupliceren"
        title="Dupliceren"
      >
        <Copy className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onInsertLineAfter}
        className="h-6 w-6 rounded-md flex items-center justify-center wa-muted hover:bg-[var(--wa-surface-strong)] hover:text-[var(--wa-text)]"
        aria-label="Regel toevoegen"
      >
        <Plus className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onRemoveLine}
        className="h-6 w-6 rounded-md flex items-center justify-center wa-muted hover:bg-[var(--wa-surface-strong)] hover:text-destructive"
        aria-label="Regel verwijderen"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );

  if (editingText) {
    return (
      <div className="flex items-center gap-2 group">
        <input
          autoFocus
          value={textDraft}
          onChange={(e) => setTextDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTextEdit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setEditingText(false);
            }
          }}
          onBlur={commitTextEdit}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (!pasted.includes("\n")) return;
            // Meerdere geplakte regels tegelijk (section 19) — i.p.v. ze tot
            // één regel te laten samenvouwen, elke regel als eigen lyricregel
            // invoegen (elk gaat gewoon weer door parseLyricLine/textToLine).
            e.preventDefault();
            onInsertMultilineText(pasted.split(/\r?\n/));
            setEditingText(false);
          }}
          placeholder="Tekst, evt. met [Akkoord]-notatie"
          className="flex-1 h-8 px-2.5 text-sm rounded-md font-mono"
        />
      </div>
    );
  }

  if (line.type === "blank") {
    return (
      <div className="flex items-center gap-2 group h-6">
        <button
          type="button"
          onClick={startTextEdit}
          className="flex-1 text-left wa-muted text-xs italic hover:text-[var(--wa-text)] transition-colors"
        >
          Tik om tekst toe te voegen…
        </button>
        {toolbar}
      </div>
    );
  }

  if (isChordOnlyLine(line)) {
    return (
      <div className="flex items-center gap-2 group">
        <div className="flex-1">
          <ChordOnlyLineEditor
            line={line}
            originalKey={originalKey}
            recentChords={recentChords}
            onRecordRecent={onRecordRecent}
            onReplaceLine={onReplaceLine}
          />
        </div>
        {toolbar}
      </div>
    );
  }

  const tokens = tokenizeLineWords(line);

  return (
    <div className="flex items-start gap-2 group">
      <div className="flex-1 flex flex-wrap items-start gap-y-3">
        {tokens.length === 0 && (
          <span className="wa-muted text-xs italic py-1">(lege regel)</span>
        )}
        {tokens.map((token) =>
          token.kind === "space" ? (
            <WhitespaceToken key={token.key} text={token.text} />
          ) : (
            <EditableWord
              key={token.key}
              text={token.text}
              chord={token.chord}
              originalKey={originalKey}
              recentChords={recentChords}
              onRecordRecent={onRecordRecent}
              isSelected={isWordSelected(token.segIndex, token.offsetInSegment)}
              onSelect={() =>
                onSelectWord(token.segIndex, token.offsetInSegment)
              }
              onDeselect={onDeselect}
              onCommit={(chord, advancedOffset) =>
                onCommitChord(
                  token.segIndex,
                  token.offsetInSegment + advancedOffset,
                  chord,
                )
              }
              onRemove={
                token.chord
                  ? () => onCommitChord(token.segIndex, 0, null)
                  : undefined
              }
            />
          ),
        )}
      </div>
      {toolbar}
    </div>
  );
}

function EditableWord({
  text,
  chord,
  originalKey,
  recentChords,
  onRecordRecent,
  isSelected,
  onSelect,
  onDeselect,
  onCommit,
  onRemove,
}: {
  text: string;
  chord: string | null;
  originalKey?: string;
  recentChords: string[];
  onRecordRecent: (chord: string) => void;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onCommit: (chord: string, advancedOffset: number) => void;
  onRemove?: () => void;
}) {
  const [advancedOffset, setAdvancedOffset] = useState(0);

  useEffect(() => {
    if (!isSelected) setAdvancedOffset(0);
  }, [isSelected]);

  return (
    <ChordPicker
      trigger={
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex flex-col items-start rounded-md px-1 -mx-1 py-0.5 transition-colors hover:bg-[var(--wa-surface-strong)]"
          style={
            isSelected ? { background: "var(--wa-accent-soft)" } : undefined
          }
        >
          <span className="wa-chord text-sm h-[1.25em] leading-none block">
            {chord ? toDisplayNote(chord) : ""}
          </span>
          <span className="wa-lyric text-base leading-snug">{text}</span>
        </button>
      }
      open={isSelected}
      onOpenChange={(open) => {
        if (!open) onDeselect();
      }}
      currentChord={chord}
      originalKey={originalKey}
      recentChords={recentChords}
      onCommit={(newChord) => {
        onCommit(newChord, advancedOffset);
        onRecordRecent(newChord);
        onDeselect();
      }}
      onRemove={
        onRemove
          ? () => {
              onRemove();
              onDeselect();
            }
          : undefined
      }
      onClose={onDeselect}
      word={
        !chord
          ? { text, offset: advancedOffset, onOffsetChange: setAdvancedOffset }
          : undefined
      }
    />
  );
}

/**
 * De letterlijke witruimte tussen twee woorden — niet klikbaar, geen akkoord-
 * target. Zelfde tweerijige opbouw (lege akkoordrij + tekstrij) als
 * EditableWord hierboven, puur zodat de tekstrij verticaal precies op de
 * lyricbaseline van de woorden ernaast uitkomt. `whitespace-pre` behoudt
 * meerdere spaties exact — dit is de daadwerkelijke brontekst, geen
 * CSS-gap-benadering.
 */
function WhitespaceToken({ text }: { text: string }) {
  return (
    <span className="inline-flex flex-col items-start py-0.5" aria-hidden>
      <span className="h-[1.25em] leading-none block" />
      <span className="wa-lyric text-base leading-snug whitespace-pre">
        {text}
      </span>
    </span>
  );
}

function ChordOnlyLineEditor({
  line,
  originalKey,
  recentChords,
  onRecordRecent,
  onReplaceLine,
}: {
  line: LyricsLine;
  originalKey?: string;
  recentChords: string[];
  onRecordRecent: (chord: string) => void;
  onReplaceLine: (line: ChordSheetLine) => void;
}) {
  const [quickInput, setQuickInput] = useState("");
  const [selectedSegIndex, setSelectedSegIndex] = useState<number | null>(null);

  function handleQuickAdd(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const tokens = parseChordOnlyInput(quickInput);
    if (tokens.length === 0) return;
    const hasExistingChords = line.segments.some((s) => s.chord);
    let next: ChordSheetLine = hasExistingChords
      ? line
      : chordOnlyLineFromInput(quickInput);
    if (hasExistingChords) {
      for (const token of tokens)
        next = addChordToChordOnlyLine(next as LyricsLine, token);
    }
    onReplaceLine(next);
    tokens.forEach(onRecordRecent);
    setQuickInput("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="wa-eyebrow !tracking-wider shrink-0">Akkoorden</span>
      {line.segments.map((seg, segIndex) =>
        seg.chord ? (
          <ChordPicker
            key={segIndex}
            trigger={
              <button
                type="button"
                onClick={() => setSelectedSegIndex(segIndex)}
                className="wa-chip h-7 px-2.5 text-xs"
              >
                {toDisplayNote(seg.chord)}
              </button>
            }
            open={selectedSegIndex === segIndex}
            onOpenChange={(open) => !open && setSelectedSegIndex(null)}
            currentChord={seg.chord}
            originalKey={originalKey}
            recentChords={recentChords}
            onCommit={(chord) => {
              onReplaceLine({
                type: "lyrics",
                segments: setChordAtOffset(line.segments, segIndex, 0, chord),
              });
              onRecordRecent(chord);
              setSelectedSegIndex(null);
            }}
            onRemove={() => {
              onReplaceLine(removeChordTokenAt(line, segIndex));
              setSelectedSegIndex(null);
            }}
            onClose={() => setSelectedSegIndex(null)}
          />
        ) : null,
      )}
      <input
        value={quickInput}
        onChange={(e) => setQuickInput(e.target.value)}
        onKeyDown={handleQuickAdd}
        placeholder="+ akkoord(en), bv. E B C#m A"
        className="h-7 w-44 px-2.5 text-xs rounded-md"
      />
    </div>
  );
}
