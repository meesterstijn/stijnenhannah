import { useEffect, useState } from "react";

// Zelfde matchMedia-check als elders in de app (Tuinieren.tsx, TuingidsLogboek.tsx),
// maar dan als live-bijgehouden hook i.p.v. eenmalige waarde — de Cocktail
// Bar-achtergrondlagen moeten direct stoppen zodra de gebruiker deze
// systeeminstelling tijdens het bezoek wijzigt, niet pas na een herlaad.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  return reduced;
}
