import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

// Basissnelheden in px/s bij speed-index 0..3 — "meerdere snelheden",
// onthouden zolang logisch (section 14: hier zolang de browser-opslag leeft,
// niet alleen voor de sessie).
export const AUTO_SCROLL_SPEEDS = [16, 28, 42, 60] as const;
export const AUTO_SCROLL_SPEED_LABELS = [
  "Rustig",
  "Normaal",
  "Vlot",
  "Snel",
] as const;

export function useAutoScroll(containerRef: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  const [speedIndex, setSpeedIndex] = useLocalStorage(
    "guitar-autoscroll-speed-index",
    1,
  );
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const clampedSpeedIndex = Math.min(
    Math.max(speedIndex, 0),
    AUTO_SCROLL_SPEEDS.length - 1,
  );
  const pxPerSecond = AUTO_SCROLL_SPEEDS[clampedSpeedIndex];

  const stop = useCallback(() => setActive(false), []);
  const start = useCallback(() => setActive(true), []);
  const toggle = useCallback(() => setActive((a) => !a), []);
  const cycleSpeed = useCallback(() => {
    setSpeedIndex(
      (i) =>
        (Math.min(Math.max(i, 0), AUTO_SCROLL_SPEEDS.length - 1) + 1) %
        AUTO_SCROLL_SPEEDS.length,
    );
  }, [setSpeedIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) {
      lastTsRef.current = null;
      return;
    }

    function tick(ts: number) {
      const el = containerRef.current;
      if (!el) return;
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      el.scrollTop += (dt / 1000) * pxPerSecond;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        setActive(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, pxPerSecond, containerRef]);

  // Handmatig scrollen tijdens autoscroll pauzeert direct i.p.v. ertegen te
  // "vechten" — section 14: "handmatig scrollen mag de pagina niet
  // kapotmaken". programmatic scrollTop-writes hierboven vuren geen
  // wheel/touchmove, dus dit reageert alleen op echte gebruikersinvoer.
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;
    function pause() {
      setActive(false);
    }
    container.addEventListener("wheel", pause, { passive: true });
    container.addEventListener("touchmove", pause, { passive: true });
    return () => {
      container.removeEventListener("wheel", pause);
      container.removeEventListener("touchmove", pause);
    };
  }, [active, containerRef]);

  return {
    active,
    start,
    stop,
    toggle,
    speedIndex: clampedSpeedIndex,
    speedLabel: AUTO_SCROLL_SPEED_LABELS[clampedSpeedIndex],
    cycleSpeed,
  };
}
