import { useCallback, useEffect, useRef, useState } from "react";

export type ScreenWakeLockState = "unsupported" | "inactive" | "active";

/**
 * Screen Wake Lock API, met feature-detectie en herstel na terugkomen uit
 * de achtergrond (bv. de tablet dimde het scherm even terwijl de app op de
 * achtergrond stond). Vraagt NOOIT vanzelf een wake lock aan bij mount —
 * dat moet altijd een gevolg zijn van een bewuste gebruikersactie (zie
 * `request()`, aangeroepen vanuit R6TabletController) — sommige browsers
 * weigeren de aanvraag anders sowieso, en het is ook explicieter gedrag.
 */
export function useScreenWakeLock() {
  const [state, setState] = useState<ScreenWakeLockState>(() =>
    typeof navigator !== "undefined" && "wakeLock" in navigator ? "inactive" : "unsupported",
  );
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const wantActiveRef = useRef(false);

  const request = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      setState("unsupported");
      return;
    }
    wantActiveRef.current = true;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setState("active");
      sentinel.addEventListener("release", () => {
        sentinelRef.current = null;
        setState((prev) => (prev === "unsupported" ? prev : "inactive"));
      });
    } catch {
      // Geen blokkerende foutmelding — de controller blijft gewoon bruikbaar
      // zonder wake lock (niet-ondersteunde context, of geweigerd door bv.
      // batterijbesparing). De statusindicator in de UI toont dit al.
      setState("inactive");
    }
  }, []);

  const release = useCallback(async () => {
    wantActiveRef.current = false;
    try {
      await sentinelRef.current?.release();
    } catch {
      // negeren — sentinel kan al vrijgegeven zijn
    }
    sentinelRef.current = null;
  }, []);

  // Herstel de wake lock zodra het tabblad weer zichtbaar wordt, als de
  // gebruiker 'm bewust actief had gezet — een wake lock wordt door de
  // browser automatisch losgelaten zodra het tabblad naar de achtergrond gaat.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && wantActiveRef.current && !sentinelRef.current) {
        request();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [request]);

  useEffect(() => {
    return () => {
      sentinelRef.current?.release().catch(() => {});
    };
  }, []);

  return { state, request, release };
}
