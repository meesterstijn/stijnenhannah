import { Trophy } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import type { GameSessionWithGame } from "@/features/game-night/hooks/useGameSession";
import { useGameSessionWinners } from "@/features/game-night/hooks/useGameSession";
import { useGameSessionWinEvents } from "@/features/game-night/hooks/useGameNightWinEvents";
import { formatDuration } from "@/features/game-night/lib/gameTimer";

// Compacte WIN-tally i.p.v. een winnaar-declaratie (Game Night V2.2, sectie
// 14): win-events ZIJN de volledige winstwaarheid, er is nooit één
// "gewonnen"-speler om uit te lichten — gewoon ieders actieve telling,
// hoogste eerst. Geen podium, geen ceremonie.
function WinTally({
  gameSessionId,
  participants,
}: {
  gameSessionId: string;
  participants: GameNightPlayer[];
}) {
  const { data: events = [] } = useGameSessionWinEvents(gameSessionId);
  const countByPlayer = new Map<string, number>();
  for (const event of events) {
    if (event.undone_at != null) continue;
    countByPlayer.set(
      event.player_id,
      (countByPlayer.get(event.player_id) ?? 0) + 1,
    );
  }
  const tally = participants
    .map((p) => ({ player: p, wins: countByPlayer.get(p.id) ?? 0 }))
    .sort((a, b) => b.wins - a.wins);

  if (tally.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {tally.map(({ player, wins }) => (
        <p key={player.id} className="gn-muted text-sm">
          {player.nickname ?? player.name} · {wins} WIN{wins === 1 ? "" : "s"}
        </p>
      ))}
    </div>
  );
}

// Sectie 25: na afronden blijft de Game Night actief, het bord toont een
// korte samenvatting + de drie vervolgacties. Duur wordt berekend uit
// started_at/ended_at/total_paused_seconds — geen aparte opslag nodig.
export function GameSessionCompletedPanel({
  gameSession,
  participants,
  onRematch,
  onOtherGame,
  onCloseGameNight,
  rematchPending,
}: {
  gameSession: GameSessionWithGame;
  participants: GameNightPlayer[];
  onRematch: () => void;
  onOtherGame: () => void;
  onCloseGameNight: () => void;
  rematchPending: boolean;
}) {
  const isWinEvents = gameSession.win_source === "win_events";
  // Alleen relevant voor legacy-sessies — voor win_events-sessies schrijft
  // V2.2 nooit game_night_game_session_results (sectie 12), dus dit levert
  // daar altijd een lege lijst op; de hook zelf blijft veilig aanroepbaar.
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
        {isWinEvents ? (
          <div className="mt-1.5">
            <WinTally
              gameSessionId={gameSession.id}
              participants={participants}
            />
          </div>
        ) : (
          winners.length > 0 && (
            <p className="gn-display mt-1 flex items-center justify-center gap-1.5 text-xl font-semibold sm:text-2xl">
              <Trophy
                className="h-5 w-5"
                style={{ color: "var(--gn-brass)" }}
              />
              {winners.map((w) => w.playerName).join(" & ")}
            </p>
          )
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
