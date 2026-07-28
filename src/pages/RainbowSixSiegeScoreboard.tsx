import { useMemo, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { R6Header } from "@/features/rainbow-six-siege/components/R6Header";
import { useR6LifetimeStats } from "@/features/rainbow-six-siege/hooks/useR6LifetimeStats";
import { computeR6LifetimeStats, type R6PlayerLifetimeStats } from "@/features/rainbow-six-siege/lib/lifetimeStats";
import { computeScoreboard } from "@/features/rainbow-six-siege/lib/scoring";

type SortKey = "points" | "wins" | "avg" | "aces" | "headshots" | "clutches";
type PeriodKey = "all" | "30d" | "90d" | "year";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "points", label: "Meeste punten" },
  { value: "wins", label: "Meeste wins" },
  { value: "avg", label: "Hoogste gemiddelde" },
  { value: "aces", label: "Meeste aces" },
  { value: "headshots", label: "Meeste headshots" },
  { value: "clutches", label: "Meeste clutches" },
];

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "all", label: "Alle periodes" },
  { value: "30d", label: "Laatste 30 dagen" },
  { value: "90d", label: "Laatste 90 dagen" },
  { value: "year", label: "Afgelopen jaar" },
];

function sortStats(stats: R6PlayerLifetimeStats[], sortBy: SortKey): R6PlayerLifetimeStats[] {
  const copy = [...stats];
  switch (sortBy) {
    case "wins":
      return copy.sort((a, b) => b.winCount - a.winCount);
    case "avg":
      return copy.sort((a, b) => b.avgPointsPerLan - a.avgPointsPerLan);
    case "aces":
      return copy.sort((a, b) => b.totals.aces - a.totals.aces);
    case "headshots":
      return copy.sort((a, b) => b.totals.headshots - a.totals.headshots);
    case "clutches":
      return copy.sort((a, b) => b.totals.clutches - a.totals.clutches);
    case "points":
    default:
      return copy.sort((a, b) => b.totalPoints - a.totalPoints);
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function PlayerDetailSheet({
  stats,
  onOpenChange,
  recentSessions,
}: {
  stats: R6PlayerLifetimeStats | null;
  onOpenChange: (open: boolean) => void;
  recentSessions: { sessionName: string; date: string; points: number }[];
}) {
  return (
    <Sheet open={!!stats} onOpenChange={onOpenChange}>
      <SheetContent className="r6-theme w-full overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
        {stats && (
          <>
            <SheetHeader>
              <SheetTitle className="font-serif text-2xl text-zinc-100">{stats.player.name}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["Totale punten", stats.totalPoints],
                ["Kills", stats.totals.kills],
                ["Headshots", stats.totals.headshots],
                ["Assists", stats.totals.assists],
                ["Revives", stats.totals.revives],
                ["Deaths", stats.totals.deaths],
                ["Aces", stats.totals.aces],
                ["Clutches", stats.totals.clutches],
                ["1v2", stats.totals.clutch1v2],
                ["1v3", stats.totals.clutch1v3],
                ["Challenges", stats.totals.challengesCompleted],
                ["Games", stats.gameCount],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-center">
                  <p className="text-xs text-zinc-500">{label}</p>
                  <p className="font-serif text-lg font-bold text-zinc-100">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">Winpercentage</p>
                <p className="font-serif text-lg font-bold text-amber-400">{Math.round(stats.gameWinRate)}%</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">LAN's gewonnen</p>
                <p className="font-serif text-lg font-bold text-amber-400">{stats.winCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">Meest gekozen attacker</p>
                <p className="text-sm font-semibold text-amber-400">{stats.mostUsedAttacker?.name ?? "—"}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">Meest gekozen defender</p>
                <p className="text-sm font-semibold text-amber-400">{stats.mostUsedDefender?.name ?? "—"}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-zinc-300">Recente LAN-resultaten</p>
              {recentSessions.length === 0 ? (
                <p className="text-xs text-zinc-500">Nog geen LAN's gespeeld.</p>
              ) : (
                recentSessions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm">
                    <span className="text-zinc-300">{s.sessionName}</span>
                    <span className="text-xs text-zinc-500">{s.date}</span>
                    <span className="font-semibold text-amber-400">{s.points} pt</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function RainbowSixSiegeScoreboard() {
  const { data, isLoading } = useR6LifetimeStats();
  const [sessionFilter, setSessionFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodKey>("all");
  const [playerFilter, setPlayerFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("points");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    if (!data) return [];
    let sessions = data.sessions;
    if (sessionFilter !== "all") sessions = sessions.filter((s) => s.id === sessionFilter);
    if (periodFilter !== "all") {
      const now = Date.now();
      const cutoffDays = periodFilter === "30d" ? 30 : periodFilter === "90d" ? 90 : 365;
      const cutoff = now - cutoffDays * 24 * 60 * 60 * 1000;
      sessions = sessions.filter((s) => new Date(s.started_at).getTime() >= cutoff);
    }
    return sessions;
  }, [data, sessionFilter, periodFilter]);

  const stats = useMemo(() => {
    if (!data) return [];
    const isFiltered = sessionFilter !== "all" || periodFilter !== "all";
    const base = isFiltered
      ? computeR6LifetimeStats(
          filteredSessions,
          data.sessionPlayers,
          data.matches,
          data.matchPlayers,
          data.events,
          data.operatorAssignments,
          data.operators,
          data.challenges,
          data.scoreRules,
        )
      : data.stats;
    const byPlayer = playerFilter === "all" ? base : base.filter((s) => s.player.id === playerFilter);
    return sortStats(byPlayer, sortBy);
  }, [data, filteredSessions, sessionFilter, periodFilter, playerFilter, sortBy]);

  const allPlayers = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, string>();
    for (const sp of data.sessionPlayers) seen.set(sp.player.id, sp.player.name);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const selectedStats = stats.find((s) => s.player.id === selectedPlayerId) ?? null;

  const recentSessionsForSelected = useMemo(() => {
    if (!data || !selectedPlayerId) return [];
    const rows: { sessionName: string; date: string; points: number; sortDate: string }[] = [];
    for (const session of data.sessions) {
      const roster = data.sessionPlayers.filter((sp) => sp.session_id === session.id).map((sp) => sp.player);
      if (!roster.some((p) => p.id === selectedPlayerId)) continue;
      const sessionMatches = data.matches.filter((m) => m.session_id === session.id);
      const sessionMatchIds = new Set(sessionMatches.map((m) => m.id));
      const sessionMatchPlayers = data.matchPlayers.filter((mp) => sessionMatchIds.has(mp.match_id));
      const sessionEvents = data.events.filter((e) => e.session_id === session.id);
      const scoreboard = computeScoreboard(roster, sessionMatches, sessionMatchPlayers, data.challenges, data.scoreRules, sessionEvents);
      const entry = scoreboard.find((e) => e.player.id === selectedPlayerId);
      const sortDate = session.ended_at ?? session.started_at;
      rows.push({ sessionName: session.name, date: formatDate(sortDate), points: entry?.totalPoints ?? 0, sortDate });
    }
    return rows.sort((a, b) => b.sortDate.localeCompare(a.sortDate)).slice(0, 5);
  }, [data, selectedPlayerId]);

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <R6Header title="Scorebord" subtitle="Bekijk de actuele ranglijst en prestaties over alle LAN-avonden." />

      <div className="flex flex-wrap gap-2">
        <Select value={sessionFilter} onValueChange={setSessionFilter}>
          <SelectTrigger className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 sm:w-48">
            <SelectValue placeholder="Alle LAN-avonden" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            <SelectItem value="all" className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
              Alle LAN-avonden
            </SelectItem>
            {data.sessions.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodKey)}>
          <SelectTrigger className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={playerFilter} onValueChange={setPlayerFilter}>
          <SelectTrigger className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 sm:w-44">
            <SelectValue placeholder="Alle spelers" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            <SelectItem value="all" className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
              Alle spelers
            </SelectItem>
            {allPlayers.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stats.length === 0 ? (
        <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
          Nog geen scoregegevens beschikbaar. Start eerst een LAN-avond en registreer acties.
        </p>
      ) : (
        <div className="space-y-2">
          {stats.map((entry, index) => (
            <button
              key={entry.player.id}
              type="button"
              onClick={() => setSelectedPlayerId(entry.player.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors hover:bg-zinc-800/60 ${
                index < 3 ? "border-amber-500/40 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/60"
              }`}
            >
              <span className={`w-8 shrink-0 text-center font-serif text-lg font-bold ${index < 3 ? "text-amber-400" : "text-zinc-500"}`}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-lg font-semibold text-zinc-100">{entry.player.name}</p>
                <p className="text-xs text-zinc-500">
                  {entry.lanCount} LAN's · {entry.gameCount} games · gem. {Math.round(entry.avgPointsPerLan)} pt/LAN · {entry.winCount}× gewonnen
                </p>
              </div>
              <div className="hidden shrink-0 text-right text-xs text-zinc-500 sm:block">
                <p>Laatst gespeeld</p>
                <p>{formatDate(entry.lastPlayedAt)}</p>
              </div>
              <span className="shrink-0 font-serif text-2xl font-bold text-amber-400">{entry.totalPoints}</span>
              {index === 0 && <Trophy className="h-4 w-4 shrink-0 text-amber-400" />}
            </button>
          ))}
        </div>
      )}

      <PlayerDetailSheet stats={selectedStats} onOpenChange={(open) => !open && setSelectedPlayerId(null)} recentSessions={recentSessionsForSelected} />
    </div>
  );
}
