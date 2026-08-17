import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dices, Users } from "lucide-react";
import { useGameNightGames } from "@/features/game-night/hooks/useGameNightGames";
import {
  useActiveGameNightSession,
  useGameNightSessionPlayers,
  useStartGameNightSession,
  useCompleteGameNight,
} from "@/features/game-night/hooks/useGameNightSession";
import {
  useLatestGameSession,
  useGameSessionParticipants,
  useStartGameSession,
} from "@/features/game-night/hooks/useGameSession";
import type { GameNightPlayer, GameNightSession } from "@/lib/supabase";
import { TopNav } from "@/features/game-night/components/TopNav";
import { TitleBlock } from "@/features/game-night/components/TitleBlock";
import { ActionPlaque } from "@/features/game-night/components/ActionPlaque";
import { ChampionPlaque } from "@/features/game-night/components/ChampionPlaque";
import { ExploreNav } from "@/features/game-night/components/ExploreNav";
import { CandleLayer } from "@/features/game-night/components/CandleLayer";
import { ScatteredTableObjects } from "@/features/game-night/components/ScatteredTableObjects";
import { PlayerSelectionBoard } from "@/features/game-night/components/PlayerSelectionBoard";
import { GameNightStartedPanel } from "@/features/game-night/components/GameNightStartedPanel";
import { ActiveGameSessionPanel } from "@/features/game-night/components/ActiveGameSessionPanel";
import { GameSessionCompletedPanel } from "@/features/game-night/components/GameSessionCompletedPanel";
import { GameNightCompletedPanel } from "@/features/game-night/components/GameNightCompletedPanel";
import { GameNightNowPlaying } from "@/features/game-night/components/GameNightNowPlaying";
import {
  MOCK_CURRENT_CHAMPION,
  MOCK_STATS,
} from "@/features/game-night/lib/mockData";

// Losse stukken die letterlijk OP het speelbord liggen (correctieronde
// sectie 6) — individuele fotoassets, asymmetrisch, alsof er net gespeeld
// is en de twee Game Night-keuzes er bovenop zijn gelegd. Bewust geen volle
// asset-sheet-rij (zie ScatteredTableObjects.tsx voor waarom).
const BOARD_PIECES: {
  src: string;
  style: string;
  width: string;
  shadow: "chip" | "pawn" | "dice";
}[] = [
  {
    src: "chip-red",
    style: "-top-2 left-[13%] -rotate-[6deg] scale-y-[0.82]",
    width: "w-5",
    shadow: "chip",
  },
  {
    src: "chip-red",
    style: "-top-2.5 left-[19%] rotate-[13deg] scale-y-[0.85]",
    width: "w-5",
    shadow: "chip",
  },
  {
    src: "chip-yellow",
    style: "-top-1.5 left-[35%] -rotate-[9deg] scale-y-[0.85]",
    width: "w-5",
    shadow: "chip",
  },
  {
    src: "chip-red",
    style: "-top-2 left-[76%] rotate-[8deg] scale-y-[0.82]",
    width: "w-[1.35rem]",
    shadow: "chip",
  },
  {
    src: "pawn-blue",
    style: "top-[40%] -left-3 -rotate-[7deg]",
    width: "w-9",
    shadow: "pawn",
  },
  {
    src: "die-single",
    style: "-bottom-3 right-[15%] rotate-[16deg]",
    width: "w-8",
    shadow: "dice",
  },
  {
    src: "chip-yellow",
    style: "bottom-[22%] -right-2.5 rotate-[6deg] scale-y-[0.85]",
    width: "w-5",
    shadow: "chip",
  },
];

// "Database als state machine" (opdracht sectie 34): "idle"/"select-players"
// zijn de enige twee stappen die nog niets in Supabase hebben — zodra een
// Game Night bestaat, wordt alles verderop (welk spel, welke ronde, welke
// stand) afgeleid uit useLatestGameSession/useCurrentRound e.d., niet uit
// lokale flags. "night-completed" is een kortstondige afsluit-recap, geen
// bron van waarheid (na een reload zie je gewoon weer de normale idle-home).
type FlowState = "idle" | "select-players" | "started" | "night-completed";

export default function GameNightHome() {
  const navigate = useNavigate();
  const { data: games = [] } = useGameNightGames();
  const { data: activeSession, isLoading: activeSessionLoading } =
    useActiveGameNightSession();
  const startGameNightSession = useStartGameNightSession();
  const startGameSession = useStartGameSession();
  const completeGameNight = useCompleteGameNight();

  const [flow, setFlow] = useState<FlowState>("idle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentSession, setCurrentSession] = useState<GameNightSession | null>(
    null,
  );

  // Sectie 33/35/36: na reload/opnieuw binnenkomen moet een actieve Game
  // Night direct hervat worden — geen extra tik nodig, geen "Start Game
  // Night" te zien terwijl er al iets loopt.
  useEffect(() => {
    if (activeSession && flow === "idle" && !currentSession) {
      setCurrentSession(activeSession);
      setFlow("started");
    }
  }, [activeSession, flow, currentSession]);

  const { data: sessionPlayers = [] } = useGameNightSessionPlayers(
    currentSession?.id,
  );
  const { data: latestGameSession } = useLatestGameSession(currentSession?.id);
  const { data: gameSessionParticipants = [] } = useGameSessionParticipants(
    latestGameSession?.id,
  );

  function toggleSelected(playerId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function handleComplete(players: GameNightPlayer[]) {
    const session = await startGameNightSession.mutateAsync(players);
    setCurrentSession(session);
    setFlow("started");
  }

  async function handleRematch() {
    if (!currentSession || !latestGameSession) return;
    await startGameSession.mutateAsync({
      gameNightSessionId: currentSession.id,
      gameId: latestGameSession.game_id,
      playerIds: gameSessionParticipants.map((p) => p.id),
    });
  }

  async function handleCloseGameNight() {
    if (!currentSession) return;
    if (
      !window.confirm(
        "Game Night afsluiten? Je kunt hierna geen nieuw spel meer starten voor deze avond.",
      )
    ) {
      return;
    }
    const closed = await completeGameNight.mutateAsync(currentSession.id);
    setCurrentSession(closed);
    setFlow("night-completed");
  }

  function handleBackToStart() {
    setCurrentSession(null);
    setSelectedIds(new Set());
    setFlow("idle");
  }

  // Peripherale elementen (kampioen, titel, rechter menu) dimmen/trekken
  // zich terug zodra het bord de actieve interface wordt (sectie 18/33) —
  // de fysieke tafel/kaarsen/decoratie blijven gewoon zichtbaar, alleen de
  // functionele UI eromheen wijkt.
  const dimmed = flow !== "idle";
  const dimClass = dimmed ? "gn-peripheral-dim" : "";
  const showBoardDecoration = flow === "idle" && !activeSessionLoading;

  return (
    <div className="gn-tabletop gn-tabletop-fit">
      <TopNav />

      <div className="relative flex min-h-0 flex-col items-center justify-center gap-4 py-2 lg:flex-row lg:gap-9">
        <CandleLayer />
        <ScatteredTableObjects />

        {/* Eigen tafelobject, GEEN kind van de gedimde kampioenskolom
            (die krijgt tijdens actief spel pointer-events:none + lagere
            opacity — Spotify moet juist altijd volledig bruikbaar blijven).
            Positie: linksonder in de rij, in de vrije tafelruimte onder
            Hannah — nooit in .gn-board zelf, dus kan het bord/menu/nav
            niet overlappen. Laag boven de decoratieve kaarsen/objecten,
            onder de echte interactieve kolommen (z-30). */}
        {flow === "started" && (
          <div className="absolute top-[64%] left-0 z-[25] hidden lg:block">
            <GameNightNowPlaying />
          </div>
        )}

        <div
          className={`relative z-30 order-3 w-full max-w-xs lg:order-1 lg:-ml-3 lg:w-56 lg:shrink-0 ${dimClass}`}
        >
          <ChampionPlaque champion={MOCK_CURRENT_CHAMPION} />
        </div>

        <div className="relative z-30 order-1 flex w-full max-w-lg flex-col items-center gap-2.5 lg:order-2 lg:min-w-0 lg:flex-1 lg:gap-4">
          <TitleBlock className={dimClass} />
          <div className="gn-board relative w-full px-4 py-4 sm:px-7 sm:py-5 lg:-mt-1">
            {showBoardDecoration &&
              BOARD_PIECES.map((piece, i) => (
                <img
                  key={i}
                  src={`/game-night/assets/${piece.src}.webp`}
                  alt=""
                  aria-hidden
                  className={`gn-tableobj gn-tableobj-${piece.shadow} pointer-events-none absolute hidden ${piece.width} ${piece.style} sm:block`}
                />
              ))}

            {activeSessionLoading && flow === "idle" && (
              <div className="flex h-32 items-center justify-center">
                <div className="gn-faint text-xs">Even geduld...</div>
              </div>
            )}

            {!activeSessionLoading && flow === "idle" && (
              <div className="relative mx-auto flex max-w-sm flex-col gap-2.5">
                <ActionPlaque
                  onClick={() => setFlow("select-players")}
                  icon={Users}
                  title="Start Game Night"
                  subtitle="Begin een nieuwe avond"
                  primary
                />
                <ActionPlaque
                  to="/game-night/spel-kiezen"
                  icon={Dices}
                  title="Laat een spel kiezen"
                  subtitle="Wij helpen je kiezen"
                />
              </div>
            )}

            {flow === "select-players" && (
              <PlayerSelectionBoard
                selectedIds={selectedIds}
                onToggle={toggleSelected}
                onComplete={handleComplete}
                starting={startGameNightSession.isPending}
              />
            )}

            {flow === "started" && currentSession && !latestGameSession && (
              <GameNightStartedPanel
                session={currentSession}
                players={sessionPlayers}
              />
            )}

            {flow === "started" &&
              currentSession &&
              latestGameSession &&
              latestGameSession.status !== "completed" && (
                <ActiveGameSessionPanel
                  gameSession={latestGameSession}
                  participants={gameSessionParticipants}
                  gameNightSessionId={currentSession.id}
                />
              )}

            {flow === "started" &&
              currentSession &&
              latestGameSession &&
              latestGameSession.status === "completed" && (
                <GameSessionCompletedPanel
                  gameSession={latestGameSession}
                  onRematch={handleRematch}
                  onOtherGame={() => navigate("/game-night/spellen")}
                  onCloseGameNight={handleCloseGameNight}
                  rematchPending={startGameSession.isPending}
                />
              )}

            {flow === "night-completed" && currentSession && (
              <GameNightCompletedPanel
                session={currentSession}
                onBackToStart={handleBackToStart}
              />
            )}
          </div>
        </div>

        <div
          className={`relative z-30 order-2 w-full max-w-xs lg:order-3 lg:ml-6 lg:mt-5 lg:w-56 lg:shrink-0 ${dimClass}`}
        >
          <ExploreNav
            gamesCount={games.length}
            playersCount={MOCK_STATS.totalPlayers}
          />
        </div>
      </div>
    </div>
  );
}
