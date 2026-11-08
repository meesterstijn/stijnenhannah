import type { GameNightGame } from "@/lib/supabase";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";

function fits(game: GameNightGame, playerCount: number): boolean {
  if (game.min_players != null && playerCount < game.min_players) return false;
  if (game.max_players != null && playerCount > game.max_players) return false;
  return true;
}

// Meer mensen aan tafel dan het spel toestaat is geen blokkade: GameReveal
// laat de host dan kiezen wie er meespelen. Alleen te weinig spelers is
// echt "niet geschikt".
function tooFewPlayers(game: GameNightGame, playerCount: number): boolean {
  return game.min_players != null && playerCount < game.min_players;
}

function unsuitableReason(game: GameNightGame): string {
  if (game.min_players != null && game.max_players != null) {
    return `Voor ${game.min_players}–${game.max_players} spelers`;
  }
  if (game.min_players != null) return `Voor ${game.min_players}+ spelers`;
  return `Voor max. ${game.max_players} spelers`;
}

function GameSelectCard({
  game,
  dimmed,
  subset = false,
  onSelect,
}: {
  game: GameNightGame;
  dimmed: boolean;
  subset?: boolean;
  onSelect: () => void;
}) {
  const coverUrl = game.cover_storage_path
    ? getGameCoverUrl(game.cover_storage_path)
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`gnv2-lib-card ${dimmed ? "gnv2-lib-card-dimmed" : ""}`}
    >
      <div className="gnv2-lib-card-cover">
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <div
            className="gnv2-lib-card-cover-fallback"
            style={{ background: placeholderCoverGradient(game.id) }}
          >
            <span>{game.name.charAt(0)}</span>
          </div>
        )}
        <div className="gnv2-lib-card-scrim" />
        <p className="gnv2-lib-card-name">{game.name}</p>
      </div>
      <p className="gnv2-lib-card-meta">
        {dimmed
          ? unsuitableReason(game)
          : subset
            ? `Max. ${game.max_players} · jij kiest wie`
            : [
                game.min_players && game.max_players
                  ? `${game.min_players}–${game.max_players} spelers`
                  : null,
                game.duration_minutes ? `±${game.duration_minutes} min` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Spellenkast"}
      </p>
    </button>
  );
}

// Game Night V2.6 (sectie 9/10) — de spellenkast als foto-first grid,
// inline onderdeel van Game Select (geen aparte pagina meer nodig binnen
// deze flow). Spellen die niet passen bij het huidige spelersaantal worden
// NIET verborgen (sectie 10: "niet stilletjes volledig verwijderen") —
// eigen, gedimde sectie met een korte reden, wél nog tikbaar (opent de
// preview zodat je alsnog kunt zien wat het spel inhoudt).
export function GameLibrary({
  games,
  playerCount,
  onSelectGame,
}: {
  games: GameNightGame[];
  playerCount: number;
  onSelectGame: (game: GameNightGame) => void;
}) {
  const suitable = games.filter((g) => fits(g, playerCount));
  const subset = games.filter(
    (g) => !fits(g, playerCount) && !tooFewPlayers(g, playerCount),
  );
  const unsuitable = games.filter((g) => tooFewPlayers(g, playerCount));

  if (games.length === 0) {
    return <p className="gnv2-lib-empty">Nog geen spellen in de kast.</p>;
  }

  return (
    <div className="gnv2-lib">
      <div className="gnv2-lib-grid">
        {suitable.map((game) => (
          <GameSelectCard
            key={game.id}
            game={game}
            dimmed={false}
            onSelect={() => onSelectGame(game)}
          />
        ))}
      </div>

      {subset.length > 0 && (
        <div className="gnv2-lib-unsuitable">
          <p className="gnv2-lib-unsuitable-label">Met een deel van de tafel</p>
          <div className="gnv2-lib-grid">
            {subset.map((game) => (
              <GameSelectCard
                key={game.id}
                game={game}
                dimmed={false}
                subset
                onSelect={() => onSelectGame(game)}
              />
            ))}
          </div>
        </div>
      )}

      {unsuitable.length > 0 && (
        <div className="gnv2-lib-unsuitable">
          <p className="gnv2-lib-unsuitable-label">Te weinig spelers</p>
          <div className="gnv2-lib-grid">
            {unsuitable.map((game) => (
              <GameSelectCard
                key={game.id}
                game={game}
                dimmed
                onSelect={() => onSelectGame(game)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
