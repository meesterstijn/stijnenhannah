import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Info, Loader2, PlayCircle, Settings } from "lucide-react";
import type { GameNightGame } from "@/lib/supabase";
import { useGameNightGames } from "@/features/game-night/hooks/useGameNightGames";
import { useActiveGameNightSession } from "@/features/game-night/hooks/useGameNightSession";
import { useLatestGameSession } from "@/features/game-night/hooks/useGameSession";
import { useActivePartyPlayers } from "@/features/game-night/hooks/useGameNightParty";
import { GameCard } from "@/features/game-night/components/GameCard";
import { GameParticipantSheet } from "@/features/game-night/components/GameParticipantSheet";
import { GameFlowSettingsSheet } from "@/features/game-night/components/GameFlowSettingsSheet";
import { gameDetailPath } from "@/features/game-night/lib/gameNightStats";

// Sectie 3/4: de Spellenkast blijft ook zonder actieve Game Night gewoon
// zichzelf (kaarten zijn dan puur informatief, zoals nu). Zodra er een
// actieve Game Night bestaat ÉN er nog geen spel wordt gespeeld, wordt elke
// kaart een selecteerbare "kies dit spel"-actie — is er al een spel actief/
// gepauzeerd, dan tonen we dat i.p.v. een tweede spel te laten starten
// (sectie 8). Alles komt uit Supabase, geen navigation-state. Het
// tandwiel-icoontje (Spelverloop) staat als sibling naast/onder de kaart,
// niet erin genest — zo blijft "kaart aantikken = spel kiezen" en
// "tandwiel aantikken = instellingen" altijd twee gescheiden knoppen, ook
// als de kaart zelf al een <button> is.
export default function GameNightGames() {
  const { data: games = [], isLoading } = useGameNightGames();
  const { data: activeGameNight } = useActiveGameNightSession();
  // Sectie 26 (V2.4): alleen spelers die NU actief aan tafel zitten, niet
  // de volledige avond-attendance.
  const { data: attendees = [] } = useActivePartyPlayers(activeGameNight?.id);
  const { data: latestGameSession } = useLatestGameSession(activeGameNight?.id);
  const [pickingGame, setPickingGame] = useState<GameNightGame | null>(null);
  const [configuringGame, setConfiguringGame] = useState<GameNightGame | null>(
    null,
  );

  const openGameSession =
    latestGameSession && latestGameSession.status !== "completed"
      ? latestGameSession
      : null;
  const selectionMode = !!activeGameNight && !openGameSession;

  return (
    <div className="space-y-7">
      <Link
        to="/game-night"
        className="gn-muted inline-flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--gn-brass)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar Game Night
      </Link>

      <div>
        <p className="gn-eyebrow mb-1.5">Game Night</p>
        <h1 className="gn-display text-2xl font-semibold sm:text-3xl">
          Mijn spellen
        </h1>
        <p className="gn-muted mt-1.5 text-sm">
          {isLoading
            ? "Kast wordt geladen…"
            : `${games.length} ${games.length === 1 ? "spel" : "spellen"} in de kast`}
        </p>
        {selectionMode && (
          <p className="gn-faint mt-2 text-xs">
            Tik een spel aan om het te starten voor de huidige Game Night.
          </p>
        )}
        {openGameSession && (
          <div className="gn-chip gn-chip-felt mt-2 inline-flex items-center gap-1.5">
            <PlayCircle className="h-3 w-3" />
            Er wordt al {openGameSession.game.name} gespeeld —{" "}
            <Link to="/game-night" className="underline">
              ga terug
            </Link>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="gn-faint h-5 w-5 animate-spin" />
        </div>
      ) : games.length === 0 ? (
        <p className="gn-faint text-sm">Nog geen spellen in de kast.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((game) => {
            const badge = game.uses_rounds ? (
              <span className="gn-chip">Rondes</span>
            ) : undefined;
            return (
              <div key={game.id} className="relative h-full">
                {selectionMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPickingGame(game)}
                      className="h-full w-full text-left transition-transform active:scale-[0.98]"
                    >
                      <GameCard game={game} badge={badge} />
                    </button>
                    {/* Sectie 3 (Game Night V6): tijdens spelselectie blijft de
                        hoofdtik op de kaart "spel kiezen" — speldetail krijgt
                        hier een eigen, niet-geneste knop i.p.v. de kaart zelf
                        te laten linken. */}
                    <Link
                      to={gameDetailPath(game)}
                      onClick={(e) => e.stopPropagation()}
                      className="gn-topnav-icon-btn absolute left-2 top-2 z-10"
                      aria-label={`Meer info over ${game.name}`}
                      title="Speldetail"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </Link>
                  </>
                ) : (
                  <GameCard
                    game={game}
                    badge={badge}
                    to={gameDetailPath(game)}
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfiguringGame(game);
                  }}
                  className="gn-topnav-icon-btn absolute right-2 bottom-2 z-10"
                  aria-label={`Spelverloop van ${game.name} instellen`}
                  title="Spelverloop"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pickingGame && activeGameNight && (
        <GameParticipantSheet
          game={pickingGame}
          attendees={attendees}
          gameNightSessionId={activeGameNight.id}
          onClose={() => setPickingGame(null)}
        />
      )}

      {configuringGame && (
        <GameFlowSettingsSheet
          game={configuringGame}
          onClose={() => setConfiguringGame(null)}
        />
      )}
    </div>
  );
}
