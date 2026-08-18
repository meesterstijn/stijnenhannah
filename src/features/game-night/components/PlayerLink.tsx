import { Link } from "react-router-dom";
import type { GameNightPlayer } from "@/lib/supabase";

// Kleine herbruikbare spelernaam-link (Game Night V5/V6: overal waar een
// spelernaam getoond wordt — geschiedenis, speldetail, Hall of Fame — moet
// die naar het spelerprofiel kunnen linken). Losstaand tekstelement, dus
// veilig te nesten binnen niet-interactieve containers zonder een
// link-in-link/button-in-button op te leveren.
export function PlayerLink({ player }: { player: GameNightPlayer }) {
  return (
    <Link
      to={`/game-night/spelers/${player.id}`}
      className="underline decoration-dotted underline-offset-2 hover:text-[var(--gn-brass)]"
    >
      {player.name}
    </Link>
  );
}
