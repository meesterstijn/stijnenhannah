// Deterministische (niet-random) hulpfuncties voor de fysieke "kaart op
// tafel"-details: een kleine, per-kaart vaste kanteling (section 3/5/14) en
// een gekleurde placeholder-cover zolang er geen echte cover geüpload is
// (section 5/11: "gebruik anders nette tijdelijke placeholders").
// Gehashed op een stabiele seed (game-id) i.p.v. Math.random(), zodat een
// kaart niet bij elke re-render van kanteling/kleur wisselt.

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const TILT_RANGE_DEG = 1.6;

/** Kleine, vaste kantelhoek voor een spelkaart — nooit precies 0, dat zou de
 * "losjes op tafel liggende kaart"-associatie wegnemen. */
export function cardTilt(seed: string): number {
  const normalized = (hashString(seed) % 100) / 100;
  return (normalized * 2 - 1) * TILT_RANGE_DEG;
}

const PLACEHOLDER_PALETTES = [
  ["oklch(0.34 0.05 75)", "oklch(0.19 0.03 55)"], // messing/walnoot
  ["oklch(0.32 0.06 155)", "oklch(0.18 0.03 60)"], // speelveltgroen
  ["oklch(0.36 0.05 40)", "oklch(0.2 0.025 55)"], // warme roest
  ["oklch(0.32 0.04 260)", "oklch(0.19 0.02 55)"], // gedempt leisteenblauw
] as const;

/** Gekleurde gradient-placeholder voor spellen zonder cover_storage_path. */
export function placeholderCoverGradient(seed: string): string {
  const [from, to] =
    PLACEHOLDER_PALETTES[hashString(seed) % PLACEHOLDER_PALETTES.length];
  return `linear-gradient(155deg, ${from}, ${to})`;
}
