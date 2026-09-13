import { useState } from "react";
import { Plus } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import {
  useAddMarioKartPoints,
  useMarioKartPoints,
} from "@/features/game-night/hooks/useMarioKartPoints";
import { PlayerLink } from "@/features/game-night/components/PlayerLink";

// Mario Kart is het enige spel met een eigen puntenklassement i.p.v. het
// generieke rondes-/sessieklassement (zie GameNightGameDetail, dat dit
// component alleen rendert voor game.slug === "mario-kart"): de owner kent
// na elke race handmatig een getal toe per speler, hoogste totaal staat
// boven, en het klassement begint vanzelf weer bij nul zodra er een nieuwe
// Game Night start (nieuwe game_night_session_id, dus nog geen rijen).
export function MarioKartLeaderboard({
  gameNightSessionId,
  players,
}: {
  gameNightSessionId: string;
  players: GameNightPlayer[];
}) {
  const { data: points = [] } = useMarioKartPoints(gameNightSessionId);
  const addPoints = useAddMarioKartPoints(gameNightSessionId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const pointsByPlayer = new Map(points.map((p) => [p.player_id, p.points]));
  const rows = [...players]
    .map((player) => ({
      player,
      points: pointsByPlayer.get(player.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.points - a.points || a.player.name.localeCompare(b.player.name, "nl"),
    );

  function submit(playerId: string) {
    const raw = drafts[playerId];
    const delta = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(delta) || delta === 0) return;
    addPoints.mutate(
      { playerId, delta },
      { onSuccess: () => setDrafts((d) => ({ ...d, [playerId]: "" })) },
    );
  }

  if (players.length === 0) {
    return (
      <div className="gnv2-panel-elevated px-5 py-4 text-center">
        <p className="gnv2-eyebrow mb-1.5">Klassement</p>
        <p className="gnv2-muted text-sm">
          Voeg spelers toe aan deze Game Night om punten bij te houden.
        </p>
      </div>
    );
  }

  return (
    <div className="gnv2-panel-elevated px-5 py-4">
      <p className="gnv2-eyebrow mb-2.5">Klassement</p>
      <div className="flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <div
            key={row.player.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="gnv2-faint w-4 shrink-0 text-right">
                {i + 1}.
              </span>
              <PlayerLink player={row.player} />
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="gnv2-muted w-10 text-right font-semibold">
                {row.points}
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={drafts[row.player.id] ?? ""}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [row.player.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit(row.player.id);
                }}
                className="w-14 rounded-md px-2 py-1 text-center text-sm"
                placeholder="+15"
                aria-label={`Punten voor ${row.player.name}`}
              />
              <button
                type="button"
                onClick={() => submit(row.player.id)}
                disabled={addPoints.isPending}
                className="gnv2-nav-btn"
                aria-label={`Punten geven aan ${row.player.name}`}
                title="Punten geven"
              >
                <Plus className="h-4 w-4" />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
