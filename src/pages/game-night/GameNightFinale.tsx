import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Camera, Crown, Loader2, Trophy } from "lucide-react";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { useFinalePhotos } from "@/features/game-night/hooks/useCheckpoints";
import {
  buildGameNightDetail,
  gameDetailPath,
  type GameNightGameSessionDetail,
} from "@/features/game-night/lib/gameNightStats";
import {
  buildFinaleEvents,
  buildFinaleSteps,
  getGameNightFunStats,
  type FinaleEvent,
  type FinaleStepId,
} from "@/features/game-night/lib/gameNightFinale";
import { formatDuration } from "@/features/game-night/lib/gameTimer";
import { PlayerLink } from "@/features/game-night/components/PlayerLink";
import { CheckpointLightbox } from "@/features/game-night/components/CheckpointLightbox";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";
import { TopNav } from "@/features/game-night/components/TopNav";

type Screen =
  | { kind: "intro" }
  | { kind: "tonight" }
  | { kind: "results" }
  | { kind: "moments" }
  | { kind: "award"; event: FinaleEvent }
  | { kind: "podium" };

function GameLink({ game }: { game: GameNightGameSessionDetail["game"] }) {
  return (
    <Link
      to={gameDetailPath(game)}
      className="underline decoration-dotted underline-offset-2 hover:text-[var(--gn-brass)]"
    >
      {game.name}
    </Link>
  );
}

function ResultLine({ detail }: { detail: GameNightGameSessionDetail }) {
  const winner = detail.results.find((r) => r.isWinner);
  const isScoreMode = detail.gameSession.result_mode === "score";

  return (
    <div className="gn-panel-elevated px-4 py-3">
      <p className="text-sm font-semibold">
        <GameLink game={detail.game} />
      </p>
      {detail.rounds.length > 0 ? (
        <div className="gn-muted mt-1 text-xs">
          {detail.rounds.length} rondes
          {detail.rounds.length > 0 && (
            <span className="gn-faint">
              {" · "}
              {[
                ...new Map(
                  detail.rounds
                    .filter((r) => r.winner)
                    .map((r) => [r.winner!.id, r.winner!]),
                ).values(),
              ]
                .map((p) => {
                  const wins = detail.rounds.filter(
                    (r) => r.winner?.id === p.id,
                  ).length;
                  return `${p.name} ${wins}`;
                })
                .join(" · ")}
            </span>
          )}
        </div>
      ) : isScoreMode && detail.hasResult ? (
        <p className="gn-muted mt-1 text-xs">
          {detail.results
            .map((r) => `${r.player.name} ${r.score ?? "–"}`)
            .join(" · ")}
        </p>
      ) : winner ? (
        <p className="gn-muted mt-1 text-xs">
          <PlayerLink player={winner.player} /> won
        </p>
      ) : detail.gameSession.has_session_winner ? (
        <p className="gn-faint mt-1 text-xs italic">
          Geen eindwinnaar geregistreerd
        </p>
      ) : null}
    </div>
  );
}

function AwardPlaque({ event }: { event: FinaleEvent }) {
  const Icon = event.game ? Trophy : Crown;
  return (
    <div className="gn-plaque gn-plaque-tilt gn-finale-reveal px-6 py-7 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <Icon className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
        <p className="gn-eyebrow">{event.eyebrow}</p>
      </div>
      <p className="gn-display mt-3 text-lg font-semibold tracking-wide">
        {event.title}
      </p>
      <p
        className="gn-display mt-1.5 text-3xl font-semibold"
        style={{ color: "var(--gn-brass)" }}
      >
        {event.players.map((p, i) => (
          <span key={p.id}>
            {i > 0 && " & "}
            <PlayerLink player={p} />
          </span>
        ))}
      </p>
      <p className="gn-muted mt-2 text-sm">{event.subtitle}</p>
      {event.narrative && (
        <p className="gn-faint mt-3 text-xs italic">{event.narrative}</p>
      )}
      {event.game && (
        <Link
          to={gameDetailPath(event.game)}
          className="gn-muted mt-4 inline-block text-xs underline"
        >
          Bekijk {event.game.name}
        </Link>
      )}
    </div>
  );
}

// Finale (Game Night V7): route /game-night/geschiedenis/:sessionId/finale.
// Presenteert uitsluitend afgeleide data (gameNightFinale.ts) — schrijft
// zelf niets naar Supabase. Werkt zowel direct na het afsluiten van een
// Game Night als weken later als historische replay (sectie 33/38): de
// sessionId in de URL is de enige bron van waarheid, een refresh
// reconstrueert exact dezelfde ceremonie.
export default function GameNightFinale() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useGameNightAnalytics();
  const [screenIndex, setScreenIndex] = useState(0);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const session = data?.sessions.find((s) => s.id === sessionId);
  const detail =
    data && session ? buildGameNightDetail(data, session.id) : null;
  const funStats = data && session ? getGameNightFunStats(data, session) : [];
  const eventBundle = data && session ? buildFinaleEvents(data, session) : null;

  const gameSessionIds = useMemo(
    () => detail?.gameSessions.map((gs) => gs.gameSession.id) ?? [],
    [detail],
  );
  const { data: photos = [] } = useFinalePhotos(gameSessionIds);

  const stepIds: FinaleStepId[] =
    detail && eventBundle
      ? buildFinaleSteps({
          hasResults: detail.gameSessions.length > 0,
          hasPhotos: photos.length > 0,
          hasHeadlineEvents: eventBundle.headline.length > 0,
        })
      : [];

  const screens: Screen[] = useMemo(() => {
    if (!eventBundle) return [];
    const list: Screen[] = [];
    for (const id of stepIds) {
      if (id === "awards") {
        for (const event of eventBundle.headline) {
          list.push({ kind: "award", event });
        }
      } else {
        list.push({ kind: id } as Screen);
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIds.join(","), eventBundle]);

  const screen = screens[screenIndex];
  const isFirst = screenIndex === 0;
  const isLast = screenIndex === screens.length - 1;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="gn-faint h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 text-center">
        <p className="gn-display text-xl font-semibold">
          Deze Game Night is niet gevonden
        </p>
        <Link
          to="/game-night/geschiedenis"
          className="gn-muted mt-3 inline-block text-sm underline"
        >
          Terug naar geschiedenis
        </Link>
      </div>
    );
  }

  if (session.status !== "completed") {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 text-center">
        <p className="gn-display text-xl font-semibold">
          Deze Game Night is nog niet afgesloten
        </p>
        <p className="gn-muted mt-2 text-sm">
          De finale is pas beschikbaar zodra de avond is afgesloten.
        </p>
        <Link
          to="/game-night"
          className="gn-muted mt-3 inline-block text-sm underline"
        >
          Terug naar Game Night
        </Link>
      </div>
    );
  }

  if (!detail || !screen) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="gn-faint h-5 w-5 animate-spin" />
      </div>
    );
  }

  const date = new Date(session.started_at).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function goNext() {
    if (!isLast) setScreenIndex((i) => i + 1);
  }
  function goBack() {
    if (!isFirst) setScreenIndex((i) => i - 1);
  }
  function skipToPodium() {
    setScreenIndex(screens.length - 1);
  }

  return (
    <>
      <div className="gn-tabletop gn-tabletop-fit">
        <TopNav />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-6">
          <div
            key={screenIndex}
            className="flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4"
          >
            {screen.kind === "intro" && (
              <div className="gn-finale-reveal text-center">
                <p className="gn-eyebrow">Game Night voltooid</p>
                <h1 className="gn-display mt-2 text-2xl font-semibold sm:text-3xl">
                  {date}
                </h1>
                <p className="gn-muted mt-2 text-sm">
                  {detail.attendees.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && " · "}
                      <PlayerLink player={p} />
                    </span>
                  ))}
                </p>
                <button
                  type="button"
                  onClick={goNext}
                  className="gn-plaque-action gn-plaque-action-primary mt-6 flex min-h-[60px] w-full items-center justify-center px-6"
                >
                  <span className="gn-display text-lg font-semibold tracking-wide">
                    Bekijk de uitslag
                  </span>
                </button>
              </div>
            )}

            {screen.kind === "tonight" && (
              <div className="gn-finale-reveal w-full text-center">
                <p className="gn-eyebrow mb-4">Vanavond</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="gn-panel-elevated px-4 py-4">
                    <p className="gn-display text-2xl font-semibold">
                      {detail.totals.gamesPlayed}
                    </p>
                    <p className="gn-faint text-xs">spellen</p>
                  </div>
                  {detail.totals.roundCount > 0 && (
                    <div className="gn-panel-elevated px-4 py-4">
                      <p className="gn-display text-2xl font-semibold">
                        {detail.totals.roundCount}
                      </p>
                      <p className="gn-faint text-xs">rondes</p>
                    </div>
                  )}
                  {detail.totals.totalActiveSeconds > 0 && (
                    <div className="gn-panel-elevated px-4 py-4">
                      <p className="gn-display text-2xl font-semibold">
                        {formatDuration(detail.totals.totalActiveSeconds)}
                      </p>
                      <p className="gn-faint text-xs">speeltijd</p>
                    </div>
                  )}
                  <div className="gn-panel-elevated px-4 py-4">
                    <p className="gn-display text-2xl font-semibold">
                      {detail.attendees.length}
                    </p>
                    <p className="gn-faint text-xs">spelers</p>
                  </div>
                </div>
              </div>
            )}

            {screen.kind === "results" && (
              <div className="gn-finale-reveal w-full">
                <p className="gn-eyebrow mb-3 text-center">Spelresultaten</p>
                <div className="gn-checkpoint-scroll flex max-h-[46vh] flex-col gap-2.5">
                  {detail.gameSessions.map((gs) => (
                    <ResultLine key={gs.gameSession.id} detail={gs} />
                  ))}
                </div>
              </div>
            )}

            {screen.kind === "moments" && (
              <div className="gn-finale-reveal w-full text-center">
                <p className="gn-eyebrow mb-3">Momenten van de avond</p>
                <div className="grid grid-cols-2 gap-3">
                  {photos.map(({ gameSessionId, photo }) => (
                    <button
                      key={gameSessionId}
                      type="button"
                      onClick={() => setLightboxId(photo.id)}
                      className="gn-cover aspect-square overflow-hidden"
                    >
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{
                            background: placeholderCoverGradient(photo.id),
                          }}
                        >
                          <Camera className="h-5 w-5 text-white/60" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {screen.kind === "award" && <AwardPlaque event={screen.event} />}

            {screen.kind === "podium" && (
              <div className="gn-finale-reveal w-full text-center">
                <p className="gn-eyebrow">Game Night</p>
                <h1 className="gn-display mt-1 text-2xl font-semibold sm:text-3xl">
                  Afgesloten
                </h1>

                {funStats.length > 0 && (
                  <div className="mt-4 flex flex-col gap-1.5">
                    {funStats.slice(0, 3).map((s) => (
                      <p key={s.key} className="text-sm">
                        {s.holders.length > 0 ? (
                          <>
                            {s.holders.map((p, i) => (
                              <span key={p.id}>
                                {i > 0 && " & "}
                                <PlayerLink player={p} />
                              </span>
                            ))}{" "}
                            · {s.label.toLowerCase()} · {s.value}
                          </>
                        ) : (
                          <span className="gn-muted">
                            {s.label} · {s.value}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                )}

                {eventBundle && eventBundle.headline.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {eventBundle.headline.map((e) => (
                      <p key={e.id} className="gn-muted text-sm">
                        {e.players.map((p) => p.name).join(" & ")} · nieuwe{" "}
                        {e.title}
                      </p>
                    ))}
                  </div>
                )}

                {eventBundle && eventBundle.bundled.length > 0 && (
                  <div className="gn-panel-elevated mt-4 px-4 py-3 text-left">
                    <p className="gn-eyebrow mb-1.5">Nog meer records</p>
                    <div className="flex flex-col gap-1 text-xs">
                      {eventBundle.bundled.map((e) => (
                        <p key={e.id} className="gn-faint">
                          {e.title} · {e.players.map((p) => p.name).join(" & ")}{" "}
                          · {e.subtitle}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-2.5">
                  <Link
                    to={`/game-night/geschiedenis/${session.id}`}
                    className="gn-plaque-action gn-plaque-action-primary flex min-h-[56px] w-full items-center justify-center px-6"
                  >
                    <span className="gn-display text-sm font-semibold tracking-wide">
                      Bekijk deze avond
                    </span>
                  </Link>
                  <Link
                    to="/game-night/hall-of-fame"
                    className="gn-plaque-action flex min-h-[52px] w-full items-center justify-center px-6"
                  >
                    <span className="gn-display text-sm font-semibold tracking-wide">
                      Hall of Fame
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate("/game-night")}
                    className="gn-muted min-h-[44px] text-xs underline"
                  >
                    Terug naar Game Night
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isLast && (
            <div className="mt-2 flex w-full max-w-lg flex-col items-center gap-3">
              <div className="flex items-center gap-1.5">
                {screens.map((_, i) => (
                  <span
                    key={i}
                    className={`gn-finale-dot ${i === screenIndex ? "gn-finale-dot-active" : ""}`}
                  />
                ))}
              </div>
              <div className="flex w-full items-center gap-2.5">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isFirst}
                  className="gn-plaque-action flex min-h-[52px] flex-1 items-center justify-center px-4 disabled:opacity-30"
                >
                  <span className="gn-display text-sm font-semibold tracking-wide">
                    Terug
                  </span>
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="gn-plaque-action gn-plaque-action-primary flex min-h-[52px] flex-1 items-center justify-center px-4"
                >
                  <span className="gn-display text-sm font-semibold tracking-wide">
                    Volgende
                  </span>
                </button>
              </div>
              {screenIndex > 0 && (
                <button
                  type="button"
                  onClick={skipToPodium}
                  className="gn-faint text-xs underline"
                >
                  Naar eindoverzicht
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {lightboxId &&
        (() => {
          const lightboxPhotos = photos.map((p) => p.photo);
          return (
            <CheckpointLightbox
              photos={lightboxPhotos}
              currentId={lightboxId}
              attendees={detail.attendees}
              onNavigate={setLightboxId}
              onClose={() => setLightboxId(null)}
            />
          );
        })()}
    </>
  );
}
