import { useEffect, useState } from "react";
import type { GameNightSessionStatus } from "@/lib/supabase";

// Verstreken speeltijd — de BRON is altijd `started_at`/`total_paused_seconds`/
// `paused_at`/`ended_at` uit Supabase (opdracht sectie 12: nooit `useState(0)`
// als enige bron). Deze hook doet alleen de live weergave: bij status
// "active" tikt hij elke seconde door vanaf de database-tijdstippen; bij
// "paused" bevriest hij op het moment van pauzeren; bij "completed" bevriest
// hij op `ended_at`. Na een reload berekent dezelfde formule gewoon opnieuw
// het juiste verstreken aantal seconden, dus de klok "loopt logisch door".
export function useElapsedSeconds(session: {
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
  total_paused_seconds: number;
  status: GameNightSessionStatus;
}): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (session.status !== "active") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session.status]);

  const referenceEndMs = session.ended_at
    ? new Date(session.ended_at).getTime()
    : session.status === "paused" && session.paused_at
      ? new Date(session.paused_at).getTime()
      : now;

  const startedMs = new Date(session.started_at).getTime();
  const elapsedMs =
    referenceEndMs - startedMs - session.total_paused_seconds * 1000;

  return Math.max(0, Math.floor(elapsedMs / 1000));
}
