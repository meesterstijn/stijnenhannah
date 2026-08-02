import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, Maximize, Minimize, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { R6PlayerActionTiles } from "@/features/rainbow-six-siege/components/R6PlayerActionTiles";
import { R6ChaosWheel } from "@/features/rainbow-six-siege/components/R6ChaosWheel";
import { R6OperatorWheel } from "@/features/rainbow-six-siege/components/R6OperatorWheel";
import { R6QuickActionSettings } from "@/features/rainbow-six-siege/components/R6QuickActionSettings";
import { useScreenWakeLock } from "@/features/rainbow-six-siege/hooks/useScreenWakeLock";
import { useR6UndoLastAction } from "@/features/rainbow-six-siege/hooks/useR6UndoLastAction";
import { useR6Permissions } from "@/lib/permissions";
import type {
  R6ChaosEffect,
  R6Event,
  R6GameOperatorAssignment,
  R6Map,
  R6Match,
  R6Operator,
  R6Player,
  R6ScoreboardEntry,
  R6ScoreRule,
  R6Session,
} from "@/features/rainbow-six-siege/types";

/**
 * Vaste, tabletgerichte compositie voor tijdens het spelen — twee vaste
 * spelerskolommen (speler 1 altijd links, speler 2 altijd rechts, nooit
 * herschikt op score), een compact live scorebord, en alle secundaire acties
 * onderaan in één rij. Bewust een EIGEN presentatiecomponent i.p.v.
 * hergebruik van R6LiveDashboard: die is ontworpen voor een responsive,
 * verticaal scrollende pagina (flex-wrap kaarten, losse secties) — precies
 * wat hier niet gewenst is. De databronnen/mutaties (scoring, events,
 * wheels, actietegels-beheer) zijn wél exact dezelfde, via dezelfde hooks en
 * gedeelde subcomponenten (R6PlayerActionTiles, R6OperatorWheel,
 * R6ChaosWheel, R6QuickActionSettings).
 */
export function R6TabletController({
  sessionId,
  session,
  roster,
  scoreboard,
  quickActions,
  scoreRules,
  currentMatch,
  matches,
  events,
  maps,
  operators,
  operatorAssignments,
  chaosEffects,
  activeChaosEffectId,
  onTap,
  onAcceptChaosEffect,
  isAcceptingChaosEffect,
  onEndGame,
}: {
  sessionId: string;
  session: R6Session;
  roster: R6Player[];
  scoreboard: R6ScoreboardEntry[];
  quickActions: R6ScoreRule[];
  scoreRules: R6ScoreRule[];
  currentMatch: R6Match | null;
  matches: R6Match[];
  events: R6Event[];
  maps: R6Map[];
  operators: R6Operator[];
  operatorAssignments: R6GameOperatorAssignment[];
  chaosEffects: R6ChaosEffect[];
  activeChaosEffectId: string | null;
  onTap: (playerId: string, rule: R6ScoreRule) => void;
  onAcceptChaosEffect: (chaosEffectId: string) => void;
  isAcceptingChaosEffect: boolean;
  onEndGame: () => void;
}) {
  const isLive = session.status === "live";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wakeLock = useScreenWakeLock();
  const undo = useR6UndoLastAction(sessionId, events, matches, scoreRules);
  const { canManageR6Rules } = useR6Permissions();

  useEffect(() => {
    if (isLive) wakeLock.request();
    return () => {
      wakeLock.release();
    };
    // Alleen bij het live worden/verlaten van de sessie opnieuw beoordelen,
    // niet bij elke render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Mobiele browsers (vooral iOS Safari) passen anders een "vastzittende"
  // :hover-stijl toe na een tik — dat blijft normaliter alleen achterwege
  // als er ECHTE touch-eventlisteners op de pagina actief zijn (browsers
  // vallen anders terug op hover-emulatie voor compatibiliteit met sites
  // die geen touch-ondersteuning hebben). Een lege, passieve listener is
  // genoeg om die emulatie uit te schakelen — vandaar geen verdere logica
  // hier nodig.
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else {
        // Bewust op de hele document — niet op de eigen root-div: Sheets/
        // Dialogs (Chaos Wheel, Actietegels beheren, Game afronden) worden
        // via een Portal naar document.body gerenderd. Zou alleen de
        // root-div fullscreen worden, dan valt document.body BUITEN de
        // fullscreen-boomstructuur en worden die overlays onzichtbaar/
        // niet-interactief zodra fullscreen actief is — dat verklaarde
        // waarom tikken op die knoppen niks leek te doen.
        await document.documentElement.requestFullscreen?.();
      }
    } catch {
      // Feature-detectie via optional chaining voorkomt de meeste fouten al
      // (niet-ondersteunde browser); een geweigerde aanvraag (bv. door
      // browserbeleid) mag de controller nooit onbruikbaar maken — gewoon
      // negeren, de knop blijft gewoon opnieuw klikbaar.
    }
  }

  const mapsById = new Map(maps.map((m) => [m.id, m]));
  const operatorsById = new Map(operators.map((o) => [o.id, o]));
  const assignmentByPlayerId = new Map(
    currentMatch ? operatorAssignments.filter((a) => a.match_id === currentMatch.id).map((a) => [a.player_id, a]) : [],
  );
  const currentMapName = currentMatch?.map_id ? mapsById.get(currentMatch.map_id)?.name : null;
  const activeChaosName = activeChaosEffectId ? chaosEffects.find((c) => c.id === activeChaosEffectId)?.name : null;
  const scoreByPlayerId = new Map(scoreboard.map((entry, index) => [entry.player.id, { entry, rank: index + 1 }]));

  const undoPlayerName = undo.lastAction ? roster.find((p) => p.id === undo.lastAction!.playerId)?.name : null;
  const undoLabel = !undo.lastAction
    ? "Laatste actie ongedaan maken"
    : undo.lastAction.kind === "mvp"
      ? `MVP – ${undoPlayerName ?? "?"} · +${undo.lastAction.points} ongedaan maken`
      : `${undo.lastAction.label} – ${undoPlayerName ?? "?"} ongedaan maken`;

  const actionsDisabled = !isLive || !currentMatch;

  return (
    <div className="r6-theme flex h-screen flex-col overflow-hidden bg-zinc-950 p-2 sm:p-3">
      <p className="r6-controller-portrait-notice rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center text-xs font-semibold text-amber-400">
        Draai je tablet voor de beste LAN Controller-weergave.
      </p>

      {/* Bovenbalk */}
      <div className="flex shrink-0 items-center justify-between gap-2 pb-2">
        <div className="min-w-0">
          <p className="truncate font-serif text-lg font-bold uppercase tracking-wide text-zinc-100 sm:text-xl">{session.name}</p>
          <p className="truncate text-xs text-zinc-500">
            {currentMatch ? `Game ${currentMatch.match_number}` : "Geen actieve game"}
            {currentMapName ? ` · ${currentMapName}` : ""}
            {" · "}
            <span className={isLive ? "font-semibold text-amber-400" : "font-semibold text-zinc-400"}>{isLive ? "LIVE" : "AFGEROND"}</span>
            {wakeLock.state !== "unsupported" && (
              <span className="ml-2 text-zinc-600">
                · Scherm actief houden: {wakeLock.state === "active" ? "aan" : "…"}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Fullscreen verlaten" : "Fullscreen starten"}
            className="flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-amber-400"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          <Link
            to={`/rainbow-six-siege/lan/${sessionId}`}
            aria-label="Controller verlaten"
            className="flex h-10 items-center gap-1.5 rounded-sm border border-zinc-700 bg-transparent px-3 text-xs text-zinc-400 hover:text-zinc-100"
          >
            <X className="h-4 w-4" /> Controller verlaten
          </Link>
        </div>
      </div>

      {!isLive && (
        <p className="mb-2 shrink-0 rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Deze LAN is beëindigd — alleen-lezen
        </p>
      )}

      {activeChaosName && (
        <div className="mb-2 shrink-0 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-center">
          <span className="text-[10px] uppercase tracking-wide text-amber-400/70">Chaos: </span>
          <span className="text-sm font-bold text-amber-400">{activeChaosName}</span>
        </div>
      )}

      {/* Geen apart "live scorebord"-blok meer: de punten staan al bij elke
          spelerskaart hieronder — een tweede keer dezelfde punten tonen
          kostte alleen maar ruimte (zelfde reden als eerder bij
          R6LiveDashboard). */}

      {/* Vaste spelerskolommen — speler 1 altijd links, speler 2 altijd
          rechts, nooit herschikt op score. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
        {roster.map((player) => {
          const entry = scoreByPlayerId.get(player.id)?.entry;
          const assignment = assignmentByPlayerId.get(player.id);
          const attackerName = assignment?.attacker_operator_id ? operatorsById.get(assignment.attacker_operator_id)?.name : null;
          const defenderName = assignment?.defender_operator_id ? operatorsById.get(assignment.defender_operator_id)?.name : null;
          return (
            <div key={player.id} className="flex min-h-0 flex-col rounded-sm border border-zinc-800 bg-zinc-900/60 p-2 sm:p-3">
              <div className="flex shrink-0 items-baseline justify-between gap-2 pb-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <p className="truncate font-serif text-lg font-bold uppercase text-zinc-100 sm:text-xl">{player.name}</p>
                  {(attackerName || defenderName) && (
                    <span className="shrink-0 text-xs font-semibold text-amber-400 sm:text-sm">
                      {attackerName ?? "—"} / {defenderName ?? "—"}
                    </span>
                  )}
                </div>
                <p className="shrink-0 font-serif text-2xl font-bold text-amber-400 sm:text-3xl">{entry?.totalPoints ?? 0}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <R6PlayerActionTiles quickActions={quickActions} disabled={actionsDisabled} onTap={(rule) => onTap(player.id, rule)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Onderbalk: undo + wheels + beheer + game afronden */}
      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2 border-t border-zinc-800 pt-2">
        <Button
          type="button"
          variant="outline"
          className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={undo.undo}
          disabled={actionsDisabled || !undo.lastAction || undo.isUndoing}
        >
          <Undo2 className="h-4 w-4" />
          {undoLabel}
        </Button>

        {currentMatch && !actionsDisabled && (
          <>
            <R6ChaosWheel matchNumber={currentMatch.match_number} onAccept={onAcceptChaosEffect} isSaving={isAcceptingChaosEffect} />
            <R6OperatorWheel sessionId={sessionId} matchId={currentMatch.id} roster={roster} />
          </>
        )}

        {canManageR6Rules && <R6QuickActionSettings />}

        <Button
          type="button"
          className="ml-auto bg-amber-500 text-zinc-950 hover:bg-amber-400"
          onClick={onEndGame}
          disabled={actionsDisabled}
        >
          <Flag className="h-4 w-4" /> Game afronden
        </Button>
      </div>
    </div>
  );
}
