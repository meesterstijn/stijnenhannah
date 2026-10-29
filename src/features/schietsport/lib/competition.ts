import type {
  CompetitionEntry,
  CompetitionPeriod,
  ShootingSession,
} from "@/features/schietsport/domain/model";
import {
  bestOfStandings,
  eligibleSessions,
  periodStandings,
  periodTotals,
  ruleTypeOf,
} from "@/features/schietsport/domain/competition";
import { summarize } from "@/features/schietsport/domain/stats";
import { formatMean, todayYmd } from "@/features/schietsport/lib/format";

// Status en voortgang (in tijd) van een competitieperiode.
export function competitionStatus(c: CompetitionPeriod, today = todayYmd()) {
  if (today < c.startDate) return { label: "Gepland", progress: 0 };
  if (today > c.endDate) return { label: "Afgelopen", progress: 1 };
  const start = Date.parse(c.startDate);
  const end = Date.parse(c.endDate);
  const now = Date.parse(today);
  return {
    label: "Lopend",
    progress: end > start ? (now - start) / (end - start) : 1,
  };
}

// Drie kerncijfers voor een competitiekaart, passend bij het regeltype.
export function competitionFigures(
  c: CompetitionPeriod,
  sessions: readonly ShootingSession[],
  entries: readonly CompetitionEntry[],
): { label: string; value: string | number; accent?: boolean }[] {
  switch (ruleTypeOf(c)) {
    case "periods": {
      const standings = periodStandings(c, sessions, todayYmd());
      const totals = periodTotals(standings);
      return [
        { label: "Totaal", value: totals.total, accent: true },
        {
          label: "Periode",
          value: `${totals.current ? totals.current.index + 1 : "—"}/${standings.length}`,
        },
        { label: "Beste nu", value: totals.current?.best?.score ?? "—" },
      ];
    }
    case "best_of": {
      const result = bestOfStandings(c, sessions);
      return [
        { label: "Totaal", value: result.total, accent: true },
        { label: "Plekken", value: `${result.slots.length}/${result.size}` },
        { label: "Laagste telt", value: result.threshold ?? "—" },
      ];
    }
    default: {
      const linked = eligibleSessions(c, sessions, entries);
      const summary = summarize(linked);
      return [
        { label: "Wedstrijden", value: linked.length },
        {
          label: "Gemiddelde",
          value: summary ? formatMean(summary.mean) : "—",
        },
        { label: "Hoogste", value: summary ? summary.max : "—", accent: true },
      ];
    }
  }
}
