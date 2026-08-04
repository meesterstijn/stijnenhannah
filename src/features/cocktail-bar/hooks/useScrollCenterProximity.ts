import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/features/cocktail-bar/hooks/usePrefersReducedMotion";

// Alleen bedoeld voor touch-oppervlakken zonder hover (Tabletmodus) — hover
// werkt daar niet, dus deze hook geeft per kaart een continue maat "hoe
// dicht bij het midden van het scherm" (0 = rand van de viewport, 1 =
// precies gecentreerd), bijgehouden via scrollen i.p.v. een muisstand.
// rAF-throttled net als useParallaxScroll, maar per element (getBoundingClientRect)
// i.p.v. globale window.scrollY. Reduced motion -> altijd 1 (volledig
// zichtbaar, geen doorlopende op-en-neer-beweging).
export function useScrollCenterProximity<T extends HTMLElement>(
  enabled = true,
) {
  const ref = useRef<T | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [proximity, setProximity] = useState(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!enabled) return;
    if (reducedMotion) {
      setProximity(1);
      return;
    }

    let pending = false;

    function update() {
      pending = false;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const viewportCenter = window.innerHeight / 2;
      const distance = Math.abs(elCenter - viewportCenter);
      const maxDistance = window.innerHeight / 2 + rect.height / 2;
      setProximity(Math.max(0, 1 - distance / maxDistance));
    }

    function onScroll() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled, reducedMotion]);

  return { ref, proximity };
}
