import type {
  GameNightColorPaletteEntry,
  GameNightPlayer,
} from "@/lib/supabase";

// Game Night V2.5 (sectie 8) — één herbruikbare bron van waarheid voor
// "wie is deze speler visueel": nickname-fallback, kleur-resolutie en
// initiaal. Vóór V2.5 stond dezelfde kleur-fallback-logica inline
// gedupliceerd in GameNightLobby.tsx en PlayerChip.tsx; nu één plek, zodat
// Live Play (later) exact dezelfde speleridentiteit kan hergebruiken.

export function getPlayerDisplayName(player: GameNightPlayer): string {
  return player.nickname?.trim() || player.name;
}

export function getPlayerInitial(player: GameNightPlayer): string {
  return getPlayerDisplayName(player).charAt(0).toUpperCase();
}

// Gecureerd palet (color_id) wint altijd van het oude vrije-tekst kleurveld
// (color) — die bestaat nog voor spelers die vóór het palet zijn aangemaakt
// en nooit een paletkleur kozen. `null` = geen kleur toegekend; de UI toont
// dan een neutrale ring i.p.v. een geraden kleur.
export function resolvePlayerColorHex(
  player: GameNightPlayer,
  palette: GameNightColorPaletteEntry[],
): string | null {
  const paletteHex = palette.find((c) => c.id === player.color_id)?.hex;
  return paletteHex ?? player.color ?? null;
}
