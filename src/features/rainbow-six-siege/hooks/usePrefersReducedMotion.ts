import { useEffect, useState } from "react";

/** Voor het respecteren van prefers-reduced-motion (Chaos Wheel-cycling,
 * tik-feedback-animaties) — gedeeld i.p.v. losse matchMedia-calls per plek. */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    function handleChange() {
      setPrefersReduced(mql.matches);
    }
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return prefersReduced;
}
