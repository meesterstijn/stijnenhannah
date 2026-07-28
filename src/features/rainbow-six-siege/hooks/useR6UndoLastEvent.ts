import { useMemo } from "react";
import { useUndoR6Event } from "@/features/rainbow-six-siege/hooks/useR6Events";
import type { R6Event } from "@/features/rainbow-six-siege/types";

/**
 * Bepaalt en verwijdert exact het meest recente score-event van de HUIDIGE
 * actieve game (LIFO — last in, first out) — niet zomaar het laatste event
 * van de hele sessie, zodat het starten van een nieuwe game nooit
 * stilzwijgend een event uit de vorige, al afgeronde game terugdraait.
 * Hergebruikt de bestaande useUndoR6Event (hard delete, al RLS-beveiligd op
 * "alleen tijdens een live sessie") — geen nieuwe verwijderlogica, alleen
 * nieuwe "wat is het laatste event van déze game"-bepaling.
 *
 * Optimistische (nog niet server-bevestigde) events tellen niet mee als
 * kandidaat: hun id is een lokaal gegenereerde placeholder-string, geen
 * geldige database-uuid — die proberen te verwijderen zou een fout geven
 * i.p.v. een undo. Zodra zo'n event settelt (binnen enkele honderden ms)
 * wordt het gewoon de nieuwe geldige kandidaat.
 */
export function useR6UndoLastEvent(sessionId: string, events: R6Event[], currentMatchId: string | null) {
  const undoEvent = useUndoR6Event(sessionId);

  const lastEvent = useMemo(() => {
    if (!currentMatchId) return null;
    const candidates = events.filter((e) => e.match_id === currentMatchId && !e.id.startsWith("optimistic-"));
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => {
      const byDate = b.created_at.localeCompare(a.created_at);
      return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
    })[0];
  }, [events, currentMatchId]);

  function undoLastEvent() {
    if (!lastEvent) return;
    undoEvent.mutate(lastEvent.id);
  }

  return { lastEvent, undoLastEvent, isUndoing: undoEvent.isPending };
}
