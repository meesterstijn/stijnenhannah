import { useMemo } from "react";
import type { GameNightPlayer, GameNightSession } from "@/lib/supabase";
import type { GameSessionWithGame } from "@/features/game-night/hooks/useGameSession";
import { useGameSessionWinEvents } from "@/features/game-night/hooks/useGameNightWinEvents";
import { useGameNightColorPalette } from "@/features/game-night/hooks/useGameNightMemberProfile";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import {
  getPlayerDisplayName,
  resolvePlayerColorHex,
} from "@/features/game-night/lib/playerIdentity";
import { buildRecapHighlights } from "@/features/game-night/lib/gameNightCompetitiveMoments";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";

// Game Night V2.7B (sectie 30-32) — vervangt GameSessionCompletedPanel
// volledig voor win_events-sessies. GEEN apart "session winner"-record:
// dit is uitsluitend een presentatie van de daadwerkelijke win_events
// (sectie 30: "Dit is GEEN apart 'session winner'-record. Alleen
// presentatie van de daadwerkelijke win_events.").
export function GameNightV2GameRecap({
  session,
  gameSession,
  participants,
  onRematch,
  onOtherGame,
  onCloseGameNight,
  rematchPending,
}: {
  session: GameNightSession;
  gameSession: GameSessionWithGame;
  participants: GameNightPlayer[];
  onRematch: () => void;
  onOtherGame: () => void;
  onCloseGameNight: () => void;
  rematchPending: boolean;
}) {
  const { data: events = [] } = useGameSessionWinEvents(gameSession.id);
  const { data: palette = [] } = useGameNightColorPalette();
  const { data: analyticsData } = useGameNightAnalytics();

  const participantsById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );

  const standings = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.undone_at != null) continue;
      counts.set(e.player_id, (counts.get(e.player_id) ?? 0) + 1);
    }
    return participants
      .map((player) => ({ player, wins: counts.get(player.id) ?? 0 }))
      .sort((a, b) => b.wins - a.wins);
  }, [events, participants]);

  const highlights = useMemo(
    () =>
      buildRecapHighlights(
        analyticsData,
        gameSession.game_id,
        gameSession.id,
        events,
        participantsById,
      ),
    [
      analyticsData,
      gameSession.game_id,
      gameSession.id,
      events,
      participantsById,
    ],
  );

  const top = standings[0];

  return (
    <GnV2Scene className="gnv2-recap-scene">
      <div className="gnv2-recap-root">
        <p className="gnv2-recap-eyebrow">Spel afgelopen</p>
        <p className="gnv2-recap-game">{gameSession.game.name}</p>

        {top && top.wins > 0 && (
          <div className="gnv2-recap-winner">
            <span
              className="gnv2-avatar gnv2-avatar-lg"
              style={{
                ["--gnv2-ring" as string]:
                  resolvePlayerColorHex(top.player, palette) ??
                  "var(--gnv2-border-strong)",
              }}
            >
              {getPlayerDisplayName(top.player).charAt(0).toUpperCase()}
            </span>
            <p className="gnv2-recap-winner-name">
              {getPlayerDisplayName(top.player)}
            </p>
            <p className="gnv2-recap-winner-wins">
              {top.wins} {top.wins === 1 ? "WIN" : "WINS"}
            </p>
          </div>
        )}

        {standings.length > 1 && (
          <div className="gnv2-recap-standings">
            {standings.slice(1).map(({ player, wins }) => (
              <p key={player.id} className="gnv2-recap-standing-row">
                <span>{getPlayerDisplayName(player)}</span>
                <span>{wins}</span>
              </p>
            ))}
          </div>
        )}

        {highlights.length > 0 && (
          <div className="gnv2-recap-highlights">
            {highlights.map((h) => (
              <p key={h} className="gnv2-recap-highlight">
                {h}
              </p>
            ))}
          </div>
        )}

        <div className="gnv2-recap-actions">
          <button
            type="button"
            onClick={onRematch}
            disabled={rematchPending}
            className="gnv2-btn gnv2-btn-primary gnv2-recap-action"
          >
            {rematchPending ? "Bezig..." : "Rematch"}
          </button>
          <button
            type="button"
            onClick={onOtherGame}
            className="gnv2-btn gnv2-btn-ghost gnv2-recap-action"
          >
            Ander spel
          </button>
          <button
            type="button"
            onClick={onCloseGameNight}
            className="gnv2-recap-close-link"
          >
            Game Night afsluiten
          </button>
        </div>

        <p className="gnv2-recap-session-name">{session.name}</p>
      </div>
    </GnV2Scene>
  );
}
