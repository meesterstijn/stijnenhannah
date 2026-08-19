import type { GameNightGame } from "@/lib/supabase";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";

function fits(game: GameNightGame, playerCount: number): boolean {
  if (game.min_players != null && playerCount < game.min_players) return false;
  if (game.max_players != null && playerCount > game.max_players) return false;
  return true;
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
  onSelect,
}: {
  game: GameNightGame;
  dimmed: boolean;
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
  const unsuitable = games.filter((g) => !fits(g, playerCount));

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

      {unsuitable.length > 0 && (
        <div className="gnv2-lib-unsuitable">
          <p className="gnv2-lib-unsuitable-label">
            Niet geschikt voor vanavond
          </p>
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
