import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { R6Header } from "@/features/rainbow-six-siege/components/R6Header";
import { useR6LifetimeStats } from "@/features/rainbow-six-siege/hooks/useR6LifetimeStats";
import { useR6Maps } from "@/features/rainbow-six-siege/hooks/useR6Reference";
import { computeMapStats } from "@/features/rainbow-six-siege/lib/afterActionReport";
import { computeR6Records } from "@/features/rainbow-six-siege/lib/records";
import { computeScoreboard } from "@/features/rainbow-six-siege/lib/scoring";

const PLAYER_LINE_COLORS = ["#f59e0b", "#a1a1aa", "#38bdf8", "#34d399"];
const NEUTRAL_GRID = "#3f3f46";
const NEUTRAL_TEXT = "#a1a1aa";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="font-serif text-lg font-semibold text-zinc-100">{title}</p>
      {children}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-serif text-xl font-bold text-amber-400">{value}</p>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}u ${mins}m`;
}

export default function RainbowSixSiegeStatistics() {
  const { data, isLoading } = useR6LifetimeStats();
  const { data: maps = [] } = useR6Maps();
  const mapsById = useMemo(() => new Map(maps.map((m) => [m.id, m])), [maps]);
  const operatorsById = useMemo(() => new Map((data?.operators ?? []).map((o) => [o.id, o])), [data]);

  const [playerA, setPlayerA] = useState<string>("");
  const [playerB, setPlayerB] = useState<string>("");

  const stats = data?.stats ?? [];

  useMemo(() => {
    if (!playerA && stats[0]) setPlayerA(stats[0].player.id);
    if (!playerB && stats[1]) setPlayerB(stats[1].player.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  const totalActions = data?.events.length ?? 0;
  const totalPoints = stats.reduce((sum, s) => sum + s.totalPoints, 0);
  const totalAces = stats.reduce((sum, s) => sum + s.totals.aces, 0);
  const totalClutches = stats.reduce((sum, s) => sum + s.totals.clutches, 0);

  const mapStats = useMemo(() => (data ? computeMapStats(data.matches, mapsById) : []), [data, mapsById]);
  const mostPlayedMap = mapStats.length > 0 ? [...mapStats].sort((a, b) => b.played - a.played)[0] : null;

  const records = useMemo(() => (data ? computeR6Records(data, mapsById, operatorsById) : null), [data, mapsById, operatorsById]);

  const scoreDevelopmentData = useMemo(() => {
    if (!data) return [];
    const topPlayers = stats.slice(0, 4);
    const sorted = [...data.sessions].sort((a, b) => a.started_at.localeCompare(b.started_at));
    return sorted.map((session) => {
      const row: Record<string, string | number> = { name: session.name.length > 14 ? `${session.name.slice(0, 14)}…` : session.name };
      const roster = data.sessionPlayers.filter((sp) => sp.session_id === session.id).map((sp) => sp.player);
      const sessionMatches = data.matches.filter((m) => m.session_id === session.id);
      const sessionMatchIds = new Set(sessionMatches.map((m) => m.id));
      const sessionMatchPlayers = data.matchPlayers.filter((mp) => sessionMatchIds.has(mp.match_id));
      const sessionEvents = data.events.filter((e) => e.session_id === session.id);
      const scoreboard = computeScoreboard(roster, sessionMatches, sessionMatchPlayers, data.challenges, data.scoreRules, sessionEvents);
      for (const p of topPlayers) {
        if (!roster.some((r) => r.id === p.player.id)) continue;
        row[p.player.name] = scoreboard.find((e) => e.player.id === p.player.id)?.totalPoints ?? 0;
      }
      return row;
    });
  }, [data, stats]);

  const pointsPerGameData = useMemo(
    () => stats.slice(0, 8).map((s) => ({ name: s.player.name, value: s.gameCount > 0 ? Math.round((s.totalPoints / s.gameCount) * 10) / 10 : 0 })),
    [stats],
  );

  const actionDistributionData = useMemo(() => {
    const totals = { kills: 0, headshots: 0, assists: 0, revives: 0, aces: 0, clutches: 0 };
    for (const s of stats) {
      totals.kills += s.totals.kills;
      totals.headshots += s.totals.headshots;
      totals.assists += s.totals.assists;
      totals.revives += s.totals.revives;
      totals.aces += s.totals.aces;
      totals.clutches += s.totals.clutches;
    }
    return [
      { name: "Kills", value: totals.kills },
      { name: "Headshots", value: totals.headshots },
      { name: "Assists", value: totals.assists },
      { name: "Revives", value: totals.revives },
      { name: "Aces", value: totals.aces },
      { name: "Clutches", value: totals.clutches },
    ];
  }, [stats]);

  const mapPerformanceData = useMemo(
    () => mapStats.map((m) => ({ name: m.mapName, value: Math.round(m.winRate * 100) })),
    [mapStats],
  );

  const operatorUsageData = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const a of data.operatorAssignments) {
      if (a.attacker_operator_id) counts.set(a.attacker_operator_id, (counts.get(a.attacker_operator_id) ?? 0) + 1);
      if (a.defender_operator_id) counts.set(a.defender_operator_id, (counts.get(a.defender_operator_id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ name: operatorsById.get(id)?.name ?? "Onbekend", value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data, operatorsById]);

  const winLossData = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const s of stats) {
      wins += s.totals.wins;
      losses += s.totals.losses;
      draws += s.totals.draws;
    }
    return [
      { name: "Wins", value: wins },
      { name: "Losses", value: losses },
      { name: "Gelijkspel", value: draws },
    ];
  }, [stats]);

  const statA = stats.find((s) => s.player.id === playerA);
  const statB = stats.find((s) => s.player.id === playerB);

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="space-y-4">
        <R6Header title="Statistieken" subtitle="Diepgaande analyse over alle LAN-avonden." />
        <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
          Nog geen scoregegevens beschikbaar. Start eerst een LAN-avond en registreer acties.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <R6Header title="Statistieken" subtitle="Diepgaande analyse: spelervergelijking, grafieken en records." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="LAN-avonden" value={data.sessions.length} />
        <StatTile label="Games" value={data.matches.length} />
        <StatTile label="Geregistreerde acties" value={totalActions} />
        <StatTile label="Totaal punten" value={totalPoints} />
        <StatTile label="Aces" value={totalAces} />
        <StatTile label="Clutches" value={totalClutches} />
        <StatTile label="Meest gespeelde map" value={mostPlayedMap?.mapName ?? "—"} />
        <StatTile label="Langste LAN" value={records ? formatMinutes(records.longestLan?.minutes ?? 0) : "—"} />
      </div>

      <SectionCard title="Spelervergelijking">
        <div className="grid grid-cols-2 gap-2">
          <Select value={playerA} onValueChange={setPlayerA}>
            <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
              <SelectValue placeholder="Speler A" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
              {stats.map((s) => (
                <SelectItem key={s.player.id} value={s.player.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                  {s.player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={playerB} onValueChange={setPlayerB}>
            <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
              <SelectValue placeholder="Speler B" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
              {stats.map((s) => (
                <SelectItem key={s.player.id} value={s.player.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                  {s.player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {statA && statB && (
          <div className="mt-3 space-y-1.5">
            {(
              [
                ["Punten", statA.totalPoints, statB.totalPoints],
                ["Gem. punten/game", Math.round((statA.totalPoints / (statA.gameCount || 1)) * 10) / 10, Math.round((statB.totalPoints / (statB.gameCount || 1)) * 10) / 10],
                ["Kills", statA.totals.kills, statB.totals.kills],
                ["Headshots", statA.totals.headshots, statB.totals.headshots],
                ["Assists", statA.totals.assists, statB.totals.assists],
                ["Revives", statA.totals.revives, statB.totals.revives],
                ["Deaths", statA.totals.deaths, statB.totals.deaths],
                ["K/D", Math.round((statA.totals.kills / (statA.totals.deaths || 1)) * 100) / 100, Math.round((statB.totals.kills / (statB.totals.deaths || 1)) * 100) / 100],
                ["Aces", statA.totals.aces, statB.totals.aces],
                ["Clutches", statA.totals.clutches, statB.totals.clutches],
                ["1v2", statA.totals.clutch1v2, statB.totals.clutch1v2],
                ["1v3", statA.totals.clutch1v3, statB.totals.clutch1v3],
                ["Wins", statA.totals.wins, statB.totals.wins],
                ["Winpercentage", `${Math.round(statA.gameWinRate)}%`, `${Math.round(statB.gameWinRate)}%`],
              ] as [string, string | number, string | number][]
            ).map(([label, a, b]) => (
              <div key={label} className="grid grid-cols-3 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-sm">
                <span className={`text-right font-semibold ${a > b ? "text-amber-400" : "text-zinc-300"}`}>{a}</span>
                <span className="text-center text-xs text-zinc-500">{label}</span>
                <span className={`text-left font-semibold ${b > a ? "text-amber-400" : "text-zinc-300"}`}>{b}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Scoreontwikkeling per LAN">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreDevelopmentData}>
              <CartesianGrid stroke={NEUTRAL_GRID} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={NEUTRAL_TEXT} tick={{ fontSize: 11 }} />
              <YAxis stroke={NEUTRAL_TEXT} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {stats.slice(0, 4).map((s, i) => (
                <Line key={s.player.id} type="monotone" dataKey={s.player.name} stroke={PLAYER_LINE_COLORS[i]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Punten per game (gemiddelde)">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pointsPerGameData}>
                <CartesianGrid stroke={NEUTRAL_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={NEUTRAL_TEXT} tick={{ fontSize: 11 }} />
                <YAxis stroke={NEUTRAL_TEXT} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
                <Bar dataKey="value" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Verdeling van acties">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionDistributionData}>
                <CartesianGrid stroke={NEUTRAL_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={NEUTRAL_TEXT} tick={{ fontSize: 11 }} />
                <YAxis stroke={NEUTRAL_TEXT} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
                <Bar dataKey="value" fill="#a1a1aa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Prestaties per map (winrate %)">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mapPerformanceData}>
                <CartesianGrid stroke={NEUTRAL_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={NEUTRAL_TEXT} tick={{ fontSize: 10 }} />
                <YAxis stroke={NEUTRAL_TEXT} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
                <Bar dataKey="value" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Operatorgebruik">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={operatorUsageData}>
                <CartesianGrid stroke={NEUTRAL_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={NEUTRAL_TEXT} tick={{ fontSize: 10 }} />
                <YAxis stroke={NEUTRAL_TEXT} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
                <Bar dataKey="value" fill="#a1a1aa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Win/loss-verhouding">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={winLossData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
                  {winLossData.map((entry, i) => (
                    <Cell key={entry.name} fill={["#f59e0b", "#71717a", "#3f3f46"][i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {records && (
        <SectionCard title="Records">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ["Hoogste score in één LAN", records.highestSingleLan ? `${records.highestSingleLan.playerName} — ${records.highestSingleLan.points} pt (${records.highestSingleLan.sessionName})` : "—"],
              ["Meeste punten in één game", records.mostPointsSingleGame ? `${records.mostPointsSingleGame.playerName} — ${records.mostPointsSingleGame.points} pt (Game ${records.mostPointsSingleGame.matchNumber})` : "—"],
              ["Meeste aces in één LAN", records.mostAcesSingleLan ? `${records.mostAcesSingleLan.playerName} — ${records.mostAcesSingleLan.count}` : "—"],
              ["Meeste headshots in één LAN", records.mostHeadshotsSingleLan ? `${records.mostHeadshotsSingleLan.playerName} — ${records.mostHeadshotsSingleLan.count}` : "—"],
              ["Meeste clutches in één LAN", records.mostClutchesSingleLan ? `${records.mostClutchesSingleLan.playerName} — ${records.mostClutchesSingleLan.count}` : "—"],
              ["Hoogste winreeks", records.longestWinStreak ? `${records.longestWinStreak.playerName} — ${records.longestWinStreak.streak}× op rij` : "—"],
              ["Meeste revives in één LAN", records.mostRevivesSingleLan ? `${records.mostRevivesSingleLan.playerName} — ${records.mostRevivesSingleLan.count}` : "—"],
              ["Langste LAN", records.longestLan ? `${records.longestLan.sessionName} — ${formatMinutes(records.longestLan.minutes)}` : "—"],
              ["Meest gespeelde map", records.mostPlayedMap ? `${records.mostPlayedMap.mapName} (${records.mostPlayedMap.count}×)` : "—"],
              ["Meest gebruikte attacker", records.mostUsedAttacker ? `${records.mostUsedAttacker.name} (${records.mostUsedAttacker.count}×)` : "—"],
              ["Meest gebruikte defender", records.mostUsedDefender ? `${records.mostUsedDefender.name} (${records.mostUsedDefender.count}×)` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="font-semibold text-amber-400">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
