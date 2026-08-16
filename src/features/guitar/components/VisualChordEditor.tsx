import { useEffect, useRef, useState } from "react";
import {
  parseChordSheet,
  serializeChordSheet,
  type ChordSheetLine,
} from "@/features/guitar/lib/chordSheet";
import {
  createEmptySection,
  duplicateLineAt as libDuplicateLineAt,
  duplicateSection as libDuplicateSection,
  flattenWordRefs,
  insertLineAfter as libInsertLineAfter,
  insertSectionAfter as libInsertSectionAfter,
  moveSectionAt as libMoveSectionAt,
  removeLineAt as libRemoveLineAt,
  removeSectionAt as libRemoveSectionAt,
  renameSectionAt as libRenameSectionAt,
  replaceLineAt as libReplaceLineAt,
  setWordChord,
  textToLine,
} from "@/features/guitar/lib/chordSheetEditor";
import { useRecentChords } from "@/features/guitar/hooks/useRecentChords";
import { EditableSection, AddSectionInline } from "./EditableSection";

type SelectedWord = {
  sectionIndex: number;
  lineIndex: number;
  segIndex: number;
  offsetInSegment: number;
};

// Orchestreert de volledige visuele akkoordeditor: houdt het geparste
// ChordSheetSection[]-model bij, past mutaties uit chordSheetEditor.ts toe,
// en emit steeds de opnieuw geserialiseerde bracket-content naar de ouder
// (section 27: `content` blijft de enige bron van waarheid — deze component
// heeft zelf geen eigen opslag). Undo/redo werkt op content-string-snapshots
// i.p.v. op het geparste model, dat is robuuster (geen structurele
// object-vergelijking nodig) en sluit aan bij "content is bron van waarheid".
export function VisualChordEditor({
  value,
  onChange,
  originalKey,
}: {
  value: string;
  onChange: (content: string) => void;
  originalKey?: string;
}) {
  const [sections, setSections] = useState(() => parseChordSheet(value));
  const [selected, setSelected] = useState<SelectedWord | null>(null);
  const lastEmittedRef = useRef(value);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const { recent, recordChord } = useRecentChords();

  // Externe wijziging (bv. plakken in Bron-modus, of wisselen tussen
  // nummers) opnieuw parsen — section 20. Alleen wanneer de waarde niet van
  // onszelf komt, anders zou elke eigen wijziging zichzelf resetten.
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setSections(parseChordSheet(value));
      undoStack.current = [];
      redoStack.current = [];
      lastEmittedRef.current = value;
      setSelected(null);
    }
  }, [value]);

  function commit(next: typeof sections, opts: { pushUndo?: boolean } = {}) {
    if (opts.pushUndo !== false) {
      undoStack.current.push(serializeChordSheet(sections));
      redoStack.current = [];
    }
    setSections(next);
    const serialized = serializeChordSheet(next);
    lastEmittedRef.current = serialized;
    onChange(serialized);
  }

  function undo() {
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    redoStack.current.push(serializeChordSheet(sections));
    const parsed = parseChordSheet(prev);
    setSections(parsed);
    lastEmittedRef.current = prev;
    onChange(prev);
    setSelected(null);
  }

  function redo() {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(serializeChordSheet(sections));
    const parsed = parseChordSheet(next);
    setSections(parsed);
    lastEmittedRef.current = next;
    onChange(next);
    setSelected(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  function isWordSelected(
    sectionIndex: number,
    lineIndex: number,
    segIndex: number,
    offsetInSegment: number,
  ) {
    return (
      !!selected &&
      selected.sectionIndex === sectionIndex &&
      selected.lineIndex === lineIndex &&
      selected.segIndex === segIndex &&
      selected.offsetInSegment === offsetInSegment
    );
  }

  function handleCommitChord(
    sectionIndex: number,
    lineIndex: number,
    segIndex: number,
    offsetInSegment: number,
    chord: string | null,
  ) {
    const beforeFlat = flattenWordRefs(sections);
    const currentIndex = beforeFlat.findIndex(
      (r) =>
        r.sectionIndex === sectionIndex &&
        r.lineIndex === lineIndex &&
        r.segIndex === segIndex &&
        r.offsetInSegment === offsetInSegment,
    );
    const next = setWordChord(
      sections,
      sectionIndex,
      lineIndex,
      segIndex,
      offsetInSegment,
      chord,
    );
    commit(next);
    if (chord) recordChord(chord);

    // Auto-advance naar het volgende woord (section 12) — alleen bij het
    // TOEVOEGEN van een akkoord, niet bij verwijderen. Woordenaantal/-volgorde
    // per regel verandert nooit door een split (zie chordSheetEditor.ts), dus
    // hetzelfde numerieke index-positie in de nieuwe lijst = "het volgende
    // woord".
    if (chord && currentIndex !== -1) {
      const afterFlat = flattenWordRefs(next);
      const nextWord = afterFlat[currentIndex + 1];
      if (nextWord) {
        setSelected({
          sectionIndex: nextWord.sectionIndex,
          lineIndex: nextWord.lineIndex,
          segIndex: nextWord.segIndex,
          offsetInSegment: nextWord.offsetInSegment,
        });
        return;
      }
    }
    setSelected(null);
  }

  function handleReplaceLine(
    sectionIndex: number,
    lineIndex: number,
    line: ChordSheetLine,
  ) {
    commit(libReplaceLineAt(sections, sectionIndex, lineIndex, line));
  }

  function handleInsertLineAfter(
    sectionIndex: number,
    lineIndex: number,
    line: ChordSheetLine,
  ) {
    commit(libInsertLineAfter(sections, sectionIndex, lineIndex, line));
  }

  /** Plakken van meerdere lyricregels tegelijk in één regel-tekstinvoer
   * (section 19): de eerste regel vervangt de huidige, de rest wordt erna
   * ingevoegd — elke regel gaat door dezelfde textToLine/parseLyricLine als
   * een losse regel, dus geplakte `[E]`-notatie werkt ook hier gewoon. */
  function handleInsertMultilineText(
    sectionIndex: number,
    lineIndex: number,
    lines: string[],
  ) {
    if (lines.length === 0) return;
    let next = libReplaceLineAt(
      sections,
      sectionIndex,
      lineIndex,
      textToLine(lines[0]),
    );
    let insertAt = lineIndex;
    for (let i = 1; i < lines.length; i++) {
      next = libInsertLineAfter(
        next,
        sectionIndex,
        insertAt,
        textToLine(lines[i]),
      );
      insertAt += 1;
    }
    commit(next);
  }

  function handleDuplicateLine(sectionIndex: number, lineIndex: number) {
    commit(libDuplicateLineAt(sections, sectionIndex, lineIndex));
  }

  function handleRemoveLine(sectionIndex: number, lineIndex: number) {
    commit(libRemoveLineAt(sections, sectionIndex, lineIndex));
    setSelected(null);
  }

  function handleRenameSection(sectionIndex: number, name: string) {
    commit(libRenameSectionAt(sections, sectionIndex, name));
  }

  function handleDuplicateSection(sectionIndex: number) {
    commit(libDuplicateSection(sections, sectionIndex));
  }

  function handleRemoveSection(sectionIndex: number) {
    commit(libRemoveSectionAt(sections, sectionIndex));
    setSelected(null);
  }

  function handleMoveSection(sectionIndex: number, direction: -1 | 1) {
    commit(libMoveSectionAt(sections, sectionIndex, direction));
  }

  function handleAddSection(afterIndex: number, name: string) {
    commit(
      libInsertSectionAfter(sections, afterIndex, createEmptySection(name)),
    );
  }

  return (
    <div className="space-y-5">
      {sections.length === 0 && (
        <button
          type="button"
          onClick={() => handleAddSection(-1, "Verse 1")}
          className="wa-button-ghost w-full h-10 text-xs justify-center border-dashed"
        >
          + Sectie
        </button>
      )}
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="space-y-3">
          <EditableSection
            section={section}
            isFirst={sectionIndex === 0}
            isLast={sectionIndex === sections.length - 1}
            originalKey={originalKey}
            recentChords={recent}
            onRecordRecent={recordChord}
            isWordSelected={(lineIndex, segIndex, offsetInSegment) =>
              isWordSelected(sectionIndex, lineIndex, segIndex, offsetInSegment)
            }
            onSelectWord={(lineIndex, segIndex, offsetInSegment) =>
              setSelected({
                sectionIndex,
                lineIndex,
                segIndex,
                offsetInSegment,
              })
            }
            onDeselect={() => setSelected(null)}
            onCommitChord={(lineIndex, segIndex, offsetInSegment, chord) =>
              handleCommitChord(
                sectionIndex,
                lineIndex,
                segIndex,
                offsetInSegment,
                chord,
              )
            }
            onReplaceLine={(lineIndex, line) =>
              handleReplaceLine(sectionIndex, lineIndex, line)
            }
            onInsertLineAfter={(lineIndex, line) =>
              handleInsertLineAfter(sectionIndex, lineIndex, line)
            }
            onInsertMultilineText={(lineIndex, lines) =>
              handleInsertMultilineText(sectionIndex, lineIndex, lines)
            }
            onDuplicateLine={(lineIndex) =>
              handleDuplicateLine(sectionIndex, lineIndex)
            }
            onRemoveLine={(lineIndex) =>
              handleRemoveLine(sectionIndex, lineIndex)
            }
            onRename={(name) => handleRenameSection(sectionIndex, name)}
            onDuplicateSection={() => handleDuplicateSection(sectionIndex)}
            onRemoveSection={() => handleRemoveSection(sectionIndex)}
            onMoveSection={(direction) =>
              handleMoveSection(sectionIndex, direction)
            }
          />
          <AddSectionInline
            onAdd={(name) => handleAddSection(sectionIndex, name)}
          />
        </div>
      ))}
    </div>
  );
}
