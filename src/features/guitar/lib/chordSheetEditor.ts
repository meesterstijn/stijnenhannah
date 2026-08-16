// Editor-only mutatielogica voor de visuele akkoordeditor. Werkt UITSLUITEND
// op het bestaande ChordSheetSection[]-model uit chordSheet.ts (geproduceerd
// door parseChordSheet, teruggeschreven via serializeChordSheet) — dit
// bestand introduceert geen tweede songformaat en geen eigen parser, alleen
// pure, immutable mutatie-primitieven + een word-level view die de UI nodig
// heeft om op tekst te kunnen klikken.

import {
  type ChordSheetLine,
  type ChordSheetSection,
  type ChordSheetSegment,
  chordTokensToSegments,
  isChordOnlyLine,
  parseChordOnlyInput,
  parseLyricLine,
} from "./chordSheet";
import { KEY_ROOT_OPTIONS, parseChord } from "./transpose";

export type LyricsLine = Extract<ChordSheetLine, { type: "lyrics" }>;

// ── Woord-tokenization ──────────────────────────────────────────────────
// Een segment (chordSheet.ts) begint bij een akkoord en loopt tot het
// volgende — dat is de granulariteit van de RENDERER. De EDITOR heeft een
// fijnere, afgeleide granulariteit nodig om per woord te kunnen klikken: elk
// segment wordt hier verder opgesplitst op woordgrenzen. Alleen het EERSTE
// woord van een segment "bezit" het akkoord van dat segment — dat is precies
// waarom akkoorden altijd aan het begin van een woord/segment staan.

export type EditorWordToken = {
  kind: "word";
  key: string;
  text: string;
  chord: string | null;
  segIndex: number;
  offsetInSegment: number;
};

export type EditorSpaceToken = {
  kind: "space";
  key: string;
  /** De letterlijke witruimte uit de brontekst (kan meerdere spaties zijn) —
   * NOOIT vervangen door een vaste CSS-gap: witruimte is onderdeel van de
   * songtekst en moet exact behouden blijven. */
  text: string;
};

export type EditorLineToken = EditorWordToken | EditorSpaceToken;

/**
 * Tokeniseert een regel in ZOWEL woorden als de witruimte ertussen, in de
 * oorspronkelijke volgorde. Vorige versie matchte alleen `\S+` (woorden) en
 * liet de tussenliggende spaties gewoon weg — dat was de bug die woorden aan
 * elkaar liet plakken in Visueel → Bewerken. `(\S+|\s+)` matcht de VOLLEDIGE
 * tekst (geen enkel teken wordt overgeslagen), dus concatenatie van alle
 * token.text-waarden reproduceert het segment exact. Alleen "word"-tokens
 * zijn klikbaar/akkoord-targets; "space"-tokens zijn puur weergave.
 */
export function tokenizeLineWords(line: LyricsLine): EditorLineToken[] {
  const tokens: EditorLineToken[] = [];
  line.segments.forEach((seg, segIndex) => {
    const chunkPattern = /(\S+|\s+)/g;
    let match: RegExpExecArray | null;
    let isFirstWordOfSegment = true;
    while ((match = chunkPattern.exec(seg.text))) {
      const chunk = match[0];
      if (/^\s+$/.test(chunk)) {
        tokens.push({
          kind: "space",
          key: `${segIndex}-s${match.index}`,
          text: chunk,
        });
        continue;
      }
      tokens.push({
        kind: "word",
        key: `${segIndex}-w${match.index}`,
        text: chunk,
        chord: isFirstWordOfSegment ? seg.chord : null,
        segIndex,
        offsetInSegment: match.index,
      });
      isFirstWordOfSegment = false;
    }
  });
  return tokens;
}

// ── Segment-niveau mutatie ───────────────────────────────────────────────
/**
 * Zet (of wist, met chord=null) het akkoord op offset `offsetInSegment`
 * binnen segment `segIndex`. offset<=0 == start van het segment: het
 * bestaande segment wordt direct aangepast (geen split nodig — dit dekt
 * zowel "akkoord op woord zonder akkoord toevoegen waar het toevallig al de
 * segmentstart is" als "bestaand akkoord wijzigen/verwijderen", want een
 * akkoord staat per definitie altijd op offset 0 van zijn eigen segment).
 * offset>0 == midden in het segment (een later woord, of section 5's
 * mid-word plaatsing): het segment wordt gesplitst, het nieuwe akkoord komt
 * op het tweede deel te staan.
 */
export function setChordAtOffset(
  segments: ChordSheetSegment[],
  segIndex: number,
  offsetInSegment: number,
  chord: string | null,
): ChordSheetSegment[] {
  const target = segments[segIndex];
  if (!target) return segments;
  if (offsetInSegment <= 0) {
    const updated = [...segments];
    updated[segIndex] = { ...target, chord };
    return updated;
  }
  const before: ChordSheetSegment = {
    chord: target.chord,
    text: target.text.slice(0, offsetInSegment),
  };
  const after: ChordSheetSegment = {
    chord,
    text: target.text.slice(offsetInSegment),
  };
  const updated = [...segments];
  updated.splice(segIndex, 1, before, after);
  return updated;
}

// ── Sections[]-niveau helpers (immutable) ───────────────────────────────

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  const next = [...items];
  next[index] = value;
  return next;
}

export function setWordChord(
  sections: ChordSheetSection[],
  sectionIndex: number,
  lineIndex: number,
  segIndex: number,
  offsetInSegment: number,
  chord: string | null,
): ChordSheetSection[] {
  const section = sections[sectionIndex];
  const line = section.lines[lineIndex];
  if (line.type !== "lyrics") return sections;
  const normalized = chord && chord.trim() ? chord.trim() : null;
  const newSegments = setChordAtOffset(
    line.segments,
    segIndex,
    offsetInSegment,
    normalized,
  );
  const newLine: ChordSheetLine = { type: "lyrics", segments: newSegments };
  const newSection: ChordSheetSection = {
    ...section,
    lines: replaceAt(section.lines, lineIndex, newLine),
  };
  return replaceAt(sections, sectionIndex, newSection);
}

/** Zet vrij getypte/geplakte tekst om naar een regel — hergebruikt
 * parseLyricLine, dus `[E]`-notatie plakken in een regel werkt gewoon. */
export function textToLine(text: string): ChordSheetLine {
  if (text.trim() === "") return { type: "blank" };
  return { type: "lyrics", segments: parseLyricLine(text) };
}

export function replaceLineAt(
  sections: ChordSheetSection[],
  sectionIndex: number,
  lineIndex: number,
  line: ChordSheetLine,
): ChordSheetSection[] {
  const section = sections[sectionIndex];
  return replaceAt(sections, sectionIndex, {
    ...section,
    lines: replaceAt(section.lines, lineIndex, line),
  });
}

export function insertLineAfter(
  sections: ChordSheetSection[],
  sectionIndex: number,
  lineIndex: number,
  line: ChordSheetLine,
): ChordSheetSection[] {
  const section = sections[sectionIndex];
  const lines = [...section.lines];
  lines.splice(lineIndex + 1, 0, line);
  return replaceAt(sections, sectionIndex, { ...section, lines });
}

export function removeLineAt(
  sections: ChordSheetSection[],
  sectionIndex: number,
  lineIndex: number,
): ChordSheetSection[] {
  const section = sections[sectionIndex];
  return replaceAt(sections, sectionIndex, {
    ...section,
    lines: section.lines.filter((_, i) => i !== lineIndex),
  });
}

// ── Chord-only regels (section 17/18) ───────────────────────────────────

export function chordOnlyLineFromInput(raw: string): ChordSheetLine {
  return {
    type: "lyrics",
    segments: chordTokensToSegments(parseChordOnlyInput(raw)),
  };
}

export function addChordToChordOnlyLine(
  line: LyricsLine,
  chord: string,
): ChordSheetLine {
  const trimmed = chord.trim();
  if (!trimmed) return line;
  const segments = [...line.segments];
  if (segments.length > 0 && segments[segments.length - 1].text === "") {
    segments[segments.length - 1] = {
      ...segments[segments.length - 1],
      text: " ",
    };
  }
  segments.push({ chord: trimmed, text: "" });
  return { type: "lyrics", segments };
}

export function removeChordTokenAt(
  line: LyricsLine,
  segIndex: number,
): ChordSheetLine {
  const segments = line.segments.filter((_, i) => i !== segIndex);
  if (segments.length > 0)
    segments[segments.length - 1] = {
      ...segments[segments.length - 1],
      text: "",
    };
  return { type: "lyrics", segments };
}

// ── Secties (section 14/15) ──────────────────────────────────────────────

export const SECTION_TYPE_OPTIONS = [
  "Intro",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Instrumental",
  "Interlude",
  "Outro",
  "Spontaneous",
] as const;

/** Lege sectie: GEEN placeholder-regel — een sectie zonder regels serialiseert
 * gewoon naar `# Naam` en blijft zo staan (parseChordSheet bewaart secties
 * mét naam ook als lines leeg is), de UI toont dan alleen de "+ Regel"-actie. */
export function createEmptySection(name: string): ChordSheetSection {
  return { name, lines: [] };
}

export function insertSectionAfter(
  sections: ChordSheetSection[],
  sectionIndex: number,
  section: ChordSheetSection,
): ChordSheetSection[] {
  const next = [...sections];
  next.splice(sectionIndex + 1, 0, section);
  return next;
}

export function removeSectionAt(
  sections: ChordSheetSection[],
  sectionIndex: number,
): ChordSheetSection[] {
  return sections.filter((_, i) => i !== sectionIndex);
}

export function renameSectionAt(
  sections: ChordSheetSection[],
  sectionIndex: number,
  name: string,
): ChordSheetSection[] {
  return replaceAt(sections, sectionIndex, { ...sections[sectionIndex], name });
}

export function moveSectionAt(
  sections: ChordSheetSection[],
  sectionIndex: number,
  direction: -1 | 1,
): ChordSheetSection[] {
  const target = sectionIndex + direction;
  if (target < 0 || target >= sections.length) return sections;
  const next = [...sections];
  [next[sectionIndex], next[target]] = [next[target], next[sectionIndex]];
  return next;
}

// ── Dupliceren (section 1-6) ─────────────────────────────────────────────

/**
 * Bepaalt de naam van een gedupliceerde sectie: een naam die op een getal
 * eindigt wordt met 1 opgehoogd ("Verse 1" -> "Verse 2"), een naam zonder
 * getal ("Chorus", "Bridge") blijft ongewijzigd — een refrein dat later
 * nogmaals voorkomt hoeft niet geforceerd "Chorus 2" te heten.
 */
export function nextSectionNameForDuplicate(name: string): string {
  const match = /^(.*?)(\d+)$/.exec(name.trim());
  if (!match) return name;
  const [, base, numStr] = match;
  const nextNumber = parseInt(numStr, 10) + 1;
  const trimmedBase = base.trimEnd();
  return trimmedBase ? `${trimmedBase} ${nextNumber}` : `${nextNumber}`;
}

/**
 * Dupliceert een volledige sectie (titel + alle regels + alle akkoorden op
 * exact dezelfde posities) direct onder het origineel. `structuredClone`
 * garandeert een ECHTE deep copy — origineel en kopie delen daarna geen
 * enkele geneste array/object meer, dus latere edits aan de kopie (via
 * setWordChord/replaceLineAt/etc., die zelf ook altijd nieuwe arrays
 * teruggeven) kunnen het origineel nooit raken, en andersom.
 */
export function duplicateSection(
  sections: ChordSheetSection[],
  sectionIndex: number,
): ChordSheetSection[] {
  const original = sections[sectionIndex];
  if (!original) return sections;
  const clone = structuredClone(original);
  clone.name = nextSectionNameForDuplicate(clone.name);
  const next = [...sections];
  next.splice(sectionIndex + 1, 0, clone);
  return next;
}

/** Dupliceert één regel (tekst, akkoorden, akkoordposities, regeltype)
 * direct onder de originele regel binnen dezelfde sectie. Zelfde deep-copy
 * garantie als duplicateSection hierboven. */
export function duplicateLineAt(
  sections: ChordSheetSection[],
  sectionIndex: number,
  lineIndex: number,
): ChordSheetSection[] {
  const section = sections[sectionIndex];
  const original = section?.lines[lineIndex];
  if (!section || !original) return sections;
  const clone = structuredClone(original);
  const lines = [...section.lines];
  lines.splice(lineIndex + 1, 0, clone);
  return replaceAt(sections, sectionIndex, { ...section, lines });
}

// ── Woord-navigatie (Tab/Shift+Tab, auto-advance na Enter — section 12) ──

export type WordRef = {
  sectionIndex: number;
  lineIndex: number;
  segIndex: number;
  offsetInSegment: number;
  text: string;
  chord: string | null;
};

export function flattenWordRefs(sections: ChordSheetSection[]): WordRef[] {
  const refs: WordRef[] = [];
  sections.forEach((section, sectionIndex) => {
    section.lines.forEach((line, lineIndex) => {
      if (line.type !== "lyrics" || isChordOnlyLine(line)) return;
      for (const tok of tokenizeLineWords(line)) {
        if (tok.kind !== "word") continue;
        refs.push({
          sectionIndex,
          lineIndex,
          segIndex: tok.segIndex,
          offsetInSegment: tok.offsetInSegment,
          text: tok.text,
          chord: tok.chord,
        });
      }
    });
  });
  return refs;
}

export function wordRefKey(
  ref: Pick<
    WordRef,
    "sectionIndex" | "lineIndex" | "segIndex" | "offsetInSegment"
  >,
): string {
  return `${ref.sectionIndex}:${ref.lineIndex}:${ref.segIndex}:${ref.offsetInSegment}`;
}

// ── Autocomplete (section 9) ─────────────────────────────────────────────
// Bewust GEEN uitputtende harde lijst — gegenereerd uit de bestaande 12
// grondtonen (transpose.ts, incl. #/b-dubbelspelling) x een kleine set
// veelgebruikte akkoordvormen. Slash chords enumereren we niet (combinatorisch
// te groot); die blijven vrij te typen en worden gevalideerd via parseChord.
const COMMON_CHORD_MODIFIERS = [
  "",
  "m",
  "7",
  "maj7",
  "m7",
  "sus2",
  "sus4",
  "add9",
  "6",
  "9",
  "dim",
];

export function suggestChords(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const results: string[] = [];
  for (const opt of KEY_ROOT_OPTIONS) {
    const roots = opt.label.includes("/") ? opt.label.split("/") : [opt.value];
    for (const root of roots) {
      for (const mod of COMMON_CHORD_MODIFIERS) {
        const candidate = root + mod;
        if (!seen.has(candidate) && candidate.toLowerCase().startsWith(q)) {
          seen.add(candidate);
          results.push(candidate);
          if (results.length >= limit) return results;
        }
      }
    }
  }
  return results;
}

/** Syntactisch geldig volgens de bestaande transpose-parser — puur een
 * visuele hint in de picker, nooit een harde blokkade (section 11: "Ik moet
 * altijd elk akkoord kunnen typen"). */
export function isRecognizedChord(text: string): boolean {
  return parseChord(text) !== null;
}
