import { useMemo } from "react";
import { Quote } from "lucide-react";
import { R6Scoreboard } from "@/features/rainbow-six-siege/components/R6Scoreboard";
import { R6SessionMediaGallery } from "@/features/rainbow-six-siege/components/R6SessionMediaGallery";
import {
  buildSummaryText,
  collectFunnyMoments,
  computeChallengeSummaries,
  computeChaosSummaries,
  computeHighlights,
  computeMapStats,
  computePlayerOperatorSummaries,
  findBestAndWorstMap,
  MIN_MATCHES_FOR_MAP_RANKING,
} from "@/features/rainbow-six-siege/lib/afterActionReport";
import type {
  R6Challenge,
  R6Map,
  R6Match,
  R6MatchPlayer,
  R6Operator,
  R6ScoreboardEntry,
  R6Session,
} from "@/features/rainbow-six-siege/types";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="font-serif text-lg font-semibold text-zinc-100">{title}</p>
      {children}
    </section>
  );
}

export function R6AfterActionReport({
  session,
  matches,
  matchPlayers,
  scoreboard,
  maps,
  operators,
  challenges,
}: {
  session: R6Session;
  matches: R6Match[];
  matchPlayers: R6MatchPlayer[];
  scoreboard: R6ScoreboardEntry[];
  maps: Map<string, R6Map>;
  operators: Map<string, R6Operator>;
  challenges: Map<string, R6Challenge>;
}) {
  const players = useMemo(() => scoreboard.map((e) => e.player), [scoreboard]);

  const resultCounts = useMemo(() => {
    const counts = { win: 0, loss: 0, draw: 0, unknown: 0 };
    for (const m of matches) counts[m.result] += 1;
    return counts;
  }, [matches]);
  const decided = resultCounts.win + resultCounts.loss + resultCounts.draw;
  const winRate = decided > 0 ? Math.round((resultCounts.win / decided) * 100) : null;

  const mapStats = useMemo(() => computeMapStats(matches, maps), [matches, maps]);
  const { best: bestMap, worst: worstMap } = useMemo(() => findBestAndWorstMap(mapStats), [mapStats]);
  const playedMapCount = mapStats.reduce((sum, m) => sum + m.played, 0);
  const mostPlayed = mapStats.length > 0 ? [...mapStats].sort((a, b) => b.played - a.played)[0] : null;

  const operatorSummaries = useMemo(
    () => computePlayerOperatorSummaries(players, matchPlayers, operators),
    [players, matchPlayers, operators],
  );
  const challengeSummaries = useMemo(() => computeChallengeSummaries(matches, challenges), [matches, challenges]);
  const chaosSummaries = useMemo(() => computeChaosSummaries(matches), [matches]);
  const funnyMoments = useMemo(() => collectFunnyMoments(matches), [matches]);
  const highlights = useMemo(() => computeHighlights(scoreboard), [scoreboard]);
  const summaryText = useMemo(() => buildSummaryText({ scoreboard, bestMap, highlights }), [scoreboard, bestMap, highlights]);

  return (
    <div className="space-y-4">
      <SectionCard title="Samenvatting">
        <p className="text-sm italic text-zinc-300">{summaryText}</p>
      </SectionCard>

      <SectionCard title="Algemene samenvatting">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-500">Gewonnen</p>
            <p className="font-serif text-lg font-semibold text-emerald-400">{resultCounts.win}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Verloren</p>
            <p className="font-serif text-lg font-semibold text-rose-400">{resultCounts.loss}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Gelijkspel</p>
            <p className="font-serif text-lg font-semibold text-zinc-100">{resultCounts.draw}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Winrate</p>
            <p className="font-serif text-lg font-semibold text-amber-400">{winRate !== null ? `${winRate}%` : "—"}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Eindklassement">
        <R6Scoreboard entries={scoreboard} isFinal />
      </SectionCard>

      <SectionCard title="Hoogtepunten">
        {highlights.length === 0 ? (
          <p className="text-sm text-zinc-400">Nog geen hoogtepunten om te tonen.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {highlights.map((h) => (
              <span key={h.label} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
                {h.label}: {h.playerName} ({h.value})
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Maps">
        {playedMapCount === 0 ? (
          <p className="text-sm text-zinc-400">Geen Gimma's met een bekende map.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">
              Meest gespeeld: {mostPlayed?.mapName} ({mostPlayed?.played}×)
            </p>
            {bestMap ? (
              <p className="text-xs text-zinc-500">
                Beste map: {bestMap.mapName} ({Math.round(bestMap.winRate * 100)}% winrate over {bestMap.played} Gimma's)
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                Nog geen map met minstens {MIN_MATCHES_FOR_MAP_RANKING} gespeelde Gimma's — nog geen "beste map" aan te wijzen.
              </p>
            )}
            {worstMap && worstMap.mapId !== bestMap?.mapId && (
              <p className="text-xs text-zinc-500">
                Slechtste map: {worstMap.mapName} ({Math.round(worstMap.winRate * 100)}% winrate over {worstMap.played} Gimma's)
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {mapStats.map((m) => (
                <span key={m.mapId} className="rounded-full border border-zinc-700 bg-zinc-950/50 px-2.5 py-0.5 text-xs text-zinc-300">
                  {m.mapName}: {m.wins}W-{m.losses}L-{m.draws}D
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Operators">
        {operatorSummaries.every((s) => !s.mostPlayedAttacker && !s.mostPlayedDefender) ? (
          <p className="text-sm text-zinc-400">Geen operators geregistreerd.</p>
        ) : (
          <div className="space-y-2">
            {operatorSummaries.map((s) => (
              <p key={s.playerId} className="text-xs text-zinc-400">
                <span className="text-zinc-200">{s.playerName}:</span>{" "}
                {s.mostPlayedAttacker ? `aanval — ${s.mostPlayedAttacker.operatorName} (${s.mostPlayedAttacker.count}×)` : "geen aanval-operator"}
                {" · "}
                {s.mostPlayedDefender ? `verdediging — ${s.mostPlayedDefender.operatorName} (${s.mostPlayedDefender.count}×)` : "geen verdedigings-operator"}
              </p>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Challenges en chaos">
        {challengeSummaries.length === 0 && chaosSummaries.length === 0 ? (
          <p className="text-sm text-zinc-400">Geen challenges of chaos-effecten gebruikt.</p>
        ) : (
          <div className="space-y-2">
            {challengeSummaries.map((c) => (
              <p key={c.challengeId} className="text-xs text-zinc-400">
                {c.challengeName}: {c.timesCompleted}/{c.timesPlayed} keer gehaald
              </p>
            ))}
            {chaosSummaries.map((c) => (
              <p key={c.label} className="text-xs text-zinc-400">
                Chaos "{c.label}": {c.timesUsed}×
              </p>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Grappigste momenten">
        {funnyMoments.length === 0 ? (
          <p className="text-sm text-zinc-400">Geen grappigste momenten vastgelegd.</p>
        ) : (
          <div className="space-y-2">
            {funnyMoments.map((m) => (
              <p key={m.matchNumber} className="flex items-start gap-2 text-sm italic text-zinc-300">
                <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  Gimma {m.matchNumber}: {m.text}
                </span>
              </p>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Media">
        <R6SessionMediaGallery sessionId={session.id} matches={matches} editable={false} />
      </SectionCard>
    </div>
  );
}
