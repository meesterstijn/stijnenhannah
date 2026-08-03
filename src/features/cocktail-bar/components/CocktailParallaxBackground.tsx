import { useMemo } from "react";

// De "levende" achtergrond achter de hero (en later, hergebruikt, achter het
// Big Screen-idlescherm — zie het Cocktail Bar-implementatieplan §6). Zes
// onafhankelijke lagen:
//   1. glow-slow    — heel langzame scroll-parallax
//   2. glow-fast     — iets snellere scroll-parallax
//   3. smoke         — lichte rook (ambient drift + eigen, tragere scroll-snelheid)
//   4. shimmer        — lichtreflecties (ambient pulse + scroll-snelheid)
//   5. dust           — zwevende gouden stofdeeltjes (ambient float + scroll-snelheid)
//   6. wave            — subtiele vloeistofgolven onderaan (ambient + snelste scroll-snelheid)
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
const DUST_PARTICLE_COUNT = 14;

type DustParticle = {
  left: number;
  size: number;
  duration: number;
  delay: number;
};

export function CocktailParallaxBackground({ scrollY }: { scrollY: number }) {
  const dustParticles = useMemo<DustParticle[]>(() => {
    // Eenmalig bij mount vaste, "willekeurig aandoende" posities/tijden
    // bepalen — niet bij elke render opnieuw, dat zou de stofdeeltjes
    // constant laten "springen" i.p.v. rustig laten zweven.
    return Array.from({ length: DUST_PARTICLE_COUNT }, () => ({
      left: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: 18 + Math.random() * 22,
      delay: Math.random() * -30,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Laag 1 — heel langzame gouden glow, linksboven */}
      <div style={{ transform: `translate3d(0, ${scrollY * 0.03}px, 0)` }} className="absolute inset-0">
        <div className="absolute -left-1/4 -top-1/4 h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle,oklch(0.4_0.09_60_/_0.22),transparent_70%)]" />
      </div>

      {/* Laag 2 — iets snellere amberglow, rechtsonder */}
      <div style={{ transform: `translate3d(0, ${scrollY * 0.08}px, 0)` }} className="absolute inset-0">
        <div className="absolute -right-1/4 bottom-0 h-[60%] w-[60%] rounded-full bg-[radial-gradient(circle,oklch(0.35_0.08_55_/_0.18),transparent_70%)]" />
      </div>

      {/* Laag 3 — lichte rook */}
      <div style={{ transform: `translate3d(0, ${scrollY * 0.05}px, 0)` }} className="absolute inset-0">
        <div className="cb-layer-smoke absolute left-1/3 top-1/4 h-[50%] w-[80%] rounded-full bg-[radial-gradient(ellipse,oklch(0.6_0.01_280_/_0.06),transparent_70%)] blur-2xl" />
      </div>

      {/* Laag 4 — lichtreflecties */}
      <div style={{ transform: `translate3d(0, ${scrollY * 0.1}px, 0)` }} className="absolute inset-0">
        <div className="cb-layer-shimmer absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-[oklch(0.82_0.12_82_/_0.4)] to-transparent" />
        <div className="cb-layer-shimmer absolute left-[20%] top-0 h-full w-px bg-gradient-to-b from-transparent via-[oklch(0.82_0.12_82_/_0.25)] to-transparent" style={{ animationDelay: "-3s" }} />
        <div className="cb-layer-shimmer absolute left-[80%] top-0 h-full w-px bg-gradient-to-b from-transparent via-[oklch(0.82_0.12_82_/_0.25)] to-transparent" style={{ animationDelay: "-6s" }} />
      </div>

      {/* Laag 5 — zwevende gouden stofdeeltjes */}
      <div style={{ transform: `translate3d(0, ${scrollY * 0.14}px, 0)` }} className="absolute inset-0">
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

      {/* Laag 6 — subtiele vloeistofgolven onderaan */}
      <div style={{ transform: `translate3d(0, ${scrollY * 0.18}px, 0)` }} className="absolute inset-x-0 bottom-0">
        <div className="cb-layer-wave h-40 w-full bg-[radial-gradient(ellipse_80%_100%_at_50%_100%,oklch(0.3_0.07_60_/_0.25),transparent_70%)]" />
      </div>
    </div>
  );
}
