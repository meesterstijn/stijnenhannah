import { Crown } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { HomepageChampion } from "@/features/game-night/lib/gameNightTitles";

// Kampioenskaart (section 9, echte data sinds Game Night V5 sectie 27/28)
// — licht gekanteld fysiek object met een eigen slagschaduw op het hout
// (.gn-plaque-tilt), geen gewone dashboardcard. `champion` komt uit
// buildHomepageChampion (deterministische prioriteit, nooit willekeurig
// wisselend) — `null` zolang er nog geen enkele titel/record is toegekend.
// Tikken/klikken linkt door naar het spelerprofiel (sectie 28).
export function ChampionPlaque({
  champion,
}: {
  champion: HomepageChampion | null;
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5">
        <Crown className="h-3.5 w-3.5" style={{ color: "var(--gn-brass)" }} />
        <p className="gn-eyebrow">Huidige kampioen</p>
      </div>
      {champion ? (
        <>
          <p
            className="gn-display mt-2 text-3xl font-semibold sm:text-4xl"
            style={{ color: "var(--gn-brass)" }}
          >
            {champion.player.name}
          </p>
          <p className="gn-muted mt-2 text-sm">{champion.titleLabel}</p>
          <p className="gn-faint mt-2.5 text-xs">{champion.detailLine}</p>
        </>
      ) : (
        <p className="gn-faint mt-3 text-sm italic">
          Nog geen kampioen — speel een paar Game Nights.
        </p>
      )}
    </>
  );

  const className =
    "gn-plaque gn-plaque-tilt block w-full px-5 py-5 sm:px-6 sm:py-6";
  const style = { "--gn-tilt": "-5.5deg" } as CSSProperties;

  if (champion) {
    return (
      <Link
        to={`/game-night/spelers/${champion.player.id}`}
        className={className}
        style={style}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={className} style={style}>
      {content}
    </div>
  );
}
