import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/features/cocktail-bar/hooks/usePrefersReducedMotion";

// Scroll-gekoppelde parallax voor de achtergrondlagen: rAF-throttled i.p.v.
// een scroll-listener die bij elke event direct setState aanroept (dat zou
// meerdere keren per frame kunnen renderen). `pending` voorkomt dat een
// tweede scroll-event een tweede rAF inplant vóór de eerste is afgehandeld.
// Geeft altijd 0 terug — en luistert dan ook helemaal niet — wanneer de
// gebruiker reduced motion heeft aangevraagd, zodat elke laag die dit
// hergebruikt zonder extra moeite stil blijft staan.
export function useParallaxScroll(): number {
  const reducedMotion = usePrefersReducedMotion();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;

    let pending = false;
    function onScroll() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        pending = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reducedMotion]);

  return reducedMotion ? 0 : scrollY;
}
