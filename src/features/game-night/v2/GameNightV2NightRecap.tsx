import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { GameNightSession } from "@/lib/supabase";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { useGameNightColorPalette } from "@/features/game-night/hooks/useGameNightMemberProfile";
import { buildGameNightDetail } from "@/features/game-night/lib/gameNightStats";
import {
  buildNightMvp,
  buildNightRecapHighlights,
} from "@/features/game-night/lib/gameNightCompetitiveMoments";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import { formatDuration } from "@/features/game-night/lib/gameTimer";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { PartyContextStrip } from "@/features/game-night/v2/PartyContextStrip";

// Game Night V2.7C (sectie 3/4) — de afsluiting van de VOLLEDIGE avond,
// iets anders dan GameNightV2GameRecap (dat is het resultaat van één
// spel). Vervangt de oude route-navigatie naar de houten finale-ceremonie
// (/game-night/geschiedenis/:sessionId/finale) als het DIRECTE resultaat
// van "Game Night afsluiten" — die finale-route zelf blijft ongewijzigd
// bestaan voor historische replay vanuit Geschiedenis (sectie 8: genuine
// legacy-gebruik, geen caller hier verwijderd).
//
// Uitsluitend bestaande data: buildGameNightDetail (dezelfde functie als de
// finale-pagina) + de canonieke WinRecord-laag (buildNightMvp/
// buildNightRecapHighlights) — geen nieuwe databasevelden, geen verzonnen
// statistieken.
export function GameNightV2NightRecap({
  session,
  onNewGameNight,
}: {
  session: GameNightSession;
  onNewGameNight: () => void;
}) {
  const { data: analyticsData } = useGameNightAnalytics();
  const { data: palette = [] } = useGameNightColorPalette();

  const detail = useMemo(
    () =>
      analyticsData ? buildGameNightDetail(analyticsData, session.id) : null,
    [analyticsData, session.id],
  );

  const mvp = useMemo(() => {
    if (!analyticsData || !detail) return null;
    return buildNightMvp(
      analyticsData,
      detail.gameSessions.map((gs) => gs.gameSession.id),
    );
  }, [analyticsData, detail]);

  const highlights = useMemo(() => {
    if (!detail) return [];
    return buildNightRecapHighlights(
      detail.gameSessions.map((gs) => ({
        gameName: gs.game.name,
        durationSeconds: gs.durationSeconds,
      })),
      detail.attendees.length,
    );
  }, [detail]);

  const gameNames = detail
    ? [...new Set(detail.gameSessions.map((gs) => gs.game.name))]
    : [];

  const dateLabel = new Date(session.started_at)
    .toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();

  return (
    <GnV2Scene className="gnv2-nightrecap-scene">
      <div className="gnv2-nightrecap-root">
        <p className="gnv2-recap-eyebrow">Game Night voltooid</p>
        <p className="gnv2-nightrecap-date">{dateLabel}</p>
        <p className="gnv2-nightrecap-tagline">
          Dat was &apos;m voor vanavond.
        </p>

        {detail && detail.attendees.length > 0 && (
          <PartyContextStrip players={detail.attendees} palette={palette} />
        )}

        {detail && (
          <div className="gnv2-nightrecap-stats">
            <div className="gnv2-nightrecap-stat">
              <p>{detail.totals.gamesPlayed}</p>
              <p>spellen</p>
            </div>
            <div className="gnv2-nightrecap-stat">
              <p>{detail.attendees.length}</p>
              <p>spelers</p>
            </div>
            {detail.totals.totalActiveSeconds > 0 && (
              <div className="gnv2-nightrecap-stat">
                <p>{formatDuration(detail.totals.totalActiveSeconds)}</p>
                <p>speeltijd</p>
              </div>
            )}
          </div>
        )}

        {mvp && (
          <p className="gnv2-nightrecap-mvp">
            {getPlayerDisplayName(mvp.player)} pakte vanavond de meeste WINs ·{" "}
            {mvp.wins}
          </p>
        )}

        {gameNames.length > 0 && (
          <p className="gnv2-nightrecap-games">{gameNames.join(" · ")}</p>
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
            onClick={onNewGameNight}
            className="gnv2-btn gnv2-btn-primary gnv2-recap-action"
          >
            Nieuwe Game Night
          </button>
          <Link
            to={`/game-night/geschiedenis/${session.id}`}
            className="gnv2-btn gnv2-btn-ghost gnv2-recap-action"
          >
            Bekijk geschiedenis
          </Link>
          <Link to="/game-night/hall-of-fame" className="gnv2-recap-close-link">
            Hall of Fame
          </Link>
        </div>
      </div>
    </GnV2Scene>
  );
}
