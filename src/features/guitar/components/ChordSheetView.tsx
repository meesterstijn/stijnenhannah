import type { ChordSheetSection } from "@/features/guitar/lib/chordSheet";
import { splitSectionsIntoColumns } from "@/features/guitar/lib/chordSheet";
import { toDisplayNote } from "@/features/guitar/lib/transpose";

// Traditionele "chords-boven-lyrics"-weergave (section 8) — GEEN inline
// "[E]tekst"-notatie. Elk akkoord + het tekstfragment dat erbij hoort wordt
// gerenderd als één zelfstandige, verticaal gestapelde flex-kolom
// ("segment"); de rij van segmenten wrapt als geheel op smalle schermen.
// Zo blijft een akkoord ALTIJD exact boven het juiste woord staan, ook na
// reflow — in tegenstelling tot uitlijning op vaste tekenposities
// (monospace-kolommen), die bij een andere schermbreedte of lettertype
// altijd verschuift.
export function ChordSheetView({
  sections,
  columns = 1,
  size = "default",
}: {
  sections: ChordSheetSection[];
  columns?: 1 | 2;
  size?: "default" | "play";
}) {
  if (sections.length === 0) {
    return (
      <p className="wa-muted text-sm">
        Nog geen akkoorden toegevoegd aan dit nummer.
      </p>
    );
  }

  if (columns === 2 && sections.length > 1) {
    const [left, right] = splitSectionsIntoColumns(sections);
    return (
      <div className="grid gap-x-12 gap-y-9 lg:grid-cols-2">
        <div className="flex flex-col gap-9">
          {left.map((section, i) => (
            <SongSection key={i} section={section} size={size} />
          ))}
        </div>
        <div className="flex flex-col gap-9">
          {right.map((section, i) => (
            <SongSection key={i} section={section} size={size} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-9">
      {sections.map((section, i) => (
        <SongSection key={i} section={section} size={size} />
      ))}
    </div>
  );
}

function SongSection({
  section,
  size,
}: {
  section: ChordSheetSection;
  size: "default" | "play";
}) {
  const textSize =
    size === "play" ? "text-2xl sm:text-3xl" : "text-[15px] sm:text-base";
  const chordSize =
    size === "play" ? "text-xl sm:text-2xl" : "text-[13px] sm:text-sm";
  const chordSlotHeight = size === "play" ? "h-[1.4em]" : "h-[1.3em]";

  return (
    <div className="break-inside-avoid">
      {section.name && (
        <p className="wa-section-label mb-3.5">{section.name}</p>
      )}
      <div className="flex flex-col gap-2.5">
        {section.lines.map((line, i) =>
          line.type === "blank" ? (
            <div key={i} aria-hidden className="h-2" />
          ) : (
            <div key={i} className="flex flex-wrap items-start gap-y-3">
              {line.segments.map((seg, j) => (
                <span key={j} className="inline-flex flex-col items-start">
                  <span
                    className={`wa-chord ${chordSize} ${chordSlotHeight} leading-none block`}
                  >
                    {seg.chord ? toDisplayNote(seg.chord) : ""}
                  </span>
                  <span
                    className={`wa-lyric ${textSize} leading-snug whitespace-pre`}
                  >
                    {seg.text}
                  </span>
                </span>
              ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
