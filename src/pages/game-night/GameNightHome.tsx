import { useState } from "react";
import { Dices, Users } from "lucide-react";
import { useGameNightGames } from "@/features/game-night/hooks/useGameNightGames";
import {
  useActiveGameNightSession,
  useGameNightSessionPlayers,
  useStartGameNightSession,
} from "@/features/game-night/hooks/useGameNightSession";
import type { GameNightPlayer, GameNightSession } from "@/lib/supabase";
import { TopNav } from "@/features/game-night/components/TopNav";
import { TitleBlock } from "@/features/game-night/components/TitleBlock";
import { ActionPlaque } from "@/features/game-night/components/ActionPlaque";
import { ChampionPlaque } from "@/features/game-night/components/ChampionPlaque";
import { ExploreNav } from "@/features/game-night/components/ExploreNav";
import { CandleLayer } from "@/features/game-night/components/CandleLayer";
import { ScatteredTableObjects } from "@/features/game-night/components/ScatteredTableObjects";
import { PlayerSelectionBoard } from "@/features/game-night/components/PlayerSelectionBoard";
import { ResumeGameNightPlaque } from "@/features/game-night/components/ResumeGameNightPlaque";
import { GameNightStartedPanel } from "@/features/game-night/components/GameNightStartedPanel";
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

// De Start Game Night-flow speelt zich binnen dezelfde tabletop-scène af
// (opdracht "functioneel fundament" sectie 18): geen aparte formulierpagina,
// alleen wisselende inhoud van hetzelfde .gn-board-element + een dim-state
// voor de rest van de tafel. "idle" is de normale home (evt. met een
// "Verder met Game Night"-plaque als er al een actieve/gepauzeerde sessie
// bestaat, sectie 17); "select-players" is stap 1 (sectie 19-21); "started"
// is de placeholder-status na starten/hervatten (sectie 21).
type FlowState = "idle" | "select-players" | "started";

export default function GameNightHome() {
  const { data: games = [] } = useGameNightGames();
  const { data: activeSession } = useActiveGameNightSession();
  const startSession = useStartGameNightSession();

  const [flow, setFlow] = useState<FlowState>("idle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentSession, setCurrentSession] = useState<GameNightSession | null>(
    null,
  );

  const { data: sessionPlayers = [] } = useGameNightSessionPlayers(
    currentSession?.id,
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
    const session = await startSession.mutateAsync(players);
    setCurrentSession(session);
    setFlow("started");
  }

  function handleResume() {
    if (!activeSession) return;
    setCurrentSession(activeSession);
    setFlow("started");
  }

  // Peripherale elementen (kampioen, titel, rechter menu) dimmen/trekken
  // zich terug zodra het bord de actieve interface wordt (sectie 18/33) —
  // de fysieke tafel/kaarsen/decoratie blijven gewoon zichtbaar, alleen de
  // functionele UI eromheen wijkt.
  const dimmed = flow !== "idle";
  const dimClass = dimmed ? "gn-peripheral-dim" : "";

  return (
    <div className="gn-tabletop gn-tabletop-fit">
      <TopNav />

      <div className="relative flex min-h-0 flex-col items-center justify-center gap-4 py-2 lg:flex-row lg:gap-9">
        <CandleLayer />
        <ScatteredTableObjects />

        <div
          className={`relative z-30 order-3 w-full max-w-xs lg:order-1 lg:-ml-3 lg:w-56 lg:shrink-0 ${dimClass}`}
        >
          <ChampionPlaque champion={MOCK_CURRENT_CHAMPION} />
        </div>

        <div className="relative z-30 order-1 flex w-full max-w-lg flex-col items-center gap-2.5 lg:order-2 lg:min-w-0 lg:flex-1 lg:gap-4">
          <TitleBlock className={dimClass} />
          <div className="gn-board relative w-full px-4 py-4 sm:px-7 sm:py-5 lg:-mt-1">
            {flow === "idle" &&
              BOARD_PIECES.map((piece, i) => (
                <img
                  key={i}
                  src={`/game-night/assets/${piece.src}.webp`}
                  alt=""
                  aria-hidden
                  className={`gn-tableobj gn-tableobj-${piece.shadow} pointer-events-none absolute hidden ${piece.width} ${piece.style} sm:block`}
                />
              ))}

            {flow === "idle" && (
              <div className="relative mx-auto flex max-w-sm flex-col gap-2.5">
                {activeSession && (
                  <ResumeGameNightPlaque
                    session={activeSession}
                    onClick={handleResume}
                  />
                )}
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
                starting={startSession.isPending}
              />
            )}

            {flow === "started" && currentSession && (
              <GameNightStartedPanel
                session={currentSession}
                players={sessionPlayers}
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

        {flow === "started" && (
          <div className="absolute top-2 right-2 z-40 lg:top-0 lg:right-0">
            <GameNightNowPlaying />
          </div>
        )}
      </div>
    </div>
  );
}
