import { useState } from "react";
import { Camera, Flag, Images, Play } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import type { GameSessionWithGame } from "@/features/game-night/hooks/useGameSession";
import {
  useResumeGameSession,
  useCompleteGameSession,
} from "@/features/game-night/hooks/useGameSession";
import {
  useDiscardOpenRound,
  useCurrentRound,
} from "@/features/game-night/hooks/useGameNightRounds";
import { useCompleteWinSession } from "@/features/game-night/hooks/useGameNightWinEvents";
import {
  useCheckpointsForSession,
  useLatestCheckpoint,
} from "@/features/game-night/hooks/useCheckpoints";
import { RoundPlayPanel } from "@/features/game-night/components/RoundPlayPanel";
import { WinPlayPanel } from "@/features/game-night/components/WinPlayPanel";
import { CompleteGameSessionPanel } from "@/features/game-night/components/CompleteGameSessionPanel";
import { CheckpointSavePanel } from "@/features/game-night/components/CheckpointSavePanel";
import { CheckpointViewer } from "@/features/game-night/components/CheckpointViewer";
import { CheckpointHistoryPanel } from "@/features/game-night/components/CheckpointHistoryPanel";

type View =
  | "play"
  | "checkpoint-save"
  | "checkpoint-view"
  | "checkpoint-history"
  | "completing";

// Exact dezelfde klassen die GameNightHome vóór de pokertafel-wijziging op
// de wrappende .gn-board zette — nu hier, want GameNightHome levert die
// wrapper niet meer aan zodra ActiveGameSessionPanel actief is (sectie 6:
// de "play"/"paused"-weergave krijgt in plaats daarvan de pokertafel).
const BOARD_CLASS =
  "gn-board relative w-full px-4 py-4 sm:px-7 sm:py-5 lg:-mt-1";

// Actieve speelmodus — opschoning (UX-polish, sectie 1-13): het bord toont
// tijdens het spelen alleen nog spelnaam/ronde/primaire actie plus één
// rustige secundaire rij (Stand opslaan + "•••"). Pauzeren is volledig uit
// deze flow (sectie 1) — `usePauseGameSession`/de RPC blijven ongewijzigd
// bestaan (schema/historie-compatibiliteit), maar niets in deze component
// roept ze nog aan; alleen een AL gepauzeerde (historische) sessie kan
// via de bestaande `paused`-status-tak nog hervat worden.
//
// Sectie 7/8/16: rondespellen (`uses_rounds`) krijgen NOOIT meer een
// aparte sessie-winnaar-vraag bij afronden — de ronderesultaten
// (game_night_round_results) ZIJN het resultaat. `has_session_winner`
// blijft relevant voor niet-rondespellen. Alle gedragsbeslissingen lezen
// de configuratiesnapshot op de spelsessie zelf, nooit de live spelconfig.
//
// UX-polish (poker/vilt-tafel, sectie 6-9): "play" en "paused" krijgen de
// nieuwe pokertafel-PNG als visueel speelvlak (.gn-poker-table), met alle
// interactieve content in een aparte laag erboven (.gn-poker-table-content)
// binnen een op de asset gemeten veilige zone op het groene vilt.
export function ActiveGameSessionPanel({
  gameSession,
  participants,
}: {
  gameSession: GameSessionWithGame;
  participants: GameNightPlayer[];
}) {
  const [view, setView] = useState<View>("play");
  const [pendingRoundDiscardId, setPendingRoundDiscardId] = useState<
    string | null
  >(null);
  const [viewingCheckpointId, setViewingCheckpointId] = useState<string | null>(
    null,
  );

  const resumeSession = useResumeGameSession();
  const completeSession = useCompleteGameSession();
  const completeWinSession = useCompleteWinSession();
  const discardRound = useDiscardOpenRound(gameSession.id);
  const { data: currentRound } = useCurrentRound(
    gameSession.win_source !== "win_events" && gameSession.uses_rounds
      ? gameSession.id
      : undefined,
  );
  const { data: checkpoints = [] } = useCheckpointsForSession(gameSession.id);
  const { data: latestCheckpoint } = useLatestCheckpoint(gameSession.id);

  // Sectie 12/13 (V2.2): win_events-sessies hebben geen ronde-in-uitvoering-
  // concept en geen sessie-winnaar-vraag — "Spel afsluiten" sluit altijd
  // direct af via de aparte, kleine complete_win_session-RPC, die bewust
  // GEEN game_night_game_session_results schrijft (win-events blijven de
  // volledige winstwaarheid). Deze branch staat vóór de legacy-checks
  // hieronder, die voor win_events-sessies dus nooit meer bereikt worden.
  async function handleFinishSession(openRoundId?: string) {
    if (gameSession.win_source === "win_events") {
      await completeWinSession.mutateAsync(gameSession.id);
      return;
    }
    if (gameSession.uses_rounds || !gameSession.has_session_winner) {
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

  function openCheckpointSave() {
    setView("checkpoint-save");
  }

  function openCheckpointView(checkpointId: string) {
    setViewingCheckpointId(checkpointId);
    setView("checkpoint-view");
  }

  // Checkpoint-subflows en het afrondscherm blijven bewust op het gewone
  // rechthoekige .gn-board (sectie 13: checkpoint camera/storage niet
  // wijzigen) — alleen de "play"/"paused"-weergave hieronder krijgt de
  // nieuwe pokertafel. GameNightHome levert voor deze staten geen
  // .gn-board meer aan (dat doet nu alleen deze component, per staat), dus
  // die klasse wordt hier expliciet toegepast.
  if (view === "checkpoint-save") {
    return (
      <div className={BOARD_CLASS}>
        <CheckpointSavePanel
          gameSessionId={gameSession.id}
          roundId={currentRound?.id ?? null}
          attendees={participants}
          onClose={() => setView("play")}
        />
      </div>
    );
  }

  if (view === "checkpoint-view" && viewingCheckpointId) {
    return (
      <div className={BOARD_CLASS}>
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
      </div>
    );
  }

  if (view === "checkpoint-history") {
    return (
      <div className={BOARD_CLASS}>
        <CheckpointHistoryPanel
          checkpoints={checkpoints}
          onSelect={openCheckpointView}
          onClose={() => setView("play")}
        />
      </div>
    );
  }

  if (view === "completing") {
    return (
      <div className={BOARD_CLASS}>
        <CompleteGameSessionPanel
          gameSession={gameSession}
          participants={participants}
          discardRoundId={pendingRoundDiscardId ?? undefined}
          onCancel={() => {
            setPendingRoundDiscardId(null);
            setView("play");
          }}
        />
      </div>
    );
  }

  // Alleen bereikbaar voor een sessie die al vóór deze opschoning
  // gepauzeerd is — niets in de actieve UX kan deze status nog nieuw
  // veroorzaken.
  if (gameSession.status === "paused") {
    return (
      <div className="gn-poker-table">
        <div className="gn-poker-table-content text-center">
          <div>
            <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
              {gameSession.game.name}
            </p>
            <p className="gn-eyebrow mt-2">Gepauzeerd</p>
          </div>

          {latestCheckpoint && (
            <p className="gn-muted text-xs">
              Laatste spelstand · {latestCheckpoint.title} ·{" "}
              {new Date(latestCheckpoint.created_at).toLocaleTimeString(
                "nl-NL",
                { hour: "2-digit", minute: "2-digit" },
              )}
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

          {latestCheckpoint && (
            <button
              type="button"
              onClick={() => openCheckpointView(latestCheckpoint.id)}
              className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
            >
              Bekijk spelstand
            </button>
          )}
        </div>
      </div>
    );
  }

  // V2.2: win_events-sessies krijgen de nieuwe universele WIN-interface,
  // volledig los van uses_rounds/track_round_results (die snapshotvelden
  // bepalen voor win_events niets meer, sectie 2) — WinPlayPanel rendert
  // zijn eigen spelnaam-label, dus die staat hier niet nogmaals apart.
  // Elke legacy-sessie (win_source !== 'win_events') blijft exact de
  // bestaande RoundPlayPanel/"Spel afronden"-tak gebruiken (sectie 16).
  if (gameSession.win_source === "win_events") {
    return (
      <div className="gn-poker-table">
        <div className="gn-poker-table-content">
          <WinPlayPanel
            gameSessionId={gameSession.id}
            gameName={gameSession.game.name}
            participants={participants}
            onFinishSession={() => handleFinishSession()}
            onSaveCheckpoint={openCheckpointSave}
            checkpointCount={checkpoints.length}
            onViewCheckpoints={() => setView("checkpoint-history")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="gn-poker-table">
      <div className="gn-poker-table-content">
        {/* Sectie 7: spelnaam is hier bewust ondergeschikt aan de ronde/
            spelerkeuze — dezelfde kleine messing-labelstijl als "Bezig"/
            "Gepauzeerd" elders, niet meer de grote titel. */}
        <p className="gn-eyebrow">{gameSession.game.name}</p>

        {gameSession.uses_rounds ? (
          <RoundPlayPanel
            gameSessionId={gameSession.id}
            participants={participants}
            trackRoundResults={gameSession.track_round_results}
            onFinishSession={handleFinishSession}
            onSaveCheckpoint={openCheckpointSave}
            checkpointCount={checkpoints.length}
            onViewCheckpoints={() => setView("checkpoint-history")}
          />
        ) : (
          <div className="flex w-full max-w-xs flex-col items-center gap-2.5">
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
            <button
              type="button"
              onClick={openCheckpointSave}
              className="gn-plaque-action flex min-h-[52px] w-full items-center justify-center gap-1.5 px-3"
            >
              <Camera
                className="h-4 w-4"
                style={{ color: "var(--gn-brass)" }}
              />
              <span className="gn-display text-xs font-semibold tracking-wide">
                Stand opslaan
              </span>
            </button>
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
          </div>
        )}
      </div>
    </div>
  );
}
