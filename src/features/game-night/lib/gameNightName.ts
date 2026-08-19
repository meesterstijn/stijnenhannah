// Automatische Game Night-naam: "Game Night · 17 augustus · Stijn, Hannah,
// Tim & Ruben" (of, bij meer dan 4 spelers, "Stijn, Hannah + 4"). Puur/
// testbaar los van Supabase — de hook die de sessie aanmaakt roept dit aan
// nadat de spelers geselecteerd zijn.

export function formatPlayerNamesForTitle(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length <= 4) {
    return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
  }
  return `${names.slice(0, 2).join(", ")} + ${names.length - 2}`;
}

export function formatGameNightDate(date: Date): string {
  return date.toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

// Game Night V2.5/V2.6 — compacte avondidentiteit voor de V2-topbars
// (lobby én Game Select delen dezelfde weergave, sectie 5/19). Neemt bewust
// `started_at` (echte sessiedata), nooit een verzonnen avondnummer.
export function formatEveningIdentity(startedAt: string): {
  weekday: string;
  date: string;
} {
  const d = new Date(startedAt);
  const weekday = d.toLocaleDateString("nl-NL", { weekday: "long" });
  return { weekday, date: formatGameNightDate(d) };
}

export function generateGameNightName(
  playerNames: string[],
  date: Date = new Date(),
): string {
  const namesPart = formatPlayerNamesForTitle(playerNames);
  const datePart = formatGameNightDate(date);
  return namesPart
    ? `Game Night · ${datePart} · ${namesPart}`
    : `Game Night · ${datePart}`;
}
