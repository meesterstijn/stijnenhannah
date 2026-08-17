import { Link } from "react-router-dom";
import type { MockRecentSession } from "@/features/game-night/lib/mockData";
import { formatRelativeDate } from "@/features/game-night/lib/formatRelative";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";

// Onderpaneel "Recent gespeeld" (section 11) — compacte mini-covers i.p.v.
// een lange lijst, zodat dit paneel naast Statistieken/Hall of Fame past
// zonder de tablet-compositie te laten scrollen. Covers zijn placeholders
// (geen sessie-tabel/echte covers nog, zie mockData.ts) maar in dezelfde
// visuele taal als GameCard's placeholder.
export function RecentlyPlayedSection({
  sessions,
}: {
  sessions: MockRecentSession[];
}) {
  return (
    <div className="gn-panel-info flex h-full flex-col px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="gn-eyebrow">Recent gespeeld</p>
        <Link
          to="/game-night/geschiedenis"
          className="gn-faint text-[11px] hover:text-[var(--gn-brass)]"
        >
          Bekijk alles
        </Link>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2.5">
        {sessions.slice(0, 3).map((session) => (
          <div key={session.id} className="flex min-w-0 flex-col gap-1">
            <div
              className="gn-cover flex aspect-square w-full items-center justify-center"
              style={{ background: placeholderCoverGradient(session.gameName) }}
            >
              <span className="gn-display text-lg font-semibold text-white/75">
                {session.gameName.charAt(0)}
              </span>
            </div>
            <p className="truncate text-xs font-semibold">{session.gameName}</p>
            <p className="gn-faint truncate text-[10px]">
              {formatRelativeDate(session.playedAt)}
            </p>
            <p
              className="truncate text-[10px] font-medium"
              style={{ color: "var(--gn-brass)" }}
            >
              🏆 {session.winner}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
