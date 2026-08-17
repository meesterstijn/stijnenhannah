import { useState } from "react";
import { Camera, Flag, Images, Pause, Play } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import type { GameSessionWithGame } from "@/features/game-night/hooks/useGameSession";
import {
  usePauseGameSession,
  useResumeGameSession,
  useCompleteGameSession,
} from "@/features/game-night/hooks/useGameSession";
import {
  useDiscardOpenRound,
  useCurrentRound,
} from "@/features/game-night/hooks/useGameNightRounds";
import {
  useCheckpointsForSession,
  useLatestCheckpoint,
} from "@/features/game-night/hooks/useCheckpoints";
import { RoundPlayPanel } from "@/features/game-night/components/RoundPlayPanel";
import { CompleteGameSessionPanel } from "@/features/game-night/components/CompleteGameSessionPanel";
import { CheckpointSavePanel } from "@/features/game-night/components/CheckpointSavePanel";
import { CheckpointViewer } from "@/features/game-night/components/CheckpointViewer";
import { CheckpointHistoryPanel } from "@/features/game-night/components/CheckpointHistoryPanel";
import { TonightStats } from "@/features/game-night/components/TonightStats";

type View =
  | "play"
  | "pause-choice"
  | "checkpoint-save"
  | "checkpoint-view"
  | "checkpoint-history"
  | "completing";

// Actieve speelmodus — alleen het centrale bord verandert, de rest van de
// tafel blijft staan. Rondespellen (gameSession.uses_rounds) krijgen de
// snelle rondeflow (RoundPlayPanel, incl. Stand opslaan/Pauzeer/Spel
// afronden), andere spellen dezelfde drie acties rechtstreeks hier.
// Belangrijk: alle gedragsbeslissingen lezen de CONFIGURATIESNAPSHOT op de
// spelsessie zelf (gameSession.uses_rounds/track_round_results/
// has_session_winner/result_mode), nooit gameSession.game.* — zo verandert
// een lopende sessie niet van gedrag als iemand de spelconfiguratie in de
// Spellenkast tussentijds aanpast.
export function ActiveGameSessionPanel({
  gameSession,
  participants,
  gameNightSessionId,
}: {
  gameSession: GameSessionWithGame;
  participants: GameNightPlayer[];
  gameNightSessionId: string;
}) {
  const [view, setView] = useState<View>("play");
  const [pendingRoundDiscardId, setPendingRoundDiscardId] = useState<
    string | null
  >(null);
  const [pauseAfterCheckpoint, setPauseAfterCheckpoint] = useState(false);
  const [viewingCheckpointId, setViewingCheckpointId] = useState<string | null>(
    null,
  );

  const pauseSession = usePauseGameSession();
  const resumeSession = useResumeGameSession();
  const completeSession = useCompleteGameSession();
  const discardRound = useDiscardOpenRound(gameSession.id);
  const { data: currentRound } = useCurrentRound(
    gameSession.uses_rounds ? gameSession.id : undefined,
  );
  const { data: checkpoints = [] } = useCheckpointsForSession(gameSession.id);
  const { data: latestCheckpoint } = useLatestCheckpoint(gameSession.id);

  // has_session_winner=false: dit spel ondersteunt sowieso geen
  // sessiewinnaar, dus rondt direct af (lege resultatenlijst; de RPC
  // accepteert dat expliciet) zonder ook maar een keuzescherm te tonen.
  // has_session_winner=true: CompleteGameSessionPanel toont zelf de keuze
  // "Winnaar registreren" / "Afsluiten zonder winnaar" / "Terug naar spel".
  // Een eventuele nog-open ronde (openRoundId, alleen bij rondespellen)
  // wordt pas weggegooid vlak vóór het daadwerkelijke afronden — nooit
  // eerder, zodat annuleren altijd veilig terug kan naar een intacte ronde.
  async function handleFinishSession(openRoundId?: string) {
    if (!gameSession.has_session_winner) {
      if (openRoundId) await discardRound.mutateAsync(openRoundId);
      await completeSession.mutateAsync({
        gameSessionId: gameSession.id,
        results: [],
      });
      return;
    }
    setPendingRoundDiscardId(openRoundId ?? null);
    setView("completing");
  }

  function openCheckpointSave(pauseAfter: boolean) {
    setPauseAfterCheckpoint(pauseAfter);
    setView("checkpoint-save");
  }

  function openCheckpointView(checkpointId: string) {
    setViewingCheckpointId(checkpointId);
    setView("checkpoint-view");
  }

  if (view === "checkpoint-save") {
    return (
      <CheckpointSavePanel
        gameSessionId={gameSession.id}
        roundId={currentRound?.id ?? null}
        attendees={participants}
        onClose={() => {
          setView("play");
          setPauseAfterCheckpoint(false);
        }}
        onSaved={
          pauseAfterCheckpoint
            ? () => pauseSession.mutate(gameSession.id)
            : undefined
        }
      />
    );
  }

  if (view === "checkpoint-view" && viewingCheckpointId) {
    return (
      <CheckpointViewer
        checkpoint={
          checkpoints.find((c) => c.id === viewingCheckpointId) ?? {
            id: viewingCheckpointId,
            game_session_id: gameSession.id,
            title: "",
            notes: null,
            created_at: new Date().toISOString(),
            created_by: null,
            round_id: null,
          }
        }
        checkpoints={checkpoints}
        attendees={participants}
        onNavigateCheckpoint={setViewingCheckpointId}
        onClose={() => setView("play")}
      />
    );
  }

  if (view === "checkpoint-history") {
    return (
      <CheckpointHistoryPanel
        checkpoints={checkpoints}
        onSelect={openCheckpointView}
        onClose={() => setView("play")}
      />
    );
  }

  if (view === "completing") {
    return (
      <CompleteGameSessionPanel
        gameSession={gameSession}
        participants={participants}
        discardRoundId={pendingRoundDiscardId ?? undefined}
        onCancel={() => {
          setPendingRoundDiscardId(null);
          setView("play");
        }}
      />
    );
  }

  if (view === "pause-choice") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 text-center">
        <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
          SPEL PAUZEREN
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <button
            type="button"
            onClick={() => pauseSession.mutate(gameSession.id)}
            disabled={pauseSession.isPending}
            className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full items-center justify-center px-6 py-3.5"
          >
            <span className="gn-display text-base font-semibold tracking-wide">
              {pauseSession.isPending ? "Bezig..." : "Alleen pauzeren"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => openCheckpointSave(true)}
            className="gn-plaque-action flex min-h-[56px] w-full items-center justify-center px-6 py-3"
          >
            <span className="gn-display text-sm font-semibold tracking-wide">
              Eerst stand opslaan
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView("play")}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  if (gameSession.status === "paused") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 text-center">
        <div>
          <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
            {gameSession.game.name}
          </p>
          <p className="gn-muted mt-1 text-sm">
            {participants.map((p) => p.name).join(" · ")}
          </p>
          <p className="gn-eyebrow mt-2">Gepauzeerd</p>
        </div>

        {latestCheckpoint && (
          <p className="gn-muted text-xs">
            Laatste spelstand · {latestCheckpoint.title} ·{" "}
            {new Date(latestCheckpoint.created_at).toLocaleTimeString("nl-NL", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}

        <button
          type="button"
          onClick={() => resumeSession.mutate(gameSession.id)}
          disabled={resumeSession.isPending}
          className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full max-w-xs items-center justify-center gap-2 px-6 py-3.5"
        >
          <Play
            className="h-5 w-5"
            style={{ color: "var(--gn-brass)" }}
            strokeWidth={1.7}
          />
          <span className="gn-display text-lg font-semibold tracking-wide">
            {resumeSession.isPending ? "Bezig..." : "Hervat spel"}
          </span>
        </button>

        {latestCheckpoint ? (
          <button
            type="button"
            onClick={() => openCheckpointView(latestCheckpoint.id)}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            Bekijk spelstand
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openCheckpointSave(false)}
            className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
          >
            Stand opslaan
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-2.5">
      <div className="text-center">
        <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
          {gameSession.game.name}
        </p>
        <p className="gn-muted mt-1 text-sm">
          {participants.map((p) => p.name).join(" · ")}
        </p>
      </div>

      {gameSession.uses_rounds ? (
        <RoundPlayPanel
          gameSessionId={gameSession.id}
          participants={participants}
          trackRoundResults={gameSession.track_round_results}
          onFinishSession={handleFinishSession}
          onSaveCheckpoint={() => openCheckpointSave(false)}
          onPause={() => setView("pause-choice")}
          pausePending={pauseSession.isPending}
        />
      ) : (
        <div className="flex w-full max-w-xs flex-1 flex-col justify-center gap-2.5">
          <button
            type="button"
            onClick={() => openCheckpointSave(false)}
            className="gn-plaque-action flex min-h-[52px] w-full items-center justify-center gap-2 px-6 py-3"
          >
            <Camera className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
            <span className="gn-display text-sm font-semibold tracking-wide">
              Stand opslaan
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView("pause-choice")}
            className="gn-plaque-action flex min-h-[52px] w-full items-center justify-center gap-2 px-6 py-3"
          >
            <Pause className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
            <span className="gn-display text-sm font-semibold tracking-wide">
              Pauzeer
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleFinishSession()}
            disabled={completeSession.isPending}
            className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full items-center justify-center gap-2 px-6 py-3.5"
          >
            <Flag className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
            <span className="gn-display text-sm font-semibold tracking-wide">
              Spel afronden
            </span>
          </button>
        </div>
      )}

      {checkpoints.length > 0 && (
        <button
          type="button"
          onClick={() => setView("checkpoint-history")}
          className="gn-faint flex min-h-[36px] items-center gap-1.5 text-[11px] underline"
        >
          <Images className="h-3 w-3" />
          Spelstanden · {checkpoints.length}
        </button>
      )}

      <TonightStats gameNightSessionId={gameNightSessionId} />
    </div>
  );
}
