import { useMemo } from "react";

// De "levende" achtergrond achter de hero (CocktailHero.tsx — dus de
// Cocktails-overzichtpagina en de Tabletmodus). Puur gouden stofdeeltjes,
// verspreid over de hele hoogte, elk met een eigen scroll-snelheid op basis
// van grootte (groot = dichterbij = sneller) voor een afstandseffect. Het
// Big Screen-idlescherm gebruikt dit component niet (puur de vlakke
// .cocktail-theme achtergrondkleur, geen strepen/bollen/gloed — zie
// CocktailBigScreenIdle.tsx).
//
// Belangrijk: de scroll-gekoppelde verplaatsing (per deeltje, via inline
// `transform` op een wrapper-span) en de ambient CSS-animatie (`cb-layer-dust`
// in styles.css, die ook `transform` gebruikt) staan op TWEE geneste
// elementen, nooit op hetzelfde element — anders zou de CSS-animation de
// inline scroll-transform overschrijven. Alles puur CSS/transform, geen
// animatiebibliotheek.
//
// `scrollY` komt als prop van de aanroeper (CocktailHero) i.p.v. hier zelf
// useParallaxScroll() aan te roepen — anders zouden er twee onafhankelijke
// rAF-scroll-listeners actief zijn (één hier, één voor het uitveegeffect op
// de titel) die precies dezelfde waarde bijhouden. Één bron, hergebruikt.
// Reduced motion -> de aanroeper geeft al 0 door, dus deze laag staat dan
// gewoon stil.
const DUST_PARTICLE_COUNT = 24;
const MIN_SIZE = 4;
const SIZE_RANGE = 6;

// Grote bollen scrollen sneller omhoog dan kleine (afstandseffect).
const MIN_SPEED = 0.05;
const SPEED_RANGE = 0.4;

function dustScrollSpeed(size: number): number {
  const sizeRatio = (size - MIN_SIZE) / SIZE_RANGE;
  return MIN_SPEED + sizeRatio * SPEED_RANGE;
}

type DustParticle = {
  left: number;
  top: number;
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
      top: 5 + Math.random() * 90,
      size: MIN_SIZE + Math.random() * SIZE_RANGE,
      duration: 18 + Math.random() * 22,
      delay: Math.random() * -30,
    }));
  }, []);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* mask-image vervaagt alles wat de rand van dit vak nadert naar 0% —
          onafhankelijk van welke combinatie van scroll-snelheid/ambient float
          een deeltje daar bracht — precies "net voordat ze uit beeld scrollen". */}
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
              transform: `translate3d(0, ${scrollY * dustScrollSpeed(p.size)}px, 0)`,
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
    </div>
  );
}
