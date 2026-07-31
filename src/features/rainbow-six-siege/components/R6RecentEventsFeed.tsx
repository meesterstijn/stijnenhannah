import { Undo2 } from "lucide-react";
import type { R6Event, R6Player, R6ScoreRule } from "@/features/rainbow-six-siege/types";

const RECENT_COUNT = 8;

// Laatste tikken, nieuwste eerst, elk met een directe "ongedaan maken"-knop
// — mistikken zijn onvermijdelijk met grote tegels, dus corrigeren moet
// net zo snel gaan als registreren (één tik, geen formulier).
export function R6RecentEventsFeed({
  events,
  players,
  quickActions,
  onUndo,
  lastUndoableActionId,
  onUndoMvp,
  isUndoingMvp,
}: {
  events: R6Event[];
  players: Map<string, R6Player>;
  quickActions: Map<string, R6ScoreRule>;
  onUndo: (eventId: string) => void;
  /** Id van de centraal bepaalde "laatste undo-bare actie" (zie
   * useR6UndoLastAction) — voor een MVP-feeditem is dat `mvp-${matchId}`.
   * Alleen het MVP-item met exact dit id krijgt hieronder een undo-knop;
   * oudere MVP-toekenningen blijven bewust niet-undo-baar (corrigeren van
   * die MVP hoort dan bij het bewerken van de match, niet bij deze feed). */
  lastUndoableActionId: string | null;
  onUndoMvp: () => void;
  isUndoingMvp: boolean;
}) {
  // `events` is al gecombineerd + chronologisch gesorteerd (nieuwste eerst)
  // door buildR6Feed (scoring.ts) — de ene centrale plek voor die logica,
  // ook gebruikt door Big Screen. Hier dus alleen nog afkappen op aantal.
  const recent = events.slice(0, RECENT_COUNT);

  if (recent.length === 0) {
    return <p className="text-xs text-zinc-500">Nog geen acties geregistreerd.</p>;
  }

  return (
    <div className="space-y-1.5">
      {recent.map((event) => {
        const rule = quickActions.get(event.score_rule_code);
        const isPending = event.id.startsWith("optimistic-");
        // MVP-toekenningen bij "Gimma afronden" zijn synthetische, alleen-
        // voor-weergave rijen (zie buildMvpFeedEvents in scoring.ts) — geen
        // echte r6_events-rij om ongedaan te maken via de gewone onUndo.
        // Alléén wanneer dít precies de centraal bepaalde laatste undo-bare
        // actie is (lastUndoableActionId), krijgt zo'n item alsnog een
        // undo-knop — via onUndoMvp, niet onUndo.
        const isSynthetic = event.id.startsWith("mvp-");
        const isLastUndoableMvp = isSynthetic && event.id === lastUndoableActionId;
        return (
          <div
            key={event.id}
            className={`flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-1.5 text-sm ${isPending ? "opacity-60" : ""}`}
          >
            <span className="truncate text-zinc-300">
              {rule?.icon ?? "•"} {players.get(event.player_id)?.name ?? "Onbekend"} — {rule?.name ?? event.score_rule_code}
              <span className="ml-1 text-xs text-zinc-500">
                ({event.points_awarded >= 0 ? "+" : ""}
                {event.points_awarded})
              </span>
            </span>
            {!isSynthetic && (
              <button
                type="button"
                onClick={() => onUndo(event.id)}
                disabled={isPending}
                className="shrink-0 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-rose-400 disabled:opacity-40"
                aria-label="Ongedaan maken"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            )}
            {isLastUndoableMvp && (
              <button
                type="button"
                onClick={onUndoMvp}
                disabled={isUndoingMvp}
                className="shrink-0 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-rose-400 disabled:opacity-40"
                aria-label="MVP ongedaan maken"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
