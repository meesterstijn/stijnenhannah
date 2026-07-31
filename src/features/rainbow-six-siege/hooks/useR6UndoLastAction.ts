import { useMemo } from "react";
import { useUndoR6Event } from "@/features/rainbow-six-siege/hooks/useR6Events";
import { useUndoR6MatchMvp } from "@/features/rainbow-six-siege/hooks/useR6SessionDetail";
import { determineR6LastUndoableAction } from "@/features/rainbow-six-siege/lib/scoring";
import type { R6Event, R6Match, R6ScoreRule } from "@/features/rainbow-six-siege/types";

/**
 * De "Laatste actie ongedaan maken"-knop (Tablet Controller) en het
 * undo-bare MVP-feeditem (R6RecentEventsFeed) draaien allebei via deze ene
 * hook exact dezelfde, centraal bepaalde laatste puntenactie terug — zie
 * determineR6LastUndoableAction (scoring.ts) voor de gamegrens-regel.
 *
 * Dispatcht naar de bestaande, ongewijzigde mutaties: useUndoR6Event voor
 * een echt event (precies zoals voorheen), useUndoR6MatchMvp voor een
 * MVP-toekenning (nieuw — zet alleen de mvp_*-kolommen van die match terug).
 * Geen eigen verwijderlogica hier, alleen de keuze tussen de twee.
 */
export function useR6UndoLastAction(sessionId: string, events: R6Event[], matches: R6Match[], scoreRules: R6ScoreRule[]) {
  const undoEvent = useUndoR6Event(sessionId);
  const undoMvp = useUndoR6MatchMvp(sessionId);

  const lastAction = useMemo(
    () => determineR6LastUndoableAction(events, matches, scoreRules),
    [events, matches, scoreRules],
  );

  function undo() {
    if (!lastAction) return;
    if (lastAction.kind === "mvp") {
      undoMvp.mutate(lastAction.matchId);
    } else {
      undoEvent.mutate(lastAction.id);
    }
  }

  return { lastAction, undo, isUndoing: undoEvent.isPending || undoMvp.isPending };
}
