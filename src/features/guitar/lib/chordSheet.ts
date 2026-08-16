// Chord-sheet opslagformaat + parser voor de Gitaar-module.
//
// Opslagformaat (in `guitar_songs.content`):
//   - Een regel die begint met "#" (1-3x) is een sectiekop, bv. "# Verse 1",
//     "## Chorus". Alles na de #'s is de sectienaam — vrij te kiezen tekst,
//     geen vaste enum, zodat elke van de gevraagde types (Intro/Verse/
//     Pre-Chorus/Chorus/Bridge/Instrumental/Interlude/Outro/Spontaneous of
//     iets anders) gewoon werkt.
//   - Akkoorden staan INLINE, direct voor de tekst waar ze bij horen, tussen
//     vierkante haken: "[E]We have come to give You [D]glory". Dit is
//     bewust het opslag-/editformaat, NIET het eindresultaat — de UI
//     rendert dit altijd als akkoorden-boven-tekst (zie ChordSheetView),
//     nooit als kale inline "[E]tekst". Inline haken zijn de enige
//     betrouwbare manier om een akkoordpositie aan een exacte tekstpositie
//     te koppelen in een gewone tekst-editor, en zijn onafhankelijk van
//     lettertype/kolombreedte — in tegenstelling tot monospace-uitlijning
//     op tekens, die bij reflow (verschillende schermbreedtes) altijd
//     kapotgaat.
//   - Een lege regel is een paragraaf-scheiding binnen een sectie.
//
// Transponeren/capo werken UITSLUITEND op het geparste resultaat (zie
// transposeSections) — `content` zelf wordt nooit herschreven.

import { transposeChord } from "./transpose";

export type ChordSheetSegment = { chord: string | null; text: string };

export type ChordSheetLine =
  | { type: "lyrics"; segments: ChordSheetSegment[] }
  | { type: "blank" };

export type ChordSheetSection = {
  name: string;
  lines: ChordSheetLine[];
};

const CHORD_TOKEN = /\[([^\]]+)\]/g;
const SECTION_HEADER = /^\s*#{1,3}\s*(.+?)\s*$/;

/** Splitst één regel tekst in {chord, text}-segmenten, chordpositie behouden. */
export function parseLyricLine(line: string): ChordSheetSegment[] {
  const segments: ChordSheetSegment[] = [];
  let lastIndex = 0;
  let currentChord: string | null = null;
  CHORD_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CHORD_TOKEN.exec(line))) {
    segments.push({
      chord: currentChord,
      text: line.slice(lastIndex, match.index),
    });
    currentChord = match[1].trim();
    lastIndex = CHORD_TOKEN.lastIndex;
  }
  segments.push({ chord: currentChord, text: line.slice(lastIndex) });
  // Een lege, akkoordloze eerste segment is puur een parse-artefact van een
  // regel die met een akkoord begint — geen echte content om te tonen.
  return segments.filter((s) => !(s.chord === null && s.text === ""));
}

export function parseChordSheet(content: string): ChordSheetSection[] {
  const rawLines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: ChordSheetSection[] = [];
  let current: ChordSheetSection | null = null;

  for (const raw of rawLines) {
    const headerMatch = SECTION_HEADER.exec(raw);
    if (headerMatch) {
      if (current) sections.push(current);
      current = { name: headerMatch[1], lines: [] };
      continue;
    }
    if (!current) current = { name: "", lines: [] };
    if (raw.trim() === "") {
      current.lines.push({ type: "blank" });
    } else {
      current.lines.push({ type: "lyrics", segments: parseLyricLine(raw) });
    }
  }
  if (current) sections.push(current);

  for (const section of sections) {
    while (section.lines.length && section.lines[0].type === "blank")
      section.lines.shift();
    while (
      section.lines.length &&
      section.lines[section.lines.length - 1].type === "blank"
    ) {
      section.lines.pop();
    }
  }

  return sections.filter((s) => s.lines.length > 0 || s.name.trim() !== "");
}

/** Pure transformatie — retourneert nieuwe secties, `content` blijft ongewijzigd. */
export function transposeSections(
  sections: ChordSheetSection[],
  semitones: number,
  opts: { preferFlat?: boolean } = {},
): ChordSheetSection[] {
  return sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) => {
      if (line.type === "blank") return line;
      return {
        type: "lyrics" as const,
        segments: line.segments.map((seg) =>
          seg.chord
            ? { ...seg, chord: transposeChord(seg.chord, semitones, opts) }
            : seg,
        ),
      };
    }),
  }));
}

/**
 * Verdeelt secties over twee kolommen, in volgorde en zonder een sectie te
 * splitsen (section 13) — gebalanceerd op regelaantal, niet op willekeurige
 * tekenposities.
 */
export function splitSectionsIntoColumns(
  sections: ChordSheetSection[],
): [ChordSheetSection[], ChordSheetSection[]] {
  if (sections.length <= 1) return [sections, []];

  const weights = sections.map((s) => s.lines.length + 1);
  const total = weights.reduce((a, b) => a + b, 0);

  let acc = 0;
  let splitIndex = sections.length - 1;
  for (let i = 0; i < sections.length; i++) {
    acc += weights[i];
    if (acc >= total / 2) {
      splitIndex = i + 1;
      break;
    }
  }
  splitIndex = Math.min(Math.max(splitIndex, 1), sections.length - 1);

  return [sections.slice(0, splitIndex), sections.slice(splitIndex)];
}

/**
 * Inverse van parseChordSheet — zet het geparste model terug om naar het
 * opslagformaat. Bewust GEEN eis dat dit byte-voor-byte de oorspronkelijke
 * tekst reproduceert (andere insprongen/witruimte zijn prima); de eis is
 * functionele round-trip: parseChordSheet(serializeChordSheet(x)) levert
 * dezelfde structuur op als x. Dit is de ENIGE plek die naar het
 * bracket-formaat terugschrijft — de editor roept dit aan, nooit een eigen
 * losse serialisatie.
 */
export function serializeChordSheet(sections: ChordSheetSection[]): string {
  return sections.map(serializeSection).join("\n\n");
}

function serializeSection(section: ChordSheetSection): string {
  const header = section.name.trim() ? `# ${section.name.trim()}` : "";
  const body = section.lines.map(serializeLine).join("\n");
  return [header, body].filter((part) => part !== "").join("\n");
}

export function serializeLine(line: ChordSheetLine): string {
  if (line.type === "blank") return "";
  return line.segments
    .map((seg) => (seg.chord ? `[${seg.chord}]` : "") + seg.text)
    .join("");
}

/** Een regel is "chord-only" (bv. een Intro-regel) als geen enkel segment
 * daadwerkelijke tekst bevat — alleen akkoorden + scheidingsspaties. */
export function isChordOnlyLine(line: ChordSheetLine): boolean {
  if (line.type !== "lyrics") return false;
  const hasChord = line.segments.some((seg) => seg.chord);
  const hasText = line.segments.some((seg) => seg.text.trim() !== "");
  return hasChord && !hasText;
}

/**
 * Compacte invoer voor akkoordenregels: "E B C#m A" of "| E | B | C#m | A |"
 * — beide vormen worden hetzelfde getokeniseerd (section 18).
 */
export function parseChordOnlyInput(raw: string): string[] {
  return raw
    .split("|")
    .join(" ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Zet een lijst akkoorden om naar segmenten voor een chord-only regel,
 * met een enkele spatie tussen elk akkoord als scheidingstekst. */
export function chordTokensToSegments(tokens: string[]): ChordSheetSegment[] {
  return tokens.map((chord, i) => ({
    chord,
    text: i < tokens.length - 1 ? " " : "",
  }));
}

/** Alle unieke akkoorden in een chord sheet, in volgorde van eerste voorkomen — handig voor previews/badges. */
export function collectChords(sections: ChordSheetSection[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const section of sections) {
    for (const line of section.lines) {
      if (line.type !== "lyrics") continue;
      for (const seg of line.segments) {
        if (seg.chord && !seen.has(seg.chord)) {
          seen.add(seg.chord);
          result.push(seg.chord);
        }
      }
    }
  }
  return result;
}
