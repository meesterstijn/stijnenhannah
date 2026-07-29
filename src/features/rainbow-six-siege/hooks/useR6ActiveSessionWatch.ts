import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchActiveR6Sessions } from "@/features/rainbow-six-siege/lib/sessions";

export type R6ActiveSessionPhase = "searching" | "none" | "active";
export type R6RealtimeConnectionStatus = "connecting" | "connected" | "disconnected";

export type R6ActiveSessionWatchState = {
  /** id van de huidige actieve (status='live') LAN, of null als er geen is. */
  sessionId: string | null;
  phase: R6ActiveSessionPhase;
  /** Alleen voor een subtiele statusindicator — geen enkele render-logica
   * hangt hiervan af, de sessionId/phase hierboven blijven leidend. */
  connectionStatus: R6RealtimeConnectionStatus;
};

// Vast, voorspelbaar kanaal (niet per sessionId, want die kennen we hier
// juist nog niet) — er is precies één instantie van deze hook actief per
// gemonteerde RainbowSixSiegeAutoBigScreen-pagina, dus geen risico op
// botsende kanaalnamen.
const CHANNEL_NAME = "r6-active-session-watch";

/**
 * Vindt en volgt de huidige actieve (status='live') Rainbow Six Siege-LAN,
 * voor de permanente Big Screen-route (`/rainbow-six-siege/big-screen`) die
 * geen sessionId in de URL heeft. Gebruikt dezelfde "actief" = status='live'
 * definitie als overal elders (fetchActiveR6Session/fetchActiveR6Sessions) —
 * geen nieuwe statuslogica.
 *
 * Werkwijze: bij elke relevante wijziging (INSERT/UPDATE op r6_sessions,
 * elders in de app — bv. een andere tablet die een LAN start/beëindigt)
 * wordt de volledige lijst actieve sessies opnieuw opgehaald en
 * deterministisch gesorteerd (meest recent gestart eerst, dan created_at,
 * dan id) — geen incrementele patch-logica op de payload zelf, dat zou bij
 * gemiste/dubbele events makkelijk stale of inconsistente state opleveren.
 * Bij een reconnect (Realtime-kanaal was even weg) wordt om dezelfde reden
 * altijd opnieuw gequeried i.p.v. blind door te gaan op de laatst bekende
 * sessionId.
 */
export function useR6ActiveSessionWatch(): R6ActiveSessionWatchState {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<R6ActiveSessionPhase>("searching");
  const [connectionStatus, setConnectionStatus] = useState<R6RealtimeConnectionStatus>("connecting");
  const hasConnectedBeforeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const sessions = await fetchActiveR6Sessions();
        if (cancelled) return;
        if (sessions.length > 1) {
          // Zou niet moeten kunnen bij normaal gebruik (een LAN starten
          // beëindigt/vervangt geen andere), maar bij foutieve data (bv.
          // een handmatige databasewijziging) laten we Big Screen gewoon
          // doorwerken met de meest recente — zie fetchActiveR6Sessions.
          console.warn(
            `[R6 Big Screen] Meerdere actieve LAN's gevonden (${sessions.length}) — koos de meest recente: "${sessions[0].name}" (${sessions[0].id}). Rond de overige live-sessies af om dit te vermijden.`,
            sessions.map((s) => ({ id: s.id, name: s.name, started_at: s.started_at })),
          );
        }
        const next = sessions[0]?.id ?? null;
        setSessionId(next);
        setPhase(next ? "active" : "none");
      } catch (err) {
        if (cancelled) return;
        // Tijdelijke netwerk-/queryfout: laatst bekende sessionId/phase
        // bewust laten staan (niet blind naar de wachtweergave springen) —
        // de connectionStatus-indicator hieronder maakt dit wel zichtbaar.
        console.error("[R6 Big Screen] Kon actieve LAN niet ophalen", err);
      }
    }

    refresh();

    const channel = supabase
      .channel(CHANNEL_NAME)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "r6_sessions" }, () => refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "r6_sessions" }, () => refresh())
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          // Een SUBSCRIBED ná de allereerste keer betekent een reconnect
          // (kanaal was even weg) — dan kan er iets gemist zijn, dus altijd
          // opnieuw de actuele actieve LAN ophalen.
          if (hasConnectedBeforeRef.current) refresh();
          hasConnectedBeforeRef.current = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnectionStatus("disconnected");
        }
      });

    // Extra vangnet naast de Realtime-reconnect hierboven: als de browser
    // zelf (niet alleen het Realtime-kanaal) offline is geweest, bv. de
    // laptop ging dicht, forceer bij terugkomst ook een verse query.
    function handleOnline() {
      refresh();
    }
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      supabase.removeChannel(channel);
    };
  }, []);

  return { sessionId, phase, connectionStatus };
}
