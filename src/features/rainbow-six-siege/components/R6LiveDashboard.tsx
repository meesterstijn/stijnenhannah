import type { ReactNode } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { R6PlayerActionTiles } from "@/features/rainbow-six-siege/components/R6PlayerActionTiles";
import { R6RecentEventsFeed } from "@/features/rainbow-six-siege/components/R6RecentEventsFeed";
import { R6QuickActionSettings } from "@/features/rainbow-six-siege/components/R6QuickActionSettings";
import { R6ChaosWheel } from "@/features/rainbow-six-siege/components/R6ChaosWheel";
import { R6OperatorWheel } from "@/features/rainbow-six-siege/components/R6OperatorWheel";
import { useR6Operators } from "@/features/rainbow-six-siege/hooks/useR6Reference";
import { useR6GameOperatorAssignments } from "@/features/rainbow-six-siege/hooks/useR6OperatorWheel";
import { useAcceptR6ChaosEffect, useR6ChaosEffects, useR6SessionChaosEffects } from "@/features/rainbow-six-siege/hooks/useR6ChaosEffects";
import type { R6Event, R6Match, R6Player, R6ScoreboardEntry, R6ScoreRule } from "@/features/rainbow-six-siege/types";

// Het hoofdscherm tijdens het spelen: live scorebord bovenaan, daaronder
// per speler een grote kaart met klikbare actietegels. Eén tik = direct
// geregistreerd, geen formulier, geen bevestiging (zie redesignfilosofie).
// Een "Gimma" is één volledige Rainbow Six-map — bewust niet "ronde" genoemd
// (dat woord gebruikt Rainbow Six zelf al voor de rondes ÍN een map, wat
// alleen maar verwarring geeft). Een Gimma is puur een container waarin
// gebeurtenissen verzameld worden; "Gimma afronden" (zie R6EndGameSheet) is
// het enige moment met een (klein) formulier — verder alleen tikken.
export function R6LiveDashboard({
  sessionId,
  scoreboard,
  roster,
  quickActions,
  players,
  currentMatch,
  events,
  onTap,
  onUndo,
  lastUndoableActionId,
  onUndoLastAction,
  isUndoingLastAction,
  onEndGame,
  controlsRow,
}: {
  sessionId: string;
  scoreboard: R6ScoreboardEntry[];
  roster: R6Player[];
  quickActions: R6ScoreRule[];
  players: Map<string, R6Player>;
  currentMatch: R6Match | null;
  events: R6Event[];
  onTap: (playerId: string, rule: R6ScoreRule) => void;
  onUndo: (eventId: string) => void;
  /** Id van de centraal bepaalde "laatste undo-bare actie" (zie
   * useR6UndoLastAction) — voor een echt event is dat het event-id zelf,
   * voor een MVP-toekenning `mvp-${matchId}` (zelfde vorm als
   * buildMvpFeedEvents gebruikt). Alleen het feeditem met exact dit id mag
   * een MVP-undo-knop tonen; alle overige (oudere) MVP-items in de feed
   * blijven niet-undo-baar, gewone events blijven zoals altijd individueel
   * undo-baar via `onUndo`. */
  lastUndoableActionId: string | null;
  onUndoLastAction: () => void;
  isUndoingLastAction: boolean;
  onEndGame: () => void;
  /** Live/Geschiedenis-toggle + LAN beëindigen/verwijderen — hier tussen de
   * actietegels en "Laatste acties" gerenderd op verzoek van de gebruiker
   * (elders in de app staat dezelfde rij bovenaan, zie RainbowSixSiegeSession.tsx). */
  controlsRow: ReactNode;
}) {
  const quickActionsByCode = new Map(quickActions.map((r) => [r.code, r]));
  const currentGameEvents = currentMatch ? events.filter((e) => e.match_id === currentMatch.id) : [];
  // Geen aparte ranglijst meer bovenaan — de punten staan al bij elke
  // spelerskaart, vlak boven de actietegels. Twee keer dezelfde punten
  // tonen kostte alleen maar ruimte zonder extra informatie. De tik-kaarten
  // staan bewust in vaste rooster-volgorde (niet gesorteerd op score): een
  // kaart die van plek wisselt net nadat je 'm hebt aangetikt zou de
  // volgende tik juist moeilijker maken.
  const entryByPlayerId = new Map(scoreboard.map((entry) => [entry.player.id, entry]));

  const { data: operators = [] } = useR6Operators();
  const operatorsById = new Map(operators.map((o) => [o.id, o]));
  const { data: operatorAssignments = [] } = useR6GameOperatorAssignments(currentMatch?.id ?? null);
  const assignmentByPlayerId = new Map(operatorAssignments.map((a) => [a.player_id, a]));

  const { data: chaosEffects = [] } = useR6ChaosEffects();
  const chaosEffectsById = new Map(chaosEffects.map((e) => [e.id, e]));
  const { data: sessionChaosEffects = [] } = useR6SessionChaosEffects(sessionId);
  const activeChaosEffect = currentMatch
    ? sessionChaosEffects.find((sce) => sce.match_id === currentMatch.id && sce.chaos_effect_id)
    : undefined;
  const activeChaosEffectName = activeChaosEffect?.chaos_effect_id ? chaosEffectsById.get(activeChaosEffect.chaos_effect_id)?.name : undefined;
  const acceptChaosEffect = useAcceptR6ChaosEffect(sessionId);

  return (
    <div className="space-y-4">
      {activeChaosEffectName && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center">
          <p className="text-xs uppercase tracking-wide text-amber-400/70">Actieve chaosregel</p>
          <p className="font-serif text-lg font-bold text-amber-400">{activeChaosEffectName}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-400">{currentMatch ? `Gimma ${currentMatch.match_number} bezig` : "Gimma wordt gestart…"}</p>
        <div className="flex flex-wrap gap-2">
          {currentMatch && (
            <R6ChaosWheel
              matchNumber={currentMatch.match_number}
              onAccept={(chaosEffectId) => acceptChaosEffect.mutate({ matchId: currentMatch.id, chaosEffectId })}
              isSaving={acceptChaosEffect.isPending}
            />
          )}
          {currentMatch && (
            <R6OperatorWheel sessionId={sessionId} matchId={currentMatch.id} roster={roster} />
          )}
          <R6QuickActionSettings />
          <Button
            type="button"
            className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
            onClick={onEndGame}
            disabled={!currentMatch}
          >
            <Flag className="h-4 w-4" /> Gimma afronden
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {roster.map((player) => {
          const entry = entryByPlayerId.get(player.id);
          const assignment = assignmentByPlayerId.get(player.id);
          const attackerName = assignment?.attacker_operator_id ? operatorsById.get(assignment.attacker_operator_id)?.name : null;
          const defenderName = assignment?.defender_operator_id ? operatorsById.get(assignment.defender_operator_id)?.name : null;
          return (
            <div key={player.id} className="flex-1 basis-0 min-w-[240px] space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <p className="truncate font-serif text-xl font-semibold text-zinc-100">{player.name}</p>
                  {(attackerName || defenderName) && (
                    <span className="shrink-0 text-xs font-semibold text-amber-400">
                      {attackerName ?? "—"} / {defenderName ?? "—"}
                    </span>
                  )}
                </div>
                <p className="shrink-0 font-serif text-2xl font-bold text-amber-400">{entry?.totalPoints ?? 0}</p>
              </div>
              <R6PlayerActionTiles
                quickActions={quickActions}
                disabled={!currentMatch}
                onTap={(rule) => onTap(player.id, rule)}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">{controlsRow}</div>

      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-300">Laatste acties (deze Gimma eerst)</p>
        <R6RecentEventsFeed
          events={currentGameEvents.length > 0 ? currentGameEvents : events}
          players={players}
          quickActions={quickActionsByCode}
          onUndo={onUndo}
          lastUndoableActionId={lastUndoableActionId}
          onUndoMvp={onUndoLastAction}
          isUndoingMvp={isUndoingLastAction}
        />
      </section>
    </div>
  );
}
