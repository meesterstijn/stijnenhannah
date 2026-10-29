import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import type {
  CompetitionPeriod,
  Discipline,
  Weapon,
} from "@/features/schietsport/domain/model";
import type { LocalRecord } from "@/features/schietsport/db/database";
import { scaleFor } from "@/features/schietsport/domain/rules";
import {
  bestOfStandings,
  eligibleSessions,
  periodStandings,
  periodTotals,
  sessionTypeOf,
  type PeriodStatus,
} from "@/features/schietsport/domain/competition";
import {
  Panel,
  StatCard,
} from "@/features/schietsport/components/SchietsportSurface";
import { SessionRow } from "@/features/schietsport/components/SessionRow";
import {
  formatDate,
  formatDateShort,
  formatMean,
  todayYmd,
} from "@/features/schietsport/lib/format";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

type Props = {
  competition: CompetitionPeriod;
  sessions: LocalRecord<"session">[];
  weapons: readonly Weapon[];
  disciplines: readonly Discipline[];
};

const STATUS_LABEL: Record<PeriodStatus, string> = {
  upcoming: "Gepland",
  open: "Lopend",
  closed: "Afgesloten",
};

function SessionList({
  title,
  sessions,
  badge,
  weapons,
  disciplines,
}: {
  title: string;
  sessions: LocalRecord<"session">[];
  badge: (id: string) => string | null;
  weapons: readonly Weapon[];
  disciplines: readonly Discipline[];
}) {
  return (
    <Panel title={title}>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nog geen schietbeurten die meetellen.
        </p>
      ) : (
        <div className="-mx-2 divide-y divide-white/5">
          {[...sessions].reverse().map((session) => {
            const label = badge(session.id);
            return (
              <div key={session.id} className="flex items-center">
                <div className="min-w-0 flex-1">
                  <SessionRow
                    session={session}
                    weapons={weapons}
                    disciplines={disciplines}
                  />
                </div>
                {label && (
                  <span className="mr-2 shrink-0 rounded-full bg-[oklch(0.7_0.115_58/0.16)] px-2 py-0.5 text-[0.65rem] text-[var(--ss-copper)]">
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ── Puntenbord ────────────────────────────────────────────────────────

export function PeriodsView({
  competition,
  sessions,
  weapons,
  disciplines,
}: Props) {
  const scale = scaleFor(sessionTypeOf(competition));
  const standings = periodStandings(competition, sessions, todayYmd());
  const totals = periodTotals(standings);
  const bestIds = new Map(
    standings.flatMap((p) =>
      p.best?.sessionId ? [[p.best.sessionId, p.index + 1] as const] : [],
    ),
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Eindstand"
          tone="copper"
          value={totals.total}
          detail="som van de periodes"
        />
        <StatCard
          label="Gemiddelde"
          value={totals.average !== null ? formatMean(totals.average) : "—"}
          suffix={totals.average !== null ? `/${scale}` : undefined}
          detail="per periode met score"
        />
        <StatCard
          label="Huidige periode"
          value={totals.current ? totals.current.index + 1 : "—"}
          detail={
            totals.current
              ? `beste nu ${totals.current.best?.score ?? "—"} · t/m ${formatDateShort(totals.current.end)}`
              : "geen lopende periode"
          }
        />
        <StatCard
          label="Periodes met score"
          value={`${totals.counted}/${standings.length}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {standings.map((period) => (
          <div
            key={period.index}
            className={`ss-card p-4 ${
              period.status === "open"
                ? "shadow-[inset_0_0_0_1px_oklch(0.7_0.115_58/0.55)]"
                : ""
            } ${period.status === "upcoming" ? "opacity-70" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Periode {period.index + 1}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[0.7rem] text-muted-foreground">
                {period.status === "closed" && !period.historic && (
                  <Lock className="h-3 w-3" />
                )}
                {period.historic
                  ? "Aan te vullen"
                  : STATUS_LABEL[period.status]}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(period.start)} – {formatDate(period.end)}
            </p>
            <p className="ss-number mt-3">
              <span
                className={`text-3xl font-semibold ${period.best ? "" : "text-muted-foreground"}`}
              >
                {period.best ? period.best.score : "—"}
              </span>
              <span className="text-sm text-muted-foreground">/{scale}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {period.sessionCount}{" "}
              {period.sessionCount === 1 ? "schietbeurt" : "schietbeurten"}
              {period.best?.sessionId && (
                <>
                  {" · "}
                  <Link
                    to={`${SCHIETSPORT_BASE}/logboek/${period.best.sessionId}`}
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    beste beurt
                  </Link>
                </>
              )}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        De hoogste score binnen een periode telt. Een afgesloten periode ligt
        vast: later ingevoerde of bewerkte schietbeurten veranderen die score
        niet meer. Periodes die al voorbij waren toen je de competitie
        aanmaakte, kun je aanvullen met oude uitslagen.
      </p>

      <SessionList
        title="Schietbeurten die meetellen"
        sessions={eligibleSessions(competition, sessions)}
        badge={(id) =>
          bestIds.has(id) ? `beste periode ${bestIds.get(id)}` : null
        }
        weapons={weapons}
        disciplines={disciplines}
      />
    </>
  );
}

// ── Beste N ───────────────────────────────────────────────────────────

export function BestOfView({
  competition,
  sessions,
  weapons,
  disciplines,
}: Props) {
  const scale = scaleFor(sessionTypeOf(competition));
  const result = bestOfStandings(competition, sessions);
  const empty = Array.from({ length: result.size - result.slots.length });

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Totaal"
          tone="copper"
          value={result.total}
          detail={`som van de beste ${result.size}`}
        />
        <StatCard
          label="Gemiddelde"
          value={result.average !== null ? formatMean(result.average) : "—"}
          suffix={result.average !== null ? `/${scale}` : undefined}
        />
        <StatCard
          label="Laagste die telt"
          value={result.threshold ?? "—"}
          detail={
            result.threshold !== null
              ? "een hogere score vervangt deze"
              : "plekken nog niet vol"
          }
        />
        <StatCard
          label="Plekken"
          value={`${result.slots.length}/${result.size}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {result.slots.map((slot, index) => (
          <Link
            key={slot.sessionId}
            to={`${SCHIETSPORT_BASE}/logboek/${slot.sessionId}`}
            className="ss-card ss-card-interactive p-4"
          >
            <p className="text-xs text-muted-foreground">#{index + 1}</p>
            <p className="ss-number mt-1">
              <span className="text-3xl font-semibold">{slot.score}</span>
              <span className="text-sm text-muted-foreground">/{scale}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(slot.sessionDate)}
            </p>
          </Link>
        ))}
        {empty.map((_, index) => (
          <div
            key={`leeg-${index}`}
            className="flex flex-col justify-center rounded-[1.25rem] border border-dashed border-white/10 p-4 text-sm text-muted-foreground"
          >
            Nog leeg
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        De eerste {result.size} scores vullen de plekken. Daarna vervangt een
        nieuwe score je laagste, maar alleen als die hoger is.
      </p>

      <SessionList
        title="Schietbeurten die meetellen"
        sessions={eligibleSessions(competition, sessions)}
        badge={(id) => (result.counted.has(id) ? "telt" : null)}
        weapons={weapons}
        disciplines={disciplines}
      />
    </>
  );
}
