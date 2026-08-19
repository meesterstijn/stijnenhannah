import type { CompetitiveMoment } from "@/features/game-night/lib/gameNightCompetitiveMoments";

// Game Night V2.7B (sectie 12/13) — de contextuele boodschap ná een nieuwe
// WIN. Verschijnt kort, verdwijnt vanzelf (zie GameNightV2Arena voor de
// timer) — geen permanent statsdashboard, gewoon één zin op het juiste
// moment.
export function GameArenaMomentBanner({
  moment,
}: {
  moment: CompetitiveMoment;
}) {
  return (
    <div
      className={`gnv2-moment-banner gnv2-moment-banner-${moment.type}`}
      role="status"
    >
      <p className="gnv2-moment-headline">{moment.headline}</p>
      {moment.subtitle && (
        <p className="gnv2-moment-subtitle">{moment.subtitle}</p>
      )}
    </div>
  );
}
