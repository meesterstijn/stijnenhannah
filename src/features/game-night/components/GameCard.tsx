import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Clock, Users } from "lucide-react";
import type { GameDifficulty, GameNightGame } from "@/lib/supabase";
import {
  cardTilt,
  placeholderCoverGradient,
} from "@/features/game-night/lib/gameCoverPlaceholder";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";

const DIFFICULTY_LABEL: Record<GameDifficulty, string> = {
  licht: "Licht",
  gemiddeld: "Gemiddeld",
  zwaar: "Zwaar",
};

function playersLabel(
  game: Pick<GameNightGame, "min_players" | "max_players">,
): string | null {
  const { min_players, max_players } = game;
  if (min_players && max_players && min_players !== max_players)
    return `${min_players}–${max_players}`;
  if (min_players || max_players) return `${min_players ?? max_players}`;
  return null;
}

// Hybride spelkaart (section 5): een echte cover (zodra geüpload) of een
// ontworpen placeholder zorgt voor herkenbaarheid/kleur, de rest van de
// kaart is volledig Game Night's eigen taal. `badge`/`action` zijn bewust
// generieke slots (geen ingebouwde "match %"-opmaak) zodat dezelfde kaart
// later door de spelkiezer/Game Roulette hergebruikt kan worden zonder een
// tweede kaartcomponent te bouwen — section 15/16 vragen daar expliciet om,
// zonder dat de picker zelf nu al gebouwd hoeft te worden.
export function GameCard({
  game,
  badge,
  action,
  to,
}: {
  game: GameNightGame;
  badge?: ReactNode;
  action?: ReactNode;
  to?: string;
}) {
  const tilt = useMemo(() => cardTilt(game.id), [game.id]);
  const coverUrl = game.cover_storage_path
    ? getGameCoverUrl(game.cover_storage_path)
    : null;
  const players = playersLabel(game);

  const card = (
    <div
      className="gn-card flex h-full flex-col overflow-hidden"
      style={{ "--gn-tilt": `${tilt}deg` } as CSSProperties}
    >
      <div className="gn-cover relative aspect-[4/5] shrink-0">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-end p-4"
            style={{ background: placeholderCoverGradient(game.id) }}
            aria-hidden
          >
            <span className="gn-display text-3xl font-semibold text-white/75">
              {game.name.charAt(0)}
            </span>
          </div>
        )}
        {badge && <div className="absolute right-2.5 top-2.5">{badge}</div>}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="text-sm font-semibold leading-tight">{game.name}</p>
        <div className="gn-faint flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {players && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {players}
            </span>
          )}
          {game.duration_minutes && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> ±{game.duration_minutes} min
            </span>
          )}
        </div>
        {game.difficulty && (
          <p className="gn-faint text-xs">
            Moeilijkheid: {DIFFICULTY_LABEL[game.difficulty]}
          </p>
        )}
        {game.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {game.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="gn-chip">
                {tag}
              </span>
            ))}
          </div>
        )}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full">
        {card}
      </Link>
    );
  }

  return card;
}
