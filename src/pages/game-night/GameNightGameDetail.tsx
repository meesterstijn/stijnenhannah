import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Images, Settings, Skull, Trophy } from "lucide-react";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { useActiveGameNightSession } from "@/features/game-night/hooks/useGameNightSession";
import { useActivePartyPlayers } from "@/features/game-night/hooks/useGameNightParty";
import { useLatestGameSession } from "@/features/game-night/hooks/useGameSession";
import { useCheckpointCountsForGameSessions } from "@/features/game-night/hooks/useCheckpoints";
import {
  collectPlayerGameMetrics,
  findGameBySlugOrId,
  getBiggestRivalry,
  getGameParticipation,
  getGameRecords,
  getGameRivalries,
  getGameRoundLeaderboard,
  getGameSessionLeaderboard,
  getGameStats,
  getRecentGameSessions,
  type AnalyticsData,
  type GameLeaderboardEntry,
  type GameRecords,
  type GameRivalry,
} from "@/features/game-night/lib/gameNightStats";
import {
  buildGameAwards,
  GAME_AWARD_CONFIGS,
} from "@/features/game-night/lib/gameNightTitles";
import { gameTagLabel } from "@/features/game-night/lib/gameTags";
import { formatDuration } from "@/features/game-night/lib/gameTimer";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";
import { PlayerLink } from "@/features/game-night/components/PlayerLink";
import { GameParticipantSheet } from "@/features/game-night/components/GameParticipantSheet";
import { GameFlowSettingsSheet } from "@/features/game-night/components/GameFlowSettingsSheet";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";
import type { GameDifficulty, GameNightGame } from "@/lib/supabase";

const DIFFICULTY_LABEL: Record<GameDifficulty, string> = {
  licht: "Licht",
  gemiddeld: "Gemiddeld",
  zwaar: "Zwaar",
};

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="gnv2-stat-block">
      <p className="gnv2-display text-xl font-semibold">{value}</p>
      <p className="gnv2-faint mt-0.5 text-xs">{label}</p>
    </div>
  );
}

function RankedLeaderboard({
  title,
  entries,
  unit,
}: {
  title: string;
  entries: GameLeaderboardEntry[];
  unit: string;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="gnv2-panel-elevated px-5 py-4">
      <p className="gnv2-eyebrow mb-2.5">{title}</p>
      <div className="flex flex-col gap-2">
        {entries.map((e, i) => (
          <div
            key={e.player.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="gnv2-faint w-4 shrink-0 text-right">
                {i + 1}.
              </span>
              <PlayerLink player={e.player} />
            </span>
            <span className="gnv2-muted shrink-0 text-xs">
              {e.wins} {unit} · {e.denominator} gespeeld · {e.winratePct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RivalryHeadline({ rivalry }: { rivalry: GameRivalry }) {
  const hasSessionData = rivalry.sessionsWithResult > 0;
  const hasRoundData = rivalry.sharedRounds > 0;

  return (
    <div className="gnv2-panel-elevated px-5 py-5">
      <p className="gnv2-eyebrow mb-3 text-center">Grootste rivaliteit</p>
      <div className="flex items-center justify-center gap-3">
        <div className="flex-1 text-center">
          <p className="gnv2-display text-lg font-semibold tracking-wide">
            <PlayerLink player={rivalry.playerA} />
          </p>
        </div>
        <span className="gnv2-vs-badge">VS</span>
        <div className="flex-1 text-center">
          <p className="gnv2-display text-lg font-semibold tracking-wide">
            <PlayerLink player={rivalry.playerB} />
          </p>
        </div>
      </div>
      <p className="gnv2-muted mt-3 text-center text-xs">
        {rivalry.sharedSessions} keer samen gespeeld
        {rivalry.sessionsWithoutResult > 0 &&
          ` · geen resultaat: ${rivalry.sessionsWithoutResult}`}
      </p>
      {hasSessionData && (
        <p className="mt-2 text-center text-sm font-semibold">
          {rivalry.sessionWinsA === rivalry.sessionWinsB
            ? `Volledig gelijk in session wins: ${rivalry.sessionWinsA}–${rivalry.sessionWinsB}`
            : rivalry.sessionWinsA > rivalry.sessionWinsB
              ? `${rivalry.playerA.name} leidt met ${rivalry.sessionWinsA}–${rivalry.sessionWinsB}`
              : `${rivalry.playerB.name} leidt met ${rivalry.sessionWinsB}–${rivalry.sessionWinsA}`}
        </p>
      )}
      {hasRoundData && (
        <p className="gnv2-muted mt-1 text-center text-xs">
          {rivalry.roundWinsA === rivalry.roundWinsB
            ? `Gelijk in rondewinsten: ${rivalry.roundWinsA}–${rivalry.roundWinsB}`
            : rivalry.roundWinsA > rivalry.roundWinsB
              ? `${rivalry.playerA.name} heeft de meeste rondewinsten: ${rivalry.roundWinsA}–${rivalry.roundWinsB}`
              : `${rivalry.playerB.name} heeft de meeste rondewinsten: ${rivalry.roundWinsB}–${rivalry.roundWinsA}`}
        </p>
      )}
      {/* V2.2 (sectie 21): canonieke totaaltelling — blijft correct
          vergelijken zodra deze rivaliteit overstapt op win_events, waar
          roundWinsA/B hierboven dan niet meer in meegroeit. */}
      {(rivalry.winsA > 0 || rivalry.winsB > 0) && (
        <p className="gnv2-muted mt-1 text-center text-xs">
          {rivalry.winsA === rivalry.winsB
            ? `Gelijk in totaal aantal overwinningen: ${rivalry.winsA}–${rivalry.winsB}`
            : rivalry.winsA > rivalry.winsB
              ? `${rivalry.playerA.name} heeft de meeste overwinningen in totaal: ${rivalry.winsA}–${rivalry.winsB}`
              : `${rivalry.playerB.name} heeft de meeste overwinningen in totaal: ${rivalry.winsB}–${rivalry.winsA}`}
        </p>
      )}
    </div>
  );
}

// Hergebruikt exact buildGameAwards (dezelfde functie als Hall of Fame) en
// filtert 'm tot dit ene spel — nooit een tweede/afwijkende winnaar
// uitrekenen (sectie 6/9 V6). Onder de minimumdrempel toont dit de
// werkelijke voortgang van de best-scorende speler t.o.v. die drempel
// (sectie 8), berekend uit dezelfde collectPlayerGameMetrics die de
// awardlogica zelf ook gebruikt.
function SpecialistPlaque({
  game,
  data,
}: {
  game: GameNightGame;
  data: AnalyticsData;
}) {
  const award = buildGameAwards(data).find((a) => a.config.slug === game.slug);
  if (!award) return null;
  const Icon = game.slug === "skull" ? Skull : Trophy;

  let progressText: string | null = null;
  if (award.holders.length === 0) {
    const metrics = [...collectPlayerGameMetrics(data, game.id).values()];
    // V2.2: uniforme canonieke drempel i.p.v. round_wins/session_wins-tak.
    const threshold = award.config.minOpportunities;
    const best = Math.max(0, ...metrics.map((m) => m.canonicalOpportunities));
    progressText = `${Math.min(best, threshold)} / ${threshold} keer gespeeld`;
  }

  return (
    <div className="gnv2-award-plaque">
      <div className="flex items-center justify-center gap-1.5">
        <Icon
          className="h-4 w-4"
          style={{ color: "var(--gnv2-accent-warm-strong)" }}
        />
        <p className="gnv2-eyebrow">Regerend specialist</p>
      </div>
      {award.holders.length === 0 ? (
        <>
          <p className="gnv2-display mt-2 text-lg font-semibold tracking-wide">
            {award.config.title}
          </p>
          <p className="gnv2-faint mt-1.5 text-sm italic">
            Nog niet uitgereikt
          </p>
          <p className="gnv2-faint mt-1 text-xs">{progressText}</p>
        </>
      ) : (
        <>
          {award.holders.length > 1 && (
            <p className="gnv2-eyebrow mt-2">Gedeelde {award.config.title}s</p>
          )}
          <p
            className="gnv2-display mt-1.5 text-2xl font-semibold"
            style={{ color: "var(--gnv2-accent-warm-strong)" }}
          >
            {award.holders.map((h, i) => (
              <span key={h.id}>
                {i > 0 && " & "}
                <PlayerLink player={h} />
              </span>
            ))}
          </p>
          <p className="gnv2-muted mt-1 text-sm">{award.config.title}</p>
          <p className="gnv2-faint mt-1 text-xs">
            {award.metricValue} overwinningen
          </p>
        </>
      )}
    </div>
  );
}

function RecordsSection({ records }: { records: GameRecords }) {
  const rows: {
    label: string;
    entries: GameRecords["mostSessionWins"] | null;
    value?: string;
  }[] = [];

  if (records.mostSessionWins.entries.length > 0)
    rows.push({
      label: "Meeste session wins",
      entries: records.mostSessionWins,
    });
  if (records.mostRoundWins.entries.length > 0)
    rows.push({ label: "Meeste round wins", entries: records.mostRoundWins });
  if (records.mostSessionsPlayed.entries.length > 0)
    rows.push({
      label: "Meeste sessions gespeeld",
      entries: records.mostSessionsPlayed,
    });
  if (records.mostRematches.entries.length > 0)
    rows.push({
      label: "Meeste directe rematches",
      entries: records.mostRematches,
    });

  const extraRows: { label: string; value: string }[] = [];
  if (records.longestSessionSeconds != null)
    extraRows.push({
      label: "Langste geregistreerde session",
      value: formatDuration(records.longestSessionSeconds),
    });
  if (records.shortestSessionSeconds != null)
    extraRows.push({
      label: "Kortste voltooide session",
      value: formatDuration(records.shortestSessionSeconds),
    });

  if (rows.length === 0 && extraRows.length === 0 && !records.scoreRecord)
    return null;

  return (
    <div className="gnv2-panel-elevated px-5 py-4">
      <p className="gnv2-eyebrow mb-2.5">Records</p>
      <div className="flex flex-col gap-2">
        {rows.map(
          (row) =>
            row.entries && (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="gnv2-muted text-xs">{row.label}</span>
                <span className="font-semibold">
                  {row.entries.entries.map((e, i) => (
                    <span key={e.player.id}>
                      {i > 0 && " & "}
                      <PlayerLink player={e.player} />
                    </span>
                  ))}{" "}
                  · {row.entries.entries[0].value}
                </span>
              </div>
            ),
        )}
        {records.scoreRecord && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="gnv2-muted text-xs">Hoogste score ooit</span>
            <span className="font-semibold">
              <PlayerLink player={records.scoreRecord.player} /> ·{" "}
              {records.scoreRecord.score} punten
            </span>
          </div>
        )}
        {extraRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="gnv2-muted text-xs">{row.label}</span>
            <span className="font-semibold">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Speldetail (Game Night V6): route /game-night/spellen/:gameSlug. Bouwt
// uitsluitend voort op de V5 AnalyticsData + de nieuwe per-spel functies in
// gameNightStats.ts — geen tweede analytics-systeem, geen eigen queries
// (useGameNightAnalytics is dezelfde gecachete call als elke andere Game
// Night-pagina).
//
// Visuele consistentieronde (legacy .gn-*-migratie): titel/cover/spelers-
// aantal/uitleg/startactie zijn nu één GnV2Scene-hero, de primaire CTA
// ("Dit spel spelen") is een gnv2-btn-primary — puur presentationeel, geen
// enkele query/mutatie/route gewijzigd.
export default function GameNightGameDetail() {
  const { gameSlug } = useParams<{ gameSlug: string }>();
  const { data, isLoading } = useGameNightAnalytics();
  const { data: activeGameNight } = useActiveGameNightSession();
  // Sectie 26 (V2.4): alleen spelers die NU actief aan tafel zitten.
  const { data: attendees = [] } = useActivePartyPlayers(activeGameNight?.id);
  const { data: latestGameSession } = useLatestGameSession(activeGameNight?.id);

  const [pickingGame, setPickingGame] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  const game = data && gameSlug ? findGameBySlugOrId(data, gameSlug) : null;
  const stats = data && game ? getGameStats(data, game.id) : null;

  const roundLeaderboard =
    data && game ? getGameRoundLeaderboard(data, game.id) : [];
  const sessionLeaderboard =
    data && game ? getGameSessionLeaderboard(data, game.id) : [];
  const participation = data && game ? getGameParticipation(data, game.id) : [];
  const records = data && game ? getGameRecords(data, game.id) : null;
  const rivalries = data && game ? getGameRivalries(data, game.id) : [];
  const biggestRivalry = data && game ? getBiggestRivalry(data, game.id) : null;

  const [showAllSessions, setShowAllSessions] = useState(false);
  const recentSessions =
    data && game
      ? getRecentGameSessions(data, game.id, showAllSessions ? undefined : 5)
      : [];
  const totalSessionsForList =
    data && game ? (getGameStats(data, game.id)?.sessionsPlayed ?? 0) : 0;

  const { data: checkpointCounts } = useCheckpointCountsForGameSessions(
    recentSessions.map((s) => s.gameSession.id),
  );

  const award =
    game?.slug != null
      ? GAME_AWARD_CONFIGS.find((c) => c.slug === game.slug)
      : undefined;

  const coverUrl = game?.cover_storage_path
    ? getGameCoverUrl(game.cover_storage_path)
    : null;

  const openGameSession =
    latestGameSession && latestGameSession.status !== "completed"
      ? latestGameSession
      : null;

  const playersRangeLabel = (() => {
    if (!game) return null;
    const { min_players, max_players } = game;
    if (min_players && max_players && min_players !== max_players)
      return `${min_players}–${max_players} spelers`;
    if (min_players || max_players)
      return `${min_players ?? max_players} spelers`;
    return null;
  })();

  if (isLoading) return <GnV2Loading />;

  return (
    <GnV2Scene className="gnv2-game-detail-scene">
      <header className="gnv2-topbar">
        <Link
          to="/game-night/spellen"
          className="gnv2-nav-btn"
          aria-label="Terug naar Spellenkast"
          title="Terug"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="gnv2-identity gnv2-identity-center">
          <p className="gnv2-identity-eyebrow">Game Night</p>
          <p className="gnv2-identity-date">Speldetail</p>
        </div>
        <div className="gnv2-topbar-spacer" aria-hidden />
      </header>

      <main className="gnv2-content-main">
        {!game || !stats ? (
          <div className="gnv2-panel-elevated px-6 py-10 text-center">
            <p className="gnv2-display text-xl font-semibold">
              Spel niet gevonden
            </p>
            <p className="gnv2-muted mt-2 text-sm">
              Dit spel bestaat niet (meer) in de spellenkast.
            </p>
          </div>
        ) : (
          <>
            {/* ── Header: titel/cover/uitleg/CTA als één visueel geheel ──── */}
            <div className="gnv2-panel-elevated flex flex-col gap-4 px-5 py-5 sm:flex-row">
              <div className="gnv2-cover mx-auto h-40 w-32 shrink-0 sm:mx-0">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-end p-3"
                    style={{ background: placeholderCoverGradient(game.id) }}
                    aria-hidden
                  >
                    <span className="gnv2-display text-3xl font-semibold text-white/75">
                      {game.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <h1 className="gnv2-display text-2xl font-semibold sm:text-3xl">
                  {game.name.toUpperCase()}
                </h1>
                {game.archived_at && (
                  <p className="gnv2-faint mt-1 text-xs">
                    Niet meer in actieve spellenkast
                  </p>
                )}
                <p className="gnv2-muted mt-1.5 text-sm">
                  {[
                    playersRangeLabel,
                    game.duration_minutes
                      ? `±${game.duration_minutes} min`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {game.difficulty && (
                  <p className="gnv2-faint mt-1 text-xs">
                    Moeilijkheid: {DIFFICULTY_LABEL[game.difficulty]}
                  </p>
                )}
                {game.tags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                    {game.tags.map((tag) => (
                      <span key={tag} className="gnv2-chip">
                        {gameTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                )}
                {stats.sessionsPlayed > 0 && (
                  <p className="gnv2-eyebrow mt-3">
                    {stats.sessionsPlayed}× gespeeld
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setConfiguring(true)}
                  className="gnv2-muted mt-3 inline-flex items-center gap-1.5 text-xs underline"
                >
                  <Settings className="h-3 w-3" /> Spel bewerken
                </button>
              </div>
            </div>

            {/* ── Startactie — de primaire CTA moet direct herkenbaar zijn ── */}
            {!game.archived_at && (
              <div className="gnv2-panel-elevated px-5 py-4 text-center">
                {openGameSession ? (
                  <p className="gnv2-muted text-sm">
                    Er wordt nu {openGameSession.game.name} gespeeld
                  </p>
                ) : activeGameNight ? (
                  <button
                    type="button"
                    onClick={() => setPickingGame(true)}
                    className="gnv2-btn gnv2-btn-primary mx-auto w-full max-w-xs"
                  >
                    Dit spel spelen
                  </button>
                ) : (
                  <Link
                    to="/game-night"
                    className="gnv2-muted text-sm underline"
                  >
                    Start eerst een Game Night
                  </Link>
                )}
              </div>
            )}

            {stats.sessionsPlayed === 0 ? (
              <div className="gnv2-panel-elevated px-6 py-10 text-center">
                <p className="gnv2-display text-xl font-semibold">
                  Dit verhaal moet nog beginnen
                </p>
                <p className="gnv2-muted mt-2 text-sm">
                  Nog geen partijen gespeeld.
                </p>
              </div>
            ) : (
              <>
                {/* ── Hoofdstatistieken ────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatBlock
                    label={stats.sessionsPlayed === 1 ? "session" : "sessions"}
                    value={String(stats.sessionsPlayed)}
                  />
                  {stats.roundsPlayed > 0 && (
                    <StatBlock
                      label="rondes"
                      value={String(stats.roundsPlayed)}
                    />
                  )}
                  {stats.averageActiveDurationSeconds != null && (
                    <StatBlock
                      label="gem. speelduur"
                      value={formatDuration(stats.averageActiveDurationSeconds)}
                    />
                  )}
                  {stats.lastPlayedAt && (
                    <StatBlock
                      label="laatst gespeeld"
                      value={new Date(stats.lastPlayedAt).toLocaleDateString(
                        "nl-NL",
                        { day: "numeric", month: "long" },
                      )}
                    />
                  )}
                </div>

                {/* ── Regerend specialist ──────────────────────────────── */}
                {award && data && <SpecialistPlaque game={game} data={data} />}

                {/* ── Klassement ───────────────────────────────────────── */}
                {roundLeaderboard.length > 0 ? (
                  <>
                    <RankedLeaderboard
                      title="Klassement"
                      entries={roundLeaderboard}
                      unit="rondewinsten"
                    />
                    {sessionLeaderboard.length > 0 && (
                      <RankedLeaderboard
                        title="Spelwinsten"
                        entries={sessionLeaderboard}
                        unit="session wins"
                      />
                    )}
                  </>
                ) : (
                  sessionLeaderboard.length > 0 && (
                    <RankedLeaderboard
                      title="Klassement"
                      entries={sessionLeaderboard}
                      unit="gewonnen"
                    />
                  )
                )}

                {/* ── Deelname ─────────────────────────────────────────── */}
                {participation.length > 0 && (
                  <div className="gnv2-panel-elevated px-5 py-4">
                    <p className="gnv2-eyebrow mb-2.5">Meest gespeeld</p>
                    <div className="flex flex-col gap-1.5">
                      {participation.map((p) => (
                        <div
                          key={p.player.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <PlayerLink player={p.player} />
                          <span className="gnv2-muted text-xs">
                            {p.sessionsPlayed}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Rivaliteit ───────────────────────────────────────── */}
                {biggestRivalry && (
                  <div className="space-y-3">
                    <RivalryHeadline rivalry={biggestRivalry} />
                    {rivalries.length > 1 && (
                      <div className="gnv2-panel-elevated px-5 py-4">
                        <p className="gnv2-eyebrow mb-2">Andere rivaliteiten</p>
                        <div className="flex flex-col gap-1.5 text-xs">
                          {rivalries.slice(1).map((r) => (
                            <p key={`${r.playerA.id}-${r.playerB.id}`}>
                              <PlayerLink player={r.playerA} /> vs{" "}
                              <PlayerLink player={r.playerB} /> ·{" "}
                              {r.sharedSessions} samen gespeeld
                              {r.sessionsWithResult > 0 &&
                                ` · ${r.sessionWinsA}–${r.sessionWinsB}`}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Records ──────────────────────────────────────────── */}
                {records && <RecordsSection records={records} />}

                {/* ── Recent gespeeld ────────────────────────────────────── */}
                <div className="gnv2-content-list">
                  <p className="gnv2-eyebrow">Recent gespeeld</p>
                  {recentSessions.map((s) => (
                    <Link
                      key={s.gameSession.id}
                      to={`/game-night/geschiedenis/${s.gameNightSession.id}`}
                      className="gnv2-list-row flex-col items-start"
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          {new Date(
                            s.gameSession.started_at,
                          ).toLocaleDateString("nl-NL", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        {checkpointCounts?.get(s.gameSession.id) && (
                          <span className="gnv2-faint inline-flex items-center gap-1 text-[11px]">
                            <Images className="h-3 w-3" />
                            {checkpointCounts.get(s.gameSession.id)}
                          </span>
                        )}
                      </div>
                      <p className="gnv2-muted mt-0.5 text-xs">
                        {s.participants.map((p) => p.name).join(" · ")}
                      </p>
                      <p className="gnv2-faint mt-1 text-xs">
                        {s.durationSeconds != null &&
                          `${formatDuration(s.durationSeconds)} · `}
                        {s.roundCount > 0 && `${s.roundCount} rondes · `}
                        {s.winner
                          ? `Winnaar: ${s.winner.name}`
                          : s.hasResult
                            ? ""
                            : "Geen eindwinnaar geregistreerd"}
                      </p>
                    </Link>
                  ))}
                  {!showAllSessions && totalSessionsForList > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllSessions(true)}
                      className="gnv2-btn gnv2-btn-ghost w-full"
                    >
                      Bekijk alle partijen
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {pickingGame && activeGameNight && game && (
        <GameParticipantSheet
          game={game}
          attendees={attendees}
          gameNightSessionId={activeGameNight.id}
          onClose={() => setPickingGame(false)}
        />
      )}

      {configuring && game && (
        <GameFlowSettingsSheet
          game={game}
          onClose={() => setConfiguring(false)}
        />
      )}
    </GnV2Scene>
  );
}
