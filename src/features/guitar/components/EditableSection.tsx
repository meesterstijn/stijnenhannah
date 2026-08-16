import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ListMusic,
  Pencil,
  MoreHorizontal,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ChordSheetLine,
  ChordSheetSection,
} from "@/features/guitar/lib/chordSheet";
import { SECTION_TYPE_OPTIONS } from "@/features/guitar/lib/chordSheetEditor";
import { EditableChordLine } from "./EditableChordLine";

type EditableSectionProps = {
  section: ChordSheetSection;
  isFirst: boolean;
  isLast: boolean;
  originalKey?: string;
  recentChords: string[];
  onRecordRecent: (chord: string) => void;
  isWordSelected: (
    lineIndex: number,
    segIndex: number,
    offsetInSegment: number,
  ) => boolean;
  onSelectWord: (
    lineIndex: number,
    segIndex: number,
    offsetInSegment: number,
  ) => void;
  onDeselect: () => void;
  onCommitChord: (
    lineIndex: number,
    segIndex: number,
    offsetInSegment: number,
    chord: string | null,
  ) => void;
  onReplaceLine: (lineIndex: number, line: ChordSheetLine) => void;
  onInsertLineAfter: (lineIndex: number, line: ChordSheetLine) => void;
  onInsertMultilineText: (lineIndex: number, lines: string[]) => void;
  onDuplicateLine: (lineIndex: number) => void;
  onRemoveLine: (lineIndex: number) => void;
  onRename: (name: string) => void;
  onDuplicateSection: () => void;
  onRemoveSection: () => void;
  onMoveSection: (direction: -1 | 1) => void;
};

// Eén sectie in de visuele editor: bewerkbare titel + regels + subtiele
// hover-toolbar voor volgorde/verwijderen (section 14). "+ Regel"/
// "+ Akkoordenregel" werken ook op een lege sectie (section.lines.length===0)
// dankzij insertLineAfter(-1, ...), dat splice(0,0,line) doet — geen aparte
// "append"-primitief nodig.
export function EditableSection({
  section,
  isFirst,
  isLast,
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
  onRename,
  onDuplicateSection,
  onRemoveSection,
  onMoveSection,
}: EditableSectionProps) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(section.name);

  function commitRename() {
    onRename(nameDraft.trim());
    setRenaming(false);
  }

  return (
    <div className="group/section">
      <div className="flex items-center gap-2 mb-3.5">
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setNameDraft(section.name);
                setRenaming(false);
              }
            }}
            className="wa-section-label h-7 px-2 rounded-md !normal-case"
            placeholder="Sectienaam, bv. Verse 2"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(section.name);
              setRenaming(true);
            }}
            className="wa-section-label hover:text-[var(--wa-text)] transition-colors text-left"
          >
            {section.name || "Naamloos"}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-6 w-6 rounded-md flex items-center justify-center wa-muted opacity-0 transition-opacity hover:bg-[var(--wa-surface-strong)] hover:text-[var(--wa-text)] group-hover/section:opacity-100 group-focus-within/section:opacity-100 data-[state=open]:opacity-100"
              aria-label="Sectiemenu"
              title="Sectiemenu"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="guitar-theme">
            <DropdownMenuItem
              onClick={() => {
                setNameDraft(section.name);
                setRenaming(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Naam wijzigen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicateSection}>
              <Copy className="h-3.5 w-3.5" /> Dupliceren
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onMoveSection(-1)}
              disabled={isFirst}
            >
              <ChevronUp className="h-3.5 w-3.5" /> Omhoog
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onMoveSection(1)}
              disabled={isLast}
            >
              <ChevronDown className="h-3.5 w-3.5" /> Omlaag
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onRemoveSection}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Verwijderen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-2.5">
        {section.lines.map((line, lineIndex) => (
          <EditableChordLine
            key={lineIndex}
            line={line}
            originalKey={originalKey}
            recentChords={recentChords}
            onRecordRecent={onRecordRecent}
            isWordSelected={(segIndex, offsetInSegment) =>
              isWordSelected(lineIndex, segIndex, offsetInSegment)
            }
            onSelectWord={(segIndex, offsetInSegment) =>
              onSelectWord(lineIndex, segIndex, offsetInSegment)
            }
            onDeselect={onDeselect}
            onCommitChord={(segIndex, offsetInSegment, chord) =>
              onCommitChord(lineIndex, segIndex, offsetInSegment, chord)
            }
            onReplaceLine={(newLine) => onReplaceLine(lineIndex, newLine)}
            onInsertLineAfter={() =>
              onInsertLineAfter(lineIndex, { type: "blank" })
            }
            onInsertMultilineText={(lines) =>
              onInsertMultilineText(lineIndex, lines)
            }
            onDuplicateLine={() => onDuplicateLine(lineIndex)}
            onRemoveLine={() => onRemoveLine(lineIndex)}
          />
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-2.5">
        <button
          type="button"
          onClick={() =>
            onInsertLineAfter(section.lines.length - 1, { type: "blank" })
          }
          className="wa-muted inline-flex items-center gap-1 text-[11px] hover:text-[var(--wa-text)] transition-colors"
        >
          <Type className="h-3 w-3" /> + Regel
        </button>
        <button
          type="button"
          onClick={() =>
            onInsertLineAfter(section.lines.length - 1, {
              type: "lyrics",
              segments: [{ chord: null, text: "" }],
            })
          }
          className="wa-muted inline-flex items-center gap-1 text-[11px] hover:text-[var(--wa-text)] transition-colors"
        >
          <ListMusic className="h-3 w-3" /> + Akkoordenregel
        </button>
      </div>
    </div>
  );
}

export function AddSectionInline({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <NewSectionForm
      onSubmit={(name) => {
        onAdd(name);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="wa-button-ghost w-full h-9 text-xs justify-center border-dashed"
    >
      <Plus className="h-3.5 w-3.5" /> Sectie
    </button>
  );
}

function NewSectionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState("Verse");
  const [number, setNumber] = useState("");

  function submit() {
    const name = number.trim() ? `${type} ${number.trim()}` : type;
    onSubmit(name);
  }

  return (
    <div className="wa-panel flex flex-wrap items-center gap-2 p-3">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="h-8 px-2 text-xs rounded-md border"
        style={{
          background: "var(--wa-surface)",
          borderColor: "var(--wa-border)",
          color: "var(--wa-text)",
        }}
      >
        {SECTION_TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="nr. (optioneel)"
        className="h-8 w-24 px-2 text-xs rounded-md"
      />
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          type="button"
          onClick={onCancel}
          className="wa-muted text-xs px-2"
        >
          Annuleer
        </button>
        <button
          type="button"
          onClick={submit}
          className="wa-button h-8 px-3 text-xs"
        >
          Toevoegen
        </button>
      </div>
    </div>
  );
}
