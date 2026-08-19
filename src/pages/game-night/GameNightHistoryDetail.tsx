import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Images, Loader2 } from "lucide-react";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import {
  buildGameNightDetail,
  type GameNightGameSessionDetail,
} from "@/features/game-night/lib/gameNightStats";
import { formatDuration } from "@/features/game-night/lib/gameTimer";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";
import { useCheckpointsForSession } from "@/features/game-night/hooks/useCheckpoints";
import { CheckpointHistoryPanel } from "@/features/game-night/components/CheckpointHistoryPanel";
import { CheckpointViewer } from "@/features/game-night/components/CheckpointViewer";
import { PlayerLink } from "@/features/game-night/components/PlayerLink";
import { gameDetailPath } from "@/features/game-night/lib/gameNightStats";
import type { GameNightPlayer } from "@/lib/supabase";

// Opent dezelfde bestaande checkpoint-lijst/viewer als tijdens het spelen
// (sectie 10) — géén tweede fotoviewer, alleen een sheet-omhulsel eromheen
// omdat deze detailpagina, anders dan het live bord, geen eigen
// view-state-machine heeft om deze panelen inline te tonen.
function GameSessionCheckpointsModal({
  gameSessionId,
  attendees,
  onClose,
}: {
  gameSessionId: string;
  attendees: GameNightPlayer[];
  onClose: () => void;
}) {
  const { data: checkpoints = [] } = useCheckpointsForSession(gameSessionId);
  const [viewingId, setViewingId] = useState<string | null>(null);

  return (
    <div className="gnv2-checkpoint-overlay" role="dialog" aria-modal="true">
      <div className="gnv2-checkpoint-card">
        {viewingId ? (
          <CheckpointViewer
            checkpoint={
              checkpoints.find((c) => c.id === viewingId) ?? checkpoints[0]
            }
            checkpoints={checkpoints}
            attendees={attendees}
            onNavigateCheckpoint={setViewingId}
            onClose={onClose}
          />
        ) : (
          <CheckpointHistoryPanel
            checkpoints={checkpoints}
            onSelect={setViewingId}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function GameSessionCard({ detail }: { detail: GameNightGameSessionDetail }) {
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const { data: checkpoints = [] } = useCheckpointsForSession(
    detail.gameSession.id,
  );
  const coverUrl = detail.game.cover_storage_path
    ? getGameCoverUrl(detail.game.cover_storage_path)
    : null;
  const winner = detail.results.find((r) => r.isWinner);
  const isScoreMode = detail.gameSession.result_mode === "score";

  return (
    <div className="gn-panel-elevated px-5 py-4">
      <div className="flex items-start gap-3">
        <Link
          to={gameDetailPath(detail.game)}
          className="gn-cover h-16 w-13 shrink-0 overflow-hidden"
        >
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-end p-1.5"
              style={{ background: placeholderCoverGradient(detail.game.id) }}
              aria-hidden
            >
              <span className="gn-display text-sm font-semibold text-white/75">
                {detail.game.name.charAt(0)}
              </span>
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={gameDetailPath(detail.game)}
            className="gn-display block text-base font-semibold tracking-wide hover:text-[var(--gn-brass)]"
          >
            {detail.game.name}
          </Link>
          <p className="gn-muted mt-0.5 text-xs">
            {detail.participants.map((p, i) => (
              <span key={p.id}>
                {i > 0 && " · "}
                <PlayerLink player={p} />
              </span>
            ))}
          </p>
          {detail.durationSeconds != null && (
            <p className="gn-faint mt-1 text-xs">
              {formatDuration(detail.durationSeconds)}
            </p>
          )}
        </div>
      </div>

      {detail.rounds.length > 0 && (
        <div className="mt-3">
          <p className="gn-eyebrow mb-1.5">{detail.rounds.length} RONDES</p>
          <div className="gn-faint flex flex-col gap-0.5 text-xs">
            {detail.rounds.map((r) => (
              <p key={r.round.id}>
                Ronde {r.round.round_number} —{" "}
                {r.winner ? <PlayerLink player={r.winner} /> : "geen resultaat"}
              </p>
            ))}
          </div>
        </div>
      )}

      {isScoreMode && detail.hasResult && (
        <div className="mt-3">
          <p className="gn-eyebrow mb-1.5">Eindstand</p>
          <div className="flex flex-col gap-0.5 text-xs">
            {detail.results.map((r) => (
              <p
                key={r.player.id}
                className={r.isWinner ? "font-semibold" : "gn-muted"}
              >
                <PlayerLink player={r.player} /> — {r.score ?? "–"}
              </p>
            ))}
          </div>
        </div>
      )}

      {!isScoreMode && winner && (
        <p className="mt-3 text-sm">
          Winnaar · <PlayerLink player={winner.player} />
        </p>
      )}

      {!isScoreMode &&
        !detail.hasResult &&
        detail.gameSession.has_session_winner && (
          <p className="gn-faint mt-3 text-xs italic">
            Geen eindwinnaar geregistreerd
          </p>
        )}

      {checkpoints.length > 0 && (
        <button
          type="button"
          onClick={() => setShowCheckpoints(true)}
          className="gn-faint mt-3 flex min-h-[36px] items-center gap-1.5 text-[11px] underline"
        >
          <Images className="h-3 w-3" />
          Spelstanden · {checkpoints.length}
        </button>
      )}

      {showCheckpoints && (
        <GameSessionCheckpointsModal
          gameSessionId={detail.gameSession.id}
          attendees={detail.participants}
          onClose={() => setShowCheckpoints(false)}
        />
      )}
    </div>
  );
}

// Game Night-detail (sectie 6-10/40): chronologische tijdlijn van gespeelde
// spellen binnen één avond, met rondes/resultaten/spelstanden — alles
// afgeleid uit dezelfde AnalyticsData als de geschiedenislijst, zodat de
// cijfers nooit uiteenlopen (sectie 41).
export default function GameNightHistoryDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data, isLoading } = useGameNightAnalytics();
  const detail =
    data && sessionId ? buildGameNightDetail(data, sessionId) : null;

  const date = detail
    ? new Date(detail.session.started_at).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/game-night/geschiedenis"
        className="gn-muted inline-flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--gn-brass)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar geschiedenis
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="gn-faint h-5 w-5 animate-spin" />
        </div>
      ) : !detail ? (
        <p className="gn-faint text-sm">Deze Game Night is niet gevonden.</p>
      ) : (
        <>
          <div>
            <p className="gn-eyebrow mb-1.5">Game Night</p>
            <h1 className="gn-display text-2xl font-semibold sm:text-3xl">
              {date}
            </h1>
            <p className="gn-muted mt-1.5 text-sm">
              {detail.attendees.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && " · "}
                  <PlayerLink player={p} />
                </span>
              ))}
            </p>
            <p className="gn-faint mt-2 text-xs">
              {detail.totals.gamesPlayed}{" "}
              {detail.totals.gamesPlayed === 1 ? "spel" : "spellen"}
              {detail.totals.roundCount > 0 &&
                ` · ${detail.totals.roundCount} rondes`}
              {detail.totals.totalActiveSeconds > 0 &&
                ` · ${formatDuration(detail.totals.totalActiveSeconds)} actieve speeltijd`}
            </p>
            {detail.session.status === "completed" && (
              <Link
                to={`/game-night/geschiedenis/${detail.session.id}/finale`}
                className="gn-muted mt-2 inline-block text-xs underline"
              >
                Bekijk finale opnieuw
              </Link>
            )}
          </div>

          {(detail.sessionWinsByPlayer.length > 0 ||
            detail.roundWinsByPlayer.length > 0) && (
            <div className="gn-panel-elevated px-5 py-4">
              <p className="gn-eyebrow mb-2">Winnaars van de avond</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                {detail.sessionWinsByPlayer.map((w) => (
                  <span key={`sw-${w.player.id}`}>
                    <PlayerLink player={w.player} /> · {w.wins} session{" "}
                    {w.wins === 1 ? "win" : "wins"}
                  </span>
                ))}
              </div>
              {detail.roundWinsByPlayer.length > 0 && (
                <div className="gn-faint mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  {detail.roundWinsByPlayer.map((w) => (
                    <span key={`rw-${w.player.id}`}>
                      <PlayerLink player={w.player} /> · {w.wins} round{" "}
                      {w.wins === 1 ? "win" : "wins"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {detail.gameSessions.map((gs) => (
              <GameSessionCard key={gs.gameSession.id} detail={gs} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
