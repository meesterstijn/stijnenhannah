import { useTonightStats } from "@/features/game-night/hooks/useTonightStats";
import { formatDuration } from "@/features/game-night/lib/gameTimer";

// "VANAVOND"-blokje (sectie 11) — uitsluitend echte, afgeleide data. Zolang
// er nog niets is afgerond, is er simpelweg niets te tonen (sectie 42: geen
// mockdata, dus liever minder dan verzonnen).
export function TonightStats({
  gameNightSessionId,
}: {
  gameNightSessionId: string;
}) {
  const { data: stats } = useTonightStats(gameNightSessionId);

  if (!stats || stats.gamesPlayed === 0) return null;

  return (
    <div className="gn-tonight-stats">
      <p className="gn-eyebrow">Vanavond</p>
      <p className="gn-muted text-xs">
        {stats.gamesPlayed}{" "}
        {stats.gamesPlayed === 1 ? "spel gespeeld" : "spellen gespeeld"}
        {stats.totalActiveMinutes > 0 &&
          ` · ${formatDuration(stats.totalActiveMinutes * 60)} bezig`}
      </p>
      {stats.topWinners.length > 0 && (
        <p className="gn-muted text-xs">
          {stats.topWinners
            .map(
              (w) =>
                `${w.playerName} · ${w.wins} ${w.wins === 1 ? "zege" : "zeges"}`,
            )
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
