import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ChampionPlaque } from "@/features/game-night/components/ChampionPlaque";
import { ExploreNav } from "@/features/game-night/components/ExploreNav";
import { CandleLayer } from "@/features/game-night/components/CandleLayer";
import { ScatteredTableObjects } from "@/features/game-night/components/ScatteredTableObjects";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";
import { GameNightV2Start } from "@/features/game-night/v2/GameNightV2Start";
import { GameNightV2Lobby } from "@/features/game-night/v2/GameNightV2Lobby";
import { GameNightV2GameSelect } from "@/features/game-night/v2/GameNightV2GameSelect";
import { GameNightV2Arena } from "@/features/game-night/v2/GameNightV2Arena";
import { GameNightV2GameRecap } from "@/features/game-night/v2/GameNightV2GameRecap";
import { GameNightV2NightRecap } from "@/features/game-night/v2/GameNightV2NightRecap";
import { ActiveGameSessionPanel } from "@/features/game-night/components/ActiveGameSessionPanel";
import { GameSessionCompletedPanel } from "@/features/game-night/components/GameSessionCompletedPanel";
import { GameNightNowPlaying } from "@/features/game-night/components/GameNightNowPlaying";

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
  // Game Night V2.7C (sectie 5) — de zojuist voltooide avond, puur lokale
  // view-state: Supabase blijft bron van waarheid voor de daadwerkelijke
  // completion (`closed` komt rechtstreeks terug van de bestaande
  // completeGameNight-RPC), dit bewaart uitsluitend WELKE sessie we net
  // hebben afgesloten zodat GameNightV2NightRecap kan blijven staan nadat
  // useActiveGameNightSession al naar null is omgeslagen. Een harde
  // refresh verliest deze state bewust (sectie 5: "dat is prima en zelfs
  // gewenst") — dan toont /game-night gewoon GameNightV2Start.
  const [completedNightSession, setCompletedNightSession] =
    useState<GameNightSession | null>(null);

  // Sectie 33/35/36: na reload/opnieuw binnenkomen moet een actieve Game
  // Night direct hervat worden — geen extra tik nodig, geen "Start Game
  // Night" te zien terwijl er al iets loopt.
  useEffect(() => {
    if (activeSession && flow === "idle" && !currentSession) {
      setCurrentSession(activeSession);
      setFlow("started");
    }
  }, [activeSession, flow, currentSession]);

  // Game Night V2.7C (sectie 6) — dezelfde voorwaarde als de effect
  // hierboven: als die net op het punt staat te vuren (activeSession is al
  // binnen, maar `flow`/`currentSession` zijn nog niet bijgewerkt), zou een
  // render daartussenin per ongeluk kortstondig GameNightV2Start tonen
  // terwijl er in werkelijkheid al een actieve avond is. Behandel dat ene
  // tussenframe als "nog aan het laden" i.p.v. als "geen actieve avond".
  const stillSyncingActiveSession =
    !!activeSession && flow === "idle" && !currentSession;

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
    // Game Night V2.7C (root cause "GAME NIGHT VOLTOOID"): navigeerde
    // hiervoor naar de losse, houten finale-route — die route blijft
    // bestaan voor historische replay vanuit Geschiedenis, maar de NORMALE
    // afsluitflow toont voortaan meteen GameNightV2NightRecap, binnen
    // dezelfde GNV2-scene.
    const closed = await completeGameNight.mutateAsync(currentSession.id);
    setCompletedNightSession(closed);
  }

  // Game Night V2.7C (sectie 5) — "Nieuwe Game Night" in de Night Recap
  // start NIET automatisch een nieuwe avond, het verlaat alleen de
  // recap-view-state zodat de normale routing (geen actieve Game Night)
  // vanzelf GameNightV2Start toont.
  function handleReturnToStart() {
    setCompletedNightSession(null);
    setCurrentSession(null);
    setFlow("idle");
    setLobbySubView("party");
  }

  // Peripherale elementen (kampioen, titel, rechter menu) dimmen/trekken
  // zich terug zodra het bord de actieve interface wordt (sectie 18/33) —
  // de fysieke tafel/kaarsen/decoratie blijven gewoon zichtbaar, alleen de
  // functionele UI eromheen wijkt.
  const dimmed = flow !== "idle";
  const dimClass = dimmed ? "gn-peripheral-dim" : "";

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

  // Game Night V2.7C (sectie 7) — definitieve routingvolgorde. De eerste
  // twee checks MOETEN vóór de "started"-substate-routing staan:
  // - Nog aan het laden (of het ene tussenframe van de resume-effect
  //   hierboven, sectie 6) → nooit een gok wagen, gewoon een GNV2-rustpunt.
  // - `completedNightSession` is gezet zodra handleCloseGameNight klaar is
  //   — op dat moment staan `flow`/`currentSession`/`latestGameSession` nog
  //   op hun oude waarden (bewust niet aangeraakt, zie handleCloseGameNight)
  //   en zouden ANDERS de "started"-tak hieronder in laten lopen (die zou
  //   op basis van de nu-afgeronde latestGameSession per ongeluk
  //   GameNightV2GameRecap tonen i.p.v. de Night Recap).
  if (activeSessionLoading || stillSyncingActiveSession) {
    return <GnV2Loading />;
  }

  if (completedNightSession) {
    return (
      <GameNightV2NightRecap
        session={completedNightSession}
        onNewGameNight={handleReturnToStart}
      />
    );
  }

  // Game Night V2.5/V2.6/V2.7B (sectie 33-34 V2.7B: "Lobby, Game Select,
  // Game Reveal, Live Play, Game Recap vormen samen de nieuwe fullscreen
  // V2-app") — de lobby, de volledige spelkeuze-flow, ÉN (voor
  // win_events-sessies) Live Play/Recap VERVANGEN de oude .gn-tabletop-
  // weergave (topnav, kampioen, bord, menu, hout) volledig: één
  // ononderbroken ervaring. `lobbySubView` wordt hier bewust hergebruikt
  // voor twee routeerdoelen die elkaar nooit overlappen: "party"/"select"
  // vóórdat een spel gekozen is, én — zodra de laatste win_events-sessie
  // net is afgerond — "select" laat "Ander spel" terug naar Game Select
  // gaan zonder een nieuwe lobbySubView-status te hoeven verzinnen.
  //
  // Alleen een LEGACY-sessie (win_source !== 'win_events', dus altijd van
  // vóór V2.2) valt nog terug op de bestaande .gn-tabletop-flow hieronder
  // — bewust behouden als fallback (sectie 43 V2.7B), nooit meer bereikt
  // door een nieuwe sessie (die worden altijd met win_source='win_events'
  // gestart).
  if (flow === "started" && currentSession) {
    if (!latestGameSession) {
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

    if (latestGameSession.win_source === "win_events") {
      if (latestGameSession.status === "completed") {
        if (lobbySubView === "select") {
          return (
            <GameNightV2GameSelect
              session={currentSession}
              onBack={() => setLobbySubView("party")}
            />
          );
        }
        return (
          <GameNightV2GameRecap
            session={currentSession}
            gameSession={latestGameSession}
            participants={gameSessionParticipants}
            onRematch={handleRematch}
            onOtherGame={() => setLobbySubView("select")}
            onCloseGameNight={handleCloseGameNight}
            rematchPending={startGameSession.isPending}
          />
        );
      }
      return (
        <GameNightV2Arena
          session={currentSession}
          gameSession={latestGameSession}
          participants={gameSessionParticipants}
        />
      );
    }
  }

  // Game Night V2.7C (root cause "houten START GAME NIGHT-homepage") — de
  // idle-staat (geen actieve Game Night) is voortaan altijd GNV2. De oude
  // .gn-tabletop-boom hieronder is na deze return uitsluitend nog
  // bereikbaar via het `flow==="started"`-blok hierboven NIET geretourneerd
  // te hebben — dat kan alleen gebeuren voor een genuine legacy-sessie
  // (win_source !== 'win_events'). Een owner zonder actieve Game Night is
  // GEEN legacy-situatie.
  if (flow === "idle") {
    return (
      <GameNightV2Start
        onStart={handleStartGameNight}
        startPending={startGameNightSession.isPending}
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
            {/* Dit deel van de boom is (V2.7B/V2.7C) uitsluitend nog
                bereikbaar voor een LEGACY spelsessie (win_source !==
                'win_events') — elke andere combinatie (geen actieve avond,
                of een win_events-sessie in elke status) wordt al hierboven
                afgehandeld door de vroege return naar
                GameNightV2Start/GameNightV2Lobby/GameNightV2GameSelect/
                GameNightV2Arena/GameNightV2GameRecap/GameNightV2NightRecap.
                De idle-decoratie (losse speelstukken/ActionPlaque) hoort
                daarom niet meer hier — die leeft nu in
                GameNightV2Start.tsx. */}
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
