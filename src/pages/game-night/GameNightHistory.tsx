import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import {
  buildGameNightDetail,
  buildGameNightSummaries,
  type GameNightGameSessionDetail,
  type GameNightSummary,
} from "@/features/game-night/lib/gameNightStats";
import { formatDuration } from "@/features/game-night/lib/gameTimer";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";

type HistoryTab = "nights" | "sessions" | "finales";

function nightDateLabel(iso: string) {
  return new Date(iso)
    .toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

function NightCard({ summary }: { summary: GameNightSummary }) {
  return (
    <div className="gnv2-content-card">
      <div className="gnv2-content-card-top">
        <div className="min-w-0">
          <p className="gnv2-content-card-date">
            {nightDateLabel(summary.session.started_at)}
          </p>
          <p className="gnv2-content-card-title truncate">
            {summary.session.name}
          </p>
        </div>
        {summary.isActive && (
          <span className="gnv2-content-card-badge">Bezig</span>
        )}
      </div>

      {summary.attendees.length > 0 && (
        <p className="gnv2-content-card-players">
          {summary.attendees.map((p) => getPlayerDisplayName(p)).join(" · ")}
        </p>
      )}

      <p className="gnv2-content-card-meta">
        {summary.gameSessionCount}{" "}
        {summary.gameSessionCount === 1 ? "spel" : "spellen"}
        {` · ${summary.attendees.length} ${summary.attendees.length === 1 ? "speler" : "spelers"}`}
        {summary.totalActiveSeconds > 0 &&
          ` · ${formatDuration(summary.totalActiveSeconds)}`}
      </p>

      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <Link
          to={`/game-night/geschiedenis/${summary.session.id}`}
          className="gnv2-content-card-link"
        >
          Bekijk avond
        </Link>
        {summary.session.status === "completed" && (
          <Link
            to={`/game-night/geschiedenis/${summary.session.id}/finale`}
            className="gnv2-content-card-link"
          >
            Bekijk finale opnieuw
          </Link>
        )}
      </div>
    </div>
  );
}

function SessionCard({
  night,
  detail,
}: {
  night: GameNightSummary;
  detail: GameNightGameSessionDetail;
}) {
  const winner = detail.results.find((r) => r.isWinner);
  return (
    <div className="gnv2-content-card">
      <div className="gnv2-content-card-top">
        <div className="min-w-0">
          <p className="gnv2-content-card-date">
            {nightDateLabel(detail.gameSession.started_at)}
          </p>
          <p className="gnv2-content-card-title truncate">{detail.game.name}</p>
        </div>
      </div>

      {detail.participants.length > 0 && (
        <p className="gnv2-content-card-players">
          {detail.participants.map((p) => getPlayerDisplayName(p)).join(" · ")}
        </p>
      )}

      {(detail.durationSeconds != null || winner) && (
        <p className="gnv2-content-card-meta">
          {detail.durationSeconds != null &&
            formatDuration(detail.durationSeconds)}
          {detail.durationSeconds != null && winner && " · "}
          {winner && `Winnaar: ${getPlayerDisplayName(winner.player)}`}
        </p>
      )}

      <Link
        to={`/game-night/geschiedenis/${night.session.id}`}
        className="gnv2-content-card-link"
      >
        Bekijk avond
      </Link>
    </div>
  );
}

// Game Night V2.7D (sectie 5/6) — vervangt de houten Geschiedenis-lijst
// door dezelfde GNV2-wereld als Lobby/Game Select/Arena (GnV2Scene). Drie
// tabs i.p.v. één platte lijst, uitsluitend samengesteld uit bestaande,
// al-geteste stats-helpers (buildGameNightSummaries/buildGameNightDetail)
// — geen nieuwe database-query's, geen verzonnen cijfers. De detailpagina
// (per avond) en de finale-ceremonie blijven bewust ongewijzigd bereikbaar
// (sectie 7/8) — alleen dit overzicht wordt vervangen.
export default function GameNightHistory() {
  const { data, isLoading } = useGameNightAnalytics();
  const [tab, setTab] = useState<HistoryTab>("nights");

  const nights = useMemo(
    () => (data ? buildGameNightSummaries(data) : []),
    [data],
  );

  const sessions = useMemo(() => {
    if (!data) return [];
    const rows: {
      night: GameNightSummary;
      detail: GameNightGameSessionDetail;
    }[] = [];
    for (const night of nights) {
      const detail = buildGameNightDetail(data, night.session.id);
      if (!detail) continue;
      for (const gs of detail.gameSessions) rows.push({ night, detail: gs });
    }
    return rows.sort(
      (a, b) =>
        new Date(b.detail.gameSession.started_at).getTime() -
        new Date(a.detail.gameSession.started_at).getTime(),
    );
  }, [data, nights]);

  const finales = useMemo(
    () => nights.filter((n) => n.session.status === "completed"),
    [nights],
  );

  if (isLoading) return <GnV2Loading />;

  return (
    <GnV2Scene className="gnv2-history-scene">
      <header className="gnv2-topbar">
        <Link
          to="/game-night"
          className="gnv2-nav-btn"
          aria-label="Terug naar Game Night"
          title="Terug"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="gnv2-identity gnv2-identity-center">
          <p className="gnv2-identity-eyebrow">Game Night</p>
          <p className="gnv2-identity-date">Geschiedenis</p>
        </div>
        <div className="gnv2-topbar-spacer" aria-hidden />
      </header>

      <main className="gnv2-content-main">
        <div className="gnv2-content-intro">
          <h1 className="gnv2-content-heading">Geschiedenis</h1>
          <p className="gnv2-content-sub">
            Game Nights &amp; sessies — {nights.length}{" "}
            {nights.length === 1 ? "avond" : "avonden"} gespeeld.
          </p>
        </div>

        <div
          className="gnv2-segmented"
          role="tablist"
          aria-label="Geschiedenis"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "nights"}
            onClick={() => setTab("nights")}
            className={`gnv2-segmented-btn ${tab === "nights" ? "gnv2-segmented-btn-active" : ""}`}
          >
            Alle avonden
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sessions"}
            onClick={() => setTab("sessions")}
            className={`gnv2-segmented-btn ${tab === "sessions" ? "gnv2-segmented-btn-active" : ""}`}
          >
            Spelsessies
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "finales"}
            onClick={() => setTab("finales")}
            className={`gnv2-segmented-btn ${tab === "finales" ? "gnv2-segmented-btn-active" : ""}`}
          >
            Finales
          </button>
        </div>

        {tab === "nights" &&
          (nights.length === 0 ? (
            <p className="gnv2-content-empty">Nog geen Game Nights gespeeld.</p>
          ) : (
            <div className="gnv2-content-list">
              {nights.map((n) => (
                <NightCard key={n.session.id} summary={n} />
              ))}
            </div>
          ))}

        {tab === "sessions" &&
          (sessions.length === 0 ? (
            <p className="gnv2-content-empty">Nog geen spellen gespeeld.</p>
          ) : (
            <div className="gnv2-content-list">
              {sessions.map((row) => (
                <SessionCard
                  key={row.detail.gameSession.id}
                  night={row.night}
                  detail={row.detail}
                />
              ))}
            </div>
          ))}

        {tab === "finales" &&
          (finales.length === 0 ? (
            <p className="gnv2-content-empty">
              Nog geen afgeronde Game Night met finale.
            </p>
          ) : (
            <div className="gnv2-content-list">
              {finales.map((n) => (
                <NightCard key={n.session.id} summary={n} />
              ))}
            </div>
          ))}
      </main>
    </GnV2Scene>
  );
}
