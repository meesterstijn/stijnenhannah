// Game Night V2.10.8 (Arena Fase 1.1 — "fix de visuele compositie") —
// vervangt de vorige ring/ellips-positionering (top/left-percentages +
// translate(-50%,-50%)) VOLLEDIG. Die percentages waren getuned voor de
// oude, veel kleinere `.gnv2-character-head`-avatar (40-88px) — sindsdien
// zijn Arena-characters meerdere keren vergroot ("characters zijn de show")
// zonder dat deze percentages meeschaalden, met zichtbare boven-/onderrand-
// clipping tot gevolg zodra een zetel dicht bij top:4%/96% van de ring lag.
//
// Nieuwe aanpak: geen absolute coördinaten meer, maar een simpele
// TOP-GROEP/BOTTOM-GROEP-verdeling die ArenaPlayerLayout.tsx omzet in twee
// gewone, wrappende flex-rijen rond het spelvlak (CSS regelt de exacte
// pixelpositie, hier alleen "wie zit boven, wie zit onder"). Puur data in,
// data uit — geen JSX, geen DOM, geen state, dus los van React testbaar.
export function splitArenaSeatGroups<T>(participants: readonly T[]): {
  top: T[];
  bottom: T[];
} {
  const count = participants.length;
  if (count === 0) return { top: [], bottom: [] };
  // 1-2 spelers: geen aparte bovenrij nodig — beiden op de onderste rij
  // ("groot onder/bij centrum" resp. "links/rechts" van het spelvlak).
  if (count <= 2) return { top: [], bottom: [...participants] };
  // 3 spelers: 1 boven / 2 onder (driehoek rond het spelvlak).
  if (count === 3) {
    return {
      top: [...participants.slice(0, 1)],
      bottom: [...participants.slice(1)],
    };
  }
  // 5 spelers: 3 boven / 2 onder (expliciete voorkeur, i.p.v. de gelijke
  // ceil/floor-verdeling die 4/6/7/8 hieronder gebruiken).
  if (count === 5) {
    return {
      top: [...participants.slice(0, 3)],
      bottom: [...participants.slice(3)],
    };
  }
  // 4/6/7/8/9+: gelijk verdeeld, de bovenrij krijgt de eventuele extra
  // zetel bij een oneven aantal.
  const topCount = Math.ceil(count / 2);
  return {
    top: [...participants.slice(0, topCount)],
    bottom: [...participants.slice(topCount)],
  };
}
