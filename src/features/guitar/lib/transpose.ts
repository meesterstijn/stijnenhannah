// Centrale transpose-utility voor de Gitaar-module. Alle akkoord-
// transformaties (transponeren, capo-berekening, weergaveopmaak) lopen
// UITSLUITEND via de functies hier — geen enkele component parseert of
// verschuift akkoorden zelf. Dit is bewust de enige plek die "wat is een
// akkoord" kent, zodat een toekomstige uitbreiding (bv. een derde
// enharmonische regel, of een importer vanaf een externe bron) op één plek
// landt.
//
// Alleen de grondtoon (en, bij slash chords, de basnoot) wordt getransponeerd.
// Alles daartussenin — "m", "7", "maj7", "sus4", "add9", "dim", "m7b5", etc. —
// wordt letterlijk overgenomen: dat zijn geen toonhoogtes maar akkoordvorm-
// aanduidingen.

const SHARP_SCALE = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;
const FLAT_SCALE = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

// Basisindex (op de C-majeurladder) per natuurlijke noot; # / b hierboven of
// hieronder verschuiven met 1 halve toon.
const NATURAL_BASE_INDEX: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// Herkent grondtoon + optionele # /b, de rest van de akkoordvorm (modifiers,
// letterlijk overgenomen), en een optionele /basnoot voor slash chords.
// Bewust geen validatie van de modifiers-inhoud — "m7b5", "add9", "sus4",
// "maj7", "6/9" (zonder herkenbare basnoot erna) etc. moeten allemaal
// onaangetast blijven staan.
const CHORD_PATTERN = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/;

export type ParsedChord = {
  rootLetter: string;
  rootAccidental: "" | "#" | "b";
  modifiers: string;
  bassLetter: string | null;
  bassAccidental: "" | "#" | "b";
};

export function parseChord(chord: string): ParsedChord | null {
  const trimmed = chord.trim();
  if (!trimmed) return null;
  const match = CHORD_PATTERN.exec(trimmed);
  if (!match) return null;
  const [, rootLetter, rootAccidental, modifiers, bassLetter, bassAccidental] =
    match;
  return {
    rootLetter,
    rootAccidental: (rootAccidental as "" | "#" | "b") ?? "",
    modifiers: modifiers ?? "",
    bassLetter: bassLetter ?? null,
    bassAccidental: (bassAccidental as "" | "#" | "b") ?? "",
  };
}

function noteToIndex(letter: string, accidental: "" | "#" | "b"): number {
  const base = NATURAL_BASE_INDEX[letter] ?? 0;
  const shifted =
    accidental === "#" ? base + 1 : accidental === "b" ? base - 1 : base;
  return ((shifted % 12) + 12) % 12;
}

function indexToNote(index: number, preferFlat: boolean): string {
  const normalized = ((index % 12) + 12) % 12;
  return preferFlat ? FLAT_SCALE[normalized] : SHARP_SCALE[normalized];
}

/**
 * Verschuift een enkel akkoord met `semitones` halve tonen. Niet-herkende
 * invoer (bv. een typefout, of een zeldzame notatie buiten CHORD_PATTERN)
 * komt ONGEWIJZIGD terug in plaats van te crashen — beter een onveranderd
 * akkoord tonen dan de hele chord sheet laten breken op één rij.
 */
export function transposeChord(
  chord: string,
  semitones: number,
  opts: { preferFlat?: boolean } = {},
): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  const { preferFlat = false } = opts;

  const newRoot = indexToNote(
    noteToIndex(parsed.rootLetter, parsed.rootAccidental) + semitones,
    preferFlat,
  );
  let result = newRoot + parsed.modifiers;

  if (parsed.bassLetter) {
    const newBass = indexToNote(
      noteToIndex(parsed.bassLetter, parsed.bassAccidental) + semitones,
      preferFlat,
    );
    result += `/${newBass}`;
  }

  return result;
}

/** Herschrijft alleen de grondtoon-spelling (# <-> b), zonder te transponeren. */
export function respellChord(chord: string, preferFlat: boolean): string {
  return transposeChord(chord, 0, { preferFlat });
}

// Unicode ♯/♭ voor weergave (info-balk, sectiekoppen) — de opslag/editor
// gebruikt bewust ASCII "#"/"b" (makkelijker te typen), dit is puur cosmetisch.
export function toDisplayNote(chord: string): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  const rootSymbol =
    parsed.rootAccidental === "#"
      ? "♯"
      : parsed.rootAccidental === "b"
        ? "♭"
        : "";
  let result = parsed.rootLetter + rootSymbol + parsed.modifiers;
  if (parsed.bassLetter) {
    const bassSymbol =
      parsed.bassAccidental === "#"
        ? "♯"
        : parsed.bassAccidental === "b"
          ? "♭"
          : "";
    result += `/${parsed.bassLetter}${bassSymbol}`;
  }
  return result;
}

const ROOT_OPTION_ORDER: { sharp: string; flat: string }[] = [
  { sharp: "A", flat: "A" },
  { sharp: "A#", flat: "Bb" },
  { sharp: "B", flat: "B" },
  { sharp: "C", flat: "C" },
  { sharp: "C#", flat: "Db" },
  { sharp: "D", flat: "D" },
  { sharp: "D#", flat: "Eb" },
  { sharp: "E", flat: "E" },
  { sharp: "F", flat: "F" },
  { sharp: "F#", flat: "Gb" },
  { sharp: "G", flat: "G" },
  { sharp: "G#", flat: "Ab" },
];

/** Grondtoon-opties voor selects (originele key, transponeren-doel, etc). */
export const KEY_ROOT_OPTIONS = ROOT_OPTION_ORDER.map((opt) => ({
  value: opt.sharp,
  label: opt.sharp === opt.flat ? opt.sharp : `${opt.sharp}/${opt.flat}`,
}));

/** Capo-posities: minimaal 0 t/m 11 (section 11). */
export const CAPO_OPTIONS = Array.from({ length: 12 }, (_, i) => i);

/**
 * Netto transpositie voor alle akkoorden in de chord sheet: de handmatige
 * transpose-offset T (verplaatst Original én Play samen) minus de capo N
 * (capo maakt alleen de gespeelde vorm lager t.o.v. de klinkende toonhoogte).
 * Play = Original - capo, dus getoonde akkoorden = origineel + T - N.
 */
export function netSemitones(transposeOffset: number, capo: number): number {
  return transposeOffset - capo;
}

/** Toonsoort zoals die klinkt na handmatige transpositie (vóór capo). */
export function displayedOriginalKey(
  originalKey: string,
  transposeOffset: number,
  preferFlat = false,
): string {
  return transposeChord(originalKey, transposeOffset, { preferFlat });
}

/** De akkoordvormen die de gitarist daadwerkelijk speelt (na capo). */
export function playKey(
  originalKey: string,
  transposeOffset: number,
  capo: number,
  preferFlat = false,
): string {
  return transposeChord(originalKey, netSemitones(transposeOffset, capo), {
    preferFlat,
  });
}
