// Screen Wake Lock API met nette fallback — houdt het scherm wakker tijdens
// het spelen zolang de browser dit ondersteunt (o.a. niet op iOS Safari <16.4
// en niet in elke WebView); `supported` laat de UI dat stil negeren i.p.v.
// een foutmelding te tonen. De lock wordt door de browser zelf losgelaten
// zodra het tabblad naar de achtergrond gaat (bv. schermvergrendeling) — bij
// terugkeer wordt 'm hier automatisch opnieuw aangevraagd zolang de
// speelmodus dat nog wil (desiredRef), zonder dat de aanroepende component
// daar zelf op hoeft te letten.

import { useCallback, useEffect, useRef, useState } from "react";

export function useWakeLock() {
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const desiredRef = useRef(false);

  const request = useCallback(async () => {
    desiredRef.current = true;
    if (!supported) return;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener("release", () => setActive(false));
    } catch {
      setActive(false);
    }
  }, [supported]);

  const release = useCallback(async () => {
    desiredRef.current = false;
    try {
      await sentinelRef.current?.release();
    } catch {
      // ignore
    }
    sentinelRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => {
    if (!supported) return;
    function onVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        desiredRef.current &&
        sentinelRef.current === null
      ) {
        request();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [supported, request]);

  useEffect(() => {
    return () => {
      sentinelRef.current?.release().catch(() => {});
    };
  }, []);

  return { supported, active, request, release };
}
