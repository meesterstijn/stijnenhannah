import { Trophy } from "lucide-react";
import type { GameSessionWithGame } from "@/features/game-night/hooks/useGameSession";
import { useGameSessionWinners } from "@/features/game-night/hooks/useGameSession";
import { formatDuration } from "@/features/game-night/lib/gameTimer";

// Sectie 25: na afronden blijft de Game Night actief, het bord toont een
// korte samenvatting + de drie vervolgacties. Duur wordt berekend uit
// started_at/ended_at/total_paused_seconds — geen aparte opslag nodig.
export function GameSessionCompletedPanel({
  gameSession,
  onRematch,
  onOtherGame,
  onCloseGameNight,
  rematchPending,
}: {
  gameSession: GameSessionWithGame;
  onRematch: () => void;
  onOtherGame: () => void;
  onCloseGameNight: () => void;
  rematchPending: boolean;
}) {
  const { data: winners = [] } = useGameSessionWinners(gameSession.id);

  const durationSeconds = gameSession.ended_at
    ? (new Date(gameSession.ended_at).getTime() -
        new Date(gameSession.started_at).getTime()) /
        1000 -
      gameSession.total_paused_seconds
    : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 text-center">
      <div>
        <p className="gn-eyebrow">{gameSession.game.name} afgerond</p>
        {winners.length > 0 && (
          <p className="gn-display mt-1 flex items-center justify-center gap-1.5 text-xl font-semibold sm:text-2xl">
            <Trophy className="h-5 w-5" style={{ color: "var(--gn-brass)" }} />
            {winners.map((w) => w.playerName).join(" & ")}
          </p>
        )}
        {durationSeconds > 0 && (
          <p className="gn-muted mt-1 text-xs">
            {formatDuration(durationSeconds)} gespeeld
          </p>
        )}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <button
          type="button"
          onClick={onRematch}
          disabled={rematchPending}
          className="gn-plaque-action gn-plaque-action-primary w-full px-6 py-3.5"
        >
          <span className="gn-display text-lg font-semibold tracking-wide">
            {rematchPending ? "Bezig..." : "Rematch"}
          </span>
          <span className="gn-muted mt-1 text-xs">
            Nog een keer {gameSession.game.name}
          </span>
        </button>
        <button
          type="button"
          onClick={onOtherGame}
          className="gn-plaque-action w-full px-6 py-3.5"
        >
          <span className="gn-display text-lg font-semibold tracking-wide">
            Ander spel
          </span>
        </button>
        <button
          type="button"
          onClick={onCloseGameNight}
          className="gn-muted text-xs underline"
        >
          Game Night afsluiten
        </button>
      </div>
    </div>
  );
}
