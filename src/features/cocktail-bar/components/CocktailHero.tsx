import { CocktailParallaxBackground } from "@/features/cocktail-bar/components/CocktailParallaxBackground";
import { useParallaxScroll } from "@/features/cocktail-bar/hooks/useParallaxScroll";

// Titel/subtitel vegen BIJ HET SCROLLEN sneller uit beeld dan de achtergrond
// erachter — WIPE_SPEED_FACTOR > 1 laat de tekst harder omhoog bewegen dan de
// scrollafstand zelf, en de opacity is al op FADE_DISTANCE_PX volledig 0, ruim
// vóór het einde van de hero. Reduced motion -> useParallaxScroll geeft 0
// terug, dus geen transform/fade: de titel blijft gewoon staan.
const WIPE_SPEED_FACTOR = 1.4;
const FADE_DISTANCE_PX = 320;

export function CocktailHero() {
  const scrollY = useParallaxScroll();
  const fadeProgress = Math.min(scrollY / FADE_DISTANCE_PX, 1);

  return (
    <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden rounded-3xl px-4 text-center sm:min-h-[70vh]">
      <CocktailParallaxBackground scrollY={scrollY} />
      <div
        className="relative z-10 max-w-2xl space-y-4"
        style={{
          transform: `translate3d(0, ${-scrollY * WIPE_SPEED_FACTOR}px, 0)`,
          opacity: 1 - fadeProgress,
        }}
      >
        <h1 className="cb-heading font-serif text-5xl sm:text-7xl">Cocktail Bar</h1>
        <p className="cb-muted text-base sm:text-lg">Handcrafted cocktails for unforgettable evenings.</p>
      </div>
    </section>
  );
}
