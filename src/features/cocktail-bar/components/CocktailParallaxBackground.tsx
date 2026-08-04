import { useMemo } from "react";

// De "levende" achtergrond achter de hero én het Big Screen-idlescherm. Twee
// varianten:
//   - "layered" (default, Big Screen-idlescherm): alle zes lagen — glow-slow/
//     glow-fast/smoke/shimmer/dust/wave.
//   - "dust-only" (CocktailHero, dus de Cocktails-overzichtpagina + Tabletmodus):
//     alleen de gouden stofdeeltjes, groter/talrijker dan de layered-variant,
//     tegen de gewone vlakke paginakleur (.cocktail-theme) i.p.v. de gouden
//     strepen/vlekken van de andere lagen.
//
// Belangrijk: de scroll-gekoppelde verplaatsing (deze component, via inline
// `transform`) en de ambient CSS-animaties (`.cb-layer-*` in styles.css)
// staan op TWEE geneste elementen, nooit op hetzelfde element — een CSS
// `animation` die `transform` animeert zou anders de inline scroll-transform
// van hetzelfde element overschrijven. Alles puur CSS/transform, geen
// animatiebibliotheek.
//
// `scrollY` komt als prop van de aanroeper (CocktailHero) i.p.v. hier zelf
// useParallaxScroll() aan te roepen — anders zouden er twee onafhankelijke
// rAF-scroll-listeners actief zijn (één hier, één voor het uitveegeffect op
// de titel) die precies dezelfde waarde bijhouden. Één bron, hergebruikt.
// Reduced motion -> de aanroeper geeft al 0 door, dus deze lagen staan dan
// gewoon stil.
const DUST_PARTICLE_COUNT_LAYERED = 14;
const DUST_PARTICLE_COUNT_DUST_ONLY = 24;

// Grote bollen scrollen sneller omhoog dan kleine — dat afstandseffect
// (dichterbij = groter + sneller) is alleen voor dust-only ingebouwd, de
// deeltjes lopen hier dus van 4-10px (zie hieronder).
const DUST_ONLY_MIN_SIZE = 4;
const DUST_ONLY_SIZE_RANGE = 6;
const DUST_ONLY_MIN_SPEED = 0.05;
const DUST_ONLY_SPEED_RANGE = 0.4;

function dustOnlyScrollSpeed(size: number): number {
  const sizeRatio = (size - DUST_ONLY_MIN_SIZE) / DUST_ONLY_SIZE_RANGE;
  return DUST_ONLY_MIN_SPEED + sizeRatio * DUST_ONLY_SPEED_RANGE;
}

type DustParticle = {
  left: number;
  top: number | null;
  size: number;
  duration: number;
  delay: number;
};

export function CocktailParallaxBackground({
  scrollY,
  variant = "layered",
}: {
  scrollY: number;
  variant?: "layered" | "dust-only";
}) {
  const isDustOnly = variant === "dust-only";

  const dustParticles = useMemo<DustParticle[]>(() => {
    // Eenmalig bij mount vaste, "willekeurig aandoende" posities/tijden
    // bepalen — niet bij elke render opnieuw, dat zou de stofdeeltjes
    // constant laten "springen" i.p.v. rustig laten zweven.
    const count = isDustOnly
      ? DUST_PARTICLE_COUNT_DUST_ONLY
      : DUST_PARTICLE_COUNT_LAYERED;
    return Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      // Alleen dust-only verspreidt de deeltjes over de hele hoogte (anders
      // clusterden ze allemaal onderaan) — de layered-variant (Big Screen-
      // idlescherm) blijft ongewijzigd op `bottom: 0`.
      top: isDustOnly ? 5 + Math.random() * 90 : null,
      size: isDustOnly ? 4 + Math.random() * 6 : 2 + Math.random() * 3,
      duration: 18 + Math.random() * 22,
      delay: Math.random() * -30,
    }));
  }, [isDustOnly]);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {!isDustOnly && (
        <>
          {/* Laag 1 — heel langzame gouden glow, linksboven */}
          <div
            style={{ transform: `translate3d(0, ${scrollY * 0.03}px, 0)` }}
            className="absolute inset-0"
          >
            <div className="absolute -left-1/4 -top-1/4 h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle,oklch(0.4_0.09_60_/_0.22),transparent_70%)]" />
          </div>

          {/* Laag 2 — iets snellere amberglow, rechtsonder */}
          <div
            style={{ transform: `translate3d(0, ${scrollY * 0.08}px, 0)` }}
            className="absolute inset-0"
          >
            <div className="absolute -right-1/4 bottom-0 h-[60%] w-[60%] rounded-full bg-[radial-gradient(circle,oklch(0.35_0.08_55_/_0.18),transparent_70%)]" />
          </div>

          {/* Laag 3 — lichte rook */}
          <div
            style={{ transform: `translate3d(0, ${scrollY * 0.05}px, 0)` }}
            className="absolute inset-0"
          >
            <div className="cb-layer-smoke absolute left-1/3 top-1/4 h-[50%] w-[80%] rounded-full bg-[radial-gradient(ellipse,oklch(0.6_0.01_280_/_0.06),transparent_70%)] blur-2xl" />
          </div>

          {/* Laag 4 — lichtreflecties */}
          <div
            style={{ transform: `translate3d(0, ${scrollY * 0.1}px, 0)` }}
            className="absolute inset-0"
          >
            <div className="cb-layer-shimmer absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-[oklch(0.82_0.12_82_/_0.4)] to-transparent" />
            <div
              className="cb-layer-shimmer absolute left-[20%] top-0 h-full w-px bg-gradient-to-b from-transparent via-[oklch(0.82_0.12_82_/_0.25)] to-transparent"
              style={{ animationDelay: "-3s" }}
            />
            <div
              className="cb-layer-shimmer absolute left-[80%] top-0 h-full w-px bg-gradient-to-b from-transparent via-[oklch(0.82_0.12_82_/_0.25)] to-transparent"
              style={{ animationDelay: "-6s" }}
            />
          </div>
        </>
      )}

      {/* Laag 5 — zwevende gouden stofdeeltjes (beide varianten, dust-only heeft er meer en grotere).
          dust-only heeft per deeltje zijn EIGEN scroll-snelheid (op basis van
          grootte) i.p.v. één gedeelde snelheid voor de hele laag — vandaar een
          los wrapper-span per deeltje voor de scroll-transform, met de
          cb-layer-dust-animatie (die ook `transform` gebruikt) op een geneste
          kind-span, nooit op hetzelfde element (zie bovenaan dit bestand). De
          layered-variant blijft de oude, ongewijzigde gedeelde-laag-opzet. */}
      {isDustOnly ? (
        // mask-image i.p.v. per-deeltje opacity-berekening: dit vervaagt
        // ALLES wat de rand van dit vak nadert naar 0% — onafhankelijk van
        // welke combinatie van scroll-snelheid/ambient float een deeltje daar
        // bracht — precies "net voordat ze uit beeld scrollen".
        <div
          className="absolute inset-0"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
          }}
        >
          {dustParticles.map((p, i) => (
            <span
              key={i}
              className="absolute"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                transform: `translate3d(0, ${scrollY * dustOnlyScrollSpeed(p.size)}px, 0)`,
              }}
            >
              <span
                className="cb-layer-dust block rounded-full bg-[oklch(0.82_0.12_82_/_0.6)]"
                style={{
                  width: p.size,
                  height: p.size,
                  boxShadow: "0 0 8px 1px oklch(0.82 0.12 82 / 0.5)",
                  animationDuration: `${p.duration}s`,
                  animationDelay: `${p.delay}s`,
                }}
              />
            </span>
          ))}
        </div>
      ) : (
        <div
          style={{ transform: `translate3d(0, ${scrollY * 0.14}px, 0)` }}
          className="absolute inset-0"
        >
          {dustParticles.map((p, i) => (
            <span
              key={i}
              className="cb-layer-dust absolute rounded-full bg-[oklch(0.82_0.12_82_/_0.6)]"
              style={{
                left: `${p.left}%`,
                bottom: 0,
                width: p.size,
                height: p.size,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {!isDustOnly && (
        /* Laag 6 — subtiele vloeistofgolven onderaan */
        <div
          style={{ transform: `translate3d(0, ${scrollY * 0.18}px, 0)` }}
          className="absolute inset-x-0 bottom-0"
        >
          <div className="cb-layer-wave h-40 w-full bg-[radial-gradient(ellipse_80%_100%_at_50%_100%,oklch(0.3_0.07_60_/_0.25),transparent_70%)]" />
        </div>
      )}
    </div>
  );
}
