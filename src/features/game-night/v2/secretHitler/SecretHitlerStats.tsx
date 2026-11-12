import { useMemo } from "react";
import type { GameNightPlayer } from "@/lib/supabase";
import { PlayerLink } from "@/features/game-night/components/PlayerLink";
import { usePlayers } from "@/features/game-night/hooks/usePlayers";
import { useSecretHitlerHistory } from "@/features/game-night/hooks/useSecretHitler";
import {
  buildSecretHitlerCareer,
  WIN_REASON_SHORT,
  type ShCareer,
} from "@/features/game-night/lib/secretHitlerStory";
import type { ShWinReason } from "@/features/game-night/lib/secretHitler";

function topOf(
  players: ShCareer[],
  score: (c: ShCareer) => number,
): { ids: string[]; value: number } | null {
  let best = 0;
  for (const p of players) best = Math.max(best, score(p));
  if (best <= 0) return null;
  return {
    ids: players.filter((p) => score(p) === best).map((p) => p.playerId),
    value: best,
  };
}

// Secret Hitler op de spelpagina: wie is de beste liberaal, wie was het
// vaakst Hitler, en hoe vaak winnen de fascisten eigenlijk? Alleen potjes
// waarvan de rollen zijn onthuld tellen mee.
export function SecretHitlerStats({ gameId }: { gameId: string }) {
  const { data: history = [], isLoading } = useSecretHitlerHistory(gameId);
  const { data: players = [] } = usePlayers();
  const byId = useMemo(
    () => new Map<string, GameNightPlayer>(players.map((p) => [p.id, p])),
    [players],
  );
  const summary = useMemo(() => buildSecretHitlerCareer(history), [history]);

  if (isLoading || summary.games === 0) return null;

  const name = (id: string) => byId.get(id)?.name ?? "Oud-speler";
  const records = [
    {
      icon: "🦎",
      title: "Vaakst Hitler",
      top: topOf(summary.players, (c) => c.hitler),
      unit: "×",
    },
    {
      icon: "🕊️",
      title: "Beste liberaal",
      top: topOf(summary.players, (c) => c.liberalWins),
      unit: " liberale winst",
    },
    {
      icon: "💀",
      title: "Beste fascist",
      top: topOf(summary.players, (c) => c.fascistWins + c.hitlerWins),
      unit: " fascistische winst",
    },
    {
      icon: "🎯",
      title: "Hitlerjager",
      top: topOf(summary.players, (c) => c.hitlersShot),
      unit: "× Hitler neergeschoten",
    },
    {
      icon: "🤥",
      title: "Grootste leugenaar",
      top: topOf(summary.players, (c) => c.lies),
      unit: "× betrapt",
    },
    {
      icon: "⚰️",
      title: "Kogelvanger",
      top: topOf(summary.players, (c) => c.executed),
      unit: "× geëxecuteerd",
    },
  ].filter((r) => r.top);

  const libPct = Math.round((summary.liberalWins / summary.games) * 100);

  return (
    <div className="gnv2-panel-elevated sh-stats">
      <p className="gnv2-eyebrow">Secret Hitler · alle potjes</p>
      <div className="sh-stats-score">
        <div className="sh-stats-team sh-stats-team-liberal">
          <span className="sh-stats-big">{summary.liberalWins}</span>
          <span>🕊️ liberale winst</span>
        </div>
        <div className="sh-stats-vs">
          <span className="sh-stats-bar">
            <span style={{ width: `${libPct}%` }} />
          </span>
          <span className="gnv2-faint text-xs">
            {summary.games} {summary.games === 1 ? "potje" : "potjes"}
          </span>
        </div>
        <div className="sh-stats-team sh-stats-team-fascist">
          <span className="sh-stats-big">{summary.fascistWins}</span>
          <span>💀 fascistische winst</span>
        </div>
      </div>
      <p className="gnv2-faint text-xs sh-stats-reasons">
        {(Object.entries(summary.reasons) as [ShWinReason, number][])
          .map(([reason, n]) => `${n}× ${WIN_REASON_SHORT[reason]}`)
          .join(" · ")}
      </p>

      {records.length > 0 && (
        <ul className="sh-stats-records">
          {records.map((r) => (
            <li key={r.title}>
              <span aria-hidden>{r.icon}</span>
              <span>
                <strong>{r.title}</strong>
                <span className="gnv2-muted">
                  {r.top!.ids.map(name).join(", ")} · {r.top!.value}
                  {r.unit}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="sh-stats-table-wrap">
        <table className="sh-stats-table">
          <thead>
            <tr>
              <th>Speler</th>
              <th title="Gespeeld">#</th>
              <th title="Liberaal">🕊️</th>
              <th title="Fascist">💀</th>
              <th title="Hitler">🦎</th>
              <th title="Gewonnen">Winst</th>
            </tr>
          </thead>
          <tbody>
            {summary.players.map((c) => {
              const player = byId.get(c.playerId);
              return (
                <tr key={c.playerId}>
                  <td>
                    {player ? <PlayerLink player={player} /> : name(c.playerId)}
                  </td>
                  <td>{c.played}</td>
                  <td>{c.liberal}</td>
                  <td>{c.fascist}</td>
                  <td>{c.hitler}</td>
                  <td>
                    {c.wins}{" "}
                    <span className="gnv2-faint">
                      ({Math.round((c.wins / c.played) * 100)}%)
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
