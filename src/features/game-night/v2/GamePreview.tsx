import { Clock, Users } from "lucide-react";
import type { GameNightGame } from "@/lib/supabase";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";
import { gameTagLabel } from "@/features/game-night/lib/gameTags";

function playersLabel(game: GameNightGame): string | null {
  const { min_players, max_players } = game;
  if (min_players && max_players && min_players !== max_players)
    return `${min_players}–${max_players} spelers`;
  if (min_players || max_players)
    return `${min_players ?? max_players} spelers`;
  return null;
}

// Game Night V2.6 (sectie 11) — de tussenstap vanuit de spellenkast-grid:
// een grote, foto-dominante preview i.p.v. direct een game_session starten.
// "Dit spelen we" stuurt de gekozen game door naar GameReveal — dit
// component schrijft zelf niets naar Supabase.
export function GamePreview({
  game,
  playerCount,
  onBack,
  onConfirm,
}: {
  game: GameNightGame;
  playerCount: number;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const coverUrl = game.cover_storage_path
    ? getGameCoverUrl(game.cover_storage_path)
    : null;
  const tooFew = game.min_players != null && playerCount < game.min_players;
  const tooMany = game.max_players != null && playerCount > game.max_players;
  const unsuitable = tooFew || tooMany;

  return (
    <div className="gnv2-preview gnv2-view-enter">
      <button type="button" onClick={onBack} className="gnv2-preview-back">
        Terug
      </button>

      <div className="gnv2-preview-body">
        <div className="gnv2-preview-cover">
          {coverUrl ? (
            <img src={coverUrl} alt="" />
          ) : (
            <div
              className="gnv2-preview-cover-fallback"
              style={{ background: placeholderCoverGradient(game.id) }}
            >
              <span>{game.name.charAt(0)}</span>
            </div>
          )}
        </div>

        <div className="gnv2-preview-info">
          <p className="gnv2-preview-title">{game.name}</p>

          <div className="gnv2-preview-meta">
            {playersLabel(game) && (
              <span>
                <Users className="h-4 w-4" /> {playersLabel(game)}
              </span>
            )}
            {game.duration_minutes && (
              <span>
                <Clock className="h-4 w-4" /> ±{game.duration_minutes} min
              </span>
            )}
          </div>

          {game.tags.length > 0 && (
            <div className="gnv2-preview-tags">
              {game.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="gnv2-tag">
                  {gameTagLabel(tag)}
                </span>
              ))}
            </div>
          )}

          {game.description && (
            <p className="gnv2-preview-description">{game.description}</p>
          )}

          {unsuitable && (
            <p className="gnv2-preview-warning">
              {tooFew
                ? `Dit spel heeft minimaal ${game.min_players} spelers nodig`
                : `Dit spel ondersteunt maximaal ${game.max_players} spelers`}
            </p>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={unsuitable}
            className="gnv2-btn gnv2-btn-primary"
          >
            Dit spelen we
          </button>
        </div>
      </div>
    </div>
  );
}
