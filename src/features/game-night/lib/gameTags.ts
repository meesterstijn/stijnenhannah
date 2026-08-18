// Gecontroleerde tag-vocabulaire voor spelmetadata (Game Night V4, sectie
// 26) — vervangt de vrije tekst uit de seed-data (zie migratie
// 20260912100000). Slugs zijn intern/opslag, labels zijn wat de gebruiker
// ziet. Nieuwe tags toevoegen = deze lijst uitbreiden, nergens anders.
export const GAME_TAGS = [
  "tactisch",
  "strategie",
  "party",
  "lachen",
  "bluffen",
  "sociaal",
  "elkaar-dwarszitten",
  "relaxed",
  "snel",
  "samenwerken",
  "kaartspel",
  "geluk",
  "puzzel",
] as const;

export type GameTag = (typeof GAME_TAGS)[number];

export const GAME_TAG_LABELS: Record<GameTag, string> = {
  tactisch: "Tactisch",
  strategie: "Strategie",
  party: "Party",
  lachen: "Lachen",
  bluffen: "Bluffen",
  sociaal: "Sociaal",
  "elkaar-dwarszitten": "Elkaar dwarszitten",
  relaxed: "Relaxed",
  snel: "Snel",
  samenwerken: "Samenwerken",
  kaartspel: "Kaartspel",
  geluk: "Geluk",
  puzzel: "Puzzel",
};

// Onbekende/legacy tags (bv. een spel dat handmatig met andere tekst is
// toegevoegd) tonen gewoon zichzelf i.p.v. te crashen of te verdwijnen —
// data kwaliteit sectie 27.
export function gameTagLabel(tag: string): string {
  return GAME_TAG_LABELS[tag as GameTag] ?? tag;
}
