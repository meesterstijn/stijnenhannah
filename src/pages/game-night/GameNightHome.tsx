import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { useGameNightGames } from "@/features/game-night/hooks/useGameNightGames";
import { usePlayers } from "@/features/game-night/hooks/usePlayers";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { buildHomepageChampion } from "@/features/game-night/lib/gameNightTitles";
import {
  useActiveGameNightSession,
  useStartGameNightSession,
  useCompleteGameNight,
} from "@/features/game-night/hooks/useGameNightSession";
import {
  useLatestGameSession,
  useGameSessionParticipants,
  useStartGameSession,
} from "@/features/game-night/hooks/useGameSession";
import type { GameNightSession } from "@/lib/supabase";
import { TopNav } from "@/features/game-night/components/TopNav";
import { TitleBlock } from "@/features/game-night/components/TitleBlock";
import { ActionPlaque } from "@/features/game-night/components/ActionPlaque";
import { ChampionPlaque } from "@/features/game-night/components/ChampionPlaque";
import { ExploreNav } from "@/features/game-night/components/ExploreNav";
import { CandleLayer } from "@/features/game-night/components/CandleLayer";
import { ScatteredTableObjects } from "@/features/game-night/components/ScatteredTableObjects";
import { GameNightV2Lobby } from "@/features/game-night/v2/GameNightV2Lobby";
import { GameNightV2GameSelect } from "@/features/game-night/v2/GameNightV2GameSelect";
import { ActiveGameSessionPanel } from "@/features/game-night/components/ActiveGameSessionPanel";
import { GameSessionCompletedPanel } from "@/features/game-night/components/GameSessionCompletedPanel";
import { GameNightNowPlaying } from "@/features/game-night/components/GameNightNowPlaying";

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

// "Database als state machine" (opdracht sectie 34): "idle" is de enige
// stap die nog niets in Supabase heeft — zodra een Game Night bestaat,
// wordt alles verderop (lobby/spel/ronde/stand) afgeleid uit
// useActivePartySeats/useLatestGameSession/useCurrentRound e.d., niet uit
// lokale flags. Er is bewust GEEN "night-completed"-status meer (Game Night
// V7, sectie 12/37): Game Night afsluiten navigeert direct naar de echte
// finale-route (/game-night/geschiedenis/:sessionId/finale) i.p.v. een
// lokale afsluit-recap binnen deze pagina te tonen — de sessionId leeft dan
// in de URL, niet in React-state die een refresh niet overleeft.
//
// Game Night V2.4 (sectie 22-23): de oude "select-players"-stap (kies eerst
// wie er komt, dan pas de sessie aanmaken — PlayerSelectionBoard.tsx) is
// vervangen door de lobby: "Start Game Night" maakt meteen een lege sessie
// aan, en de tafel vult zich daarna live (slepen + QR). `lobbySubView`
// onderscheidt binnen diezelfde "started, nog geen spel gekozen"-toestand
// alleen nog client-side of de party-zone (V2.5) of de fullscreen Game
// Select-scene (V2.6) zichtbaar is — geen van beide heeft ooit een eigen
// databasestatus nodig gehad.
type FlowState = "idle" | "started";
type LobbySubView = "party" | "select";

export default function GameNightHome() {
  const navigate = useNavigate();
  const { data: games = [] } = useGameNightGames();
  const { data: activePlayers = [] } = usePlayers();
  const { data: analyticsData } = useGameNightAnalytics();
  const champion = analyticsData ? buildHomepageChampion(analyticsData) : null;
  const { data: activeSession, isLoading: activeSessionLoading } =
    useActiveGameNightSession();
  const startGameNightSession = useStartGameNightSession();
  const startGameSession = useStartGameSession();
  const completeGameNight = useCompleteGameNight();

  const [flow, setFlow] = useState<FlowState>("idle");
  const [lobbySubView, setLobbySubView] = useState<LobbySubView>("party");
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

  const { data: latestGameSession } = useLatestGameSession(currentSession?.id);
  const { data: gameSessionParticipants = [] } = useGameSessionParticipants(
    latestGameSession?.id,
  );

  async function handleStartGameNight() {
    if (startGameNightSession.isPending) return; // voorkomt dubbele sessie bij dubbeltik
    const session = await startGameNightSession.mutateAsync([]);
    setCurrentSession(session);
    setFlow("started");
    setLobbySubView("party");
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
    navigate(`/game-night/geschiedenis/${closed.id}/finale`);
  }

  // Peripherale elementen (kampioen, titel, rechter menu) dimmen/trekken
  // zich terug zodra het bord de actieve interface wordt (sectie 18/33) —
  // de fysieke tafel/kaarsen/decoratie blijven gewoon zichtbaar, alleen de
  // functionele UI eromheen wijkt.
  const dimmed = flow !== "idle";
  const dimClass = dimmed ? "gn-peripheral-dim" : "";
  const showBoardDecoration = flow === "idle" && !activeSessionLoading;

  // UX-polish pokertafel (sectie 6): tijdens de daadwerkelijke speelweergave
  // (ActiveGameSessionPanel's "play"/"paused"-staat) vervangt de pokertafel-
  // PNG het gewone .gn-board — dezelfde voorwaarde als waarop
  // ActiveGameSessionPanel hieronder al gerenderd wordt. De middenkolom
  // wordt dan ook iets breder, zodat de tafel voldoende ruimte krijgt
  // (sectie 8: content moet ruim binnen het vilt blijven).
  const isActivePlay =
    flow === "started" &&
    !!currentSession &&
    !!latestGameSession &&
    latestGameSession.status !== "completed";
  const isWideContent = isActivePlay;

  // Game Night V2.5/V2.6 (sectie 21 V2.6: "Lobby, Game Select, Game Reveal
  //... vormen samen de nieuwe fullscreen V2-app") — zowel de lobby als de
  // volledige spelkeuze-flow VERVANGEN de oude .gn-tabletop-weergave
  // (topnav, kampioen, bord, menu) zodra een Game Night gestart is en er
  // nog geen spel actief is: één ononderbroken ervaring, geen terugval op
  // GameNightStartedPanel/GameChooserPanel meer (V2.6-root-cause-fix — zie
  // opleverrapport). Pas zodra latestGameSession bestaat (een spel is echt
  // gestart) valt de app terug op de bestaande .gn-tabletop-flow voor Live
  // Play — die schermen redesignt V2.6 nog niet (sectie 25).
  if (flow === "started" && currentSession && !latestGameSession) {
    if (lobbySubView === "party") {
      return (
        <GameNightV2Lobby
          session={currentSession}
          onChooseGame={() => setLobbySubView("select")}
          onCloseGameNight={handleCloseGameNight}
        />
      );
    }
    return (
      <GameNightV2GameSelect
        session={currentSession}
        onBack={() => setLobbySubView("party")}
      />
    );
  }

  return (
    <div className="gn-tabletop gn-tabletop-fit">
      <TopNav />

      <div
        className={`relative flex min-h-0 flex-col items-center justify-center gap-4 py-2 lg:flex-row ${
          isWideContent ? "lg:gap-5" : "lg:gap-9"
        }`}
      >
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
          <ChampionPlaque champion={champion} />
        </div>

        <div
          className={`relative z-30 order-1 flex w-full flex-col items-center gap-2.5 lg:order-2 lg:min-w-0 lg:flex-1 lg:gap-4 ${
            isWideContent ? "max-w-4xl" : "max-w-lg"
          }`}
        >
          <TitleBlock className={dimClass} />
          <div
            className={
              isActivePlay
                ? "relative w-full"
                : "gn-board relative w-full px-4 py-4 sm:px-7 sm:py-5 lg:-mt-1"
            }
          >
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

            {/* Sectie 22-23 (V2.4): "Start Game Night" maakt meteen een
                lege sessie aan en toont de lobby — geen aparte spelerkeuze-
                stap meer vooraf (PlayerSelectionBoard.tsx blijft als
                bestand staan, maar wordt hier niet meer gebruikt, zie het
                opleverrapport). "Hoe kiezen we?" is nu een stap BINNEN de
                lobby ("Wat spelen we?"), geen los toegangspunt meer. */}
            {!activeSessionLoading && flow === "idle" && (
              <div className="relative mx-auto flex max-w-sm flex-col gap-2.5">
                <ActionPlaque
                  onClick={handleStartGameNight}
                  icon={Users}
                  title="Start Game Night"
                  subtitle="Begin een nieuwe avond"
                  primary
                />
              </div>
            )}

            {/* flow==="started" && !latestGameSession wordt nu altijd al
                hierboven afgehandeld door de vroege return naar
                GameNightV2Lobby/GameNightV2GameSelect — dit deel van de
                boom is dus alleen nog bereikbaar zodra latestGameSession
                bestaat. */}
            {flow === "started" &&
              currentSession &&
              latestGameSession &&
              latestGameSession.status !== "completed" && (
                <ActiveGameSessionPanel
                  gameSession={latestGameSession}
                  participants={gameSessionParticipants}
                />
              )}

            {flow === "started" &&
              currentSession &&
              latestGameSession &&
              latestGameSession.status === "completed" && (
                <GameSessionCompletedPanel
                  gameSession={latestGameSession}
                  participants={gameSessionParticipants}
                  onRematch={handleRematch}
                  onOtherGame={() => navigate("/game-night/spellen")}
                  onCloseGameNight={handleCloseGameNight}
                  rematchPending={startGameSession.isPending}
                />
              )}
          </div>
        </div>

        <div
          className={`relative z-30 order-2 w-full max-w-xs lg:order-3 lg:ml-6 lg:mt-5 lg:w-56 lg:shrink-0 ${dimClass}`}
        >
          <ExploreNav
            gamesCount={games.length}
            playersCount={activePlayers.length}
          />
        </div>
      </div>
    </div>
  );
}
