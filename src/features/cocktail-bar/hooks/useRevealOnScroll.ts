import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/features/cocktail-bar/hooks/usePrefersReducedMotion";

// "Cards mogen langzaam in beeld schuiven" — een element fadet/schuift eenmalig
// in zodra het de viewport binnenkomt (IntersectionObserver, niet nog een
// scroll-listener naast useParallaxScroll). Blijft daarna altijd zichtbaar
// (geen uit-animatie bij terugscrollen — dat zou "druk" aanvoelen). Met
// reduced motion staat isVisible meteen op true, zodat er niets te
// animeren valt en de content simpelweg direct zichtbaar is.
export function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [isVisible, setIsVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setIsVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return { ref, isVisible };
}
