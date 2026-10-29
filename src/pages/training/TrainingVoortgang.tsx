import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChartCard,
  CountBars,
  TrendLine,
  shortDate,
} from "@/features/training/components/charts";
import {
  Loading,
  PageHeader,
  Segment,
  Stat,
} from "@/features/training/components/ui";
import { addDays, weekStart } from "@/features/training/domain/schedule";
import {
  exerciseRecords,
  monthlyCounts,
  muscleSetCounts,
  volumeKg,
  weekStreak,
  weeklyCounts,
} from "@/features/training/domain/stats";
import { MUSCLE_GROUPS } from "@/features/training/domain/types";
import { MUSCLE_LABELS, formatKg } from "@/features/training/domain/units";
import {
  useBodyMetrics,
  useExercises,
  useHistoryIndex,
  useSessions,
  useSets,
  useToday,
} from "@/features/training/hooks/useTrainingData";

export default function TrainingVoortgang() {
  const sessions = useSessions();
  const sets = useSets();
  const index = useHistoryIndex();
  const body = useBodyMetrics();
  const { lookup, get } = useExercises();
  const { today } = useToday();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [muscleRange, setMuscleRange] = useState<7 | 28>(7);

  const data = useMemo(() => {
    if (!sessions || !sets) return null;
    const completed = sessions.filter((s) => s.status === "completed");
    const weeks = weeklyCounts(sessions, today, 12);
    const months = monthlyCounts(sessions, today, 12);
    const byId = new Map(completed.map((s) => [s.id, s]));
    const weekVolume = weeks.map((w) => {
      const to = addDays(w.weekStart, 6);
      const inWeek = sets.filter((s) => {
        const session = byId.get(s.sessionId);
        return (
          !s.deletedAt &&
          s.kind === "work" &&
          session &&
          session.localDate >= w.weekStart &&
          session.localDate <= to
        );
      });
      return {
        key: w.weekStart,
        label: shortDate(w.weekStart),
        value: volumeKg(inWeek),
      };
    });
    const from = addDays(today, -(muscleRange - 1));
    const muscles = muscleSetCounts(sessions, sets, lookup, from, today);
    const last8 = weeks.slice(-8);
    return {
      completed,
      weeks,
      months,
      weekVolume,
      muscles,
      avg: last8.reduce((n, w) => n + w.count, 0) / last8.length,
      thisMonth: months[months.length - 1].count,
      streak: weekStreak(sessions, today),
    };
  }, [sessions, sets, today, lookup, muscleRange]);

  const exerciseRows = useMemo(() => {
    if (!index) return [];
    return [...index.entries()]
      .map(([id, list]) => ({
        id,
        list,
        exercise: get(id),
        records: exerciseRecords(list),
      }))
      .sort((a, b) => b.list.length - a.list.length)
      .slice(0, 12);
  }, [index, get]);

  if (!data || !body) return <Loading />;
  const maxMuscle = Math.max(
    1,
    ...Object.values(data.muscles).map((v) => v ?? 0),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Voortgang"
        subtitle={`Week begint op maandag · vandaag ${shortDate(today)}`}
      />
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Voltooid"
          value={data.completed.length}
          hint="trainingen totaal"
        />
        <Stat label="Deze maand" value={data.thisMonth} />
        <Stat
          label="Gemiddeld"
          value={data.avg.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}
          hint="per week (8 weken)"
        />
        <Stat
          label="Weken op rij"
          value={data.streak}
          hint="met een training"
        />
      </section>

      <ChartCard
        title={
          period === "week" ? "Trainingen per week" : "Trainingen per maand"
        }
        unit="trainingen"
        data={
          period === "week"
            ? data.weeks.map((w) => ({
                key: w.weekStart,
                label: shortDate(w.weekStart),
                value: w.count,
              }))
            : data.months.map((m) => ({
                key: m.month,
                label: new Date(`${m.month}-15`).toLocaleDateString("nl-NL", {
                  month: "short",
                }),
                value: m.count,
              }))
        }
      >
        <Segment
          label="Periode"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "week", label: "Per week" },
            { value: "month", label: "Per maand" },
          ]}
        />
        <div className="mt-3">
          <CountBars
            unit="trainingen"
            data={
              period === "week"
                ? data.weeks.map((w) => ({
                    key: w.weekStart,
                    label: shortDate(w.weekStart),
                    value: w.count,
                  }))
                : data.months.map((m) => ({
                    key: m.month,
                    label: new Date(`${m.month}-15`).toLocaleDateString(
                      "nl-NL",
                      { month: "short" },
                    ),
                    value: m.count,
                  }))
            }
          />
        </div>
      </ChartCard>

      <ChartCard
        title="Totaal volume per week"
        subtitle="Som van gewicht × herhalingen van alle werksets (dumbbells: gewicht per dumbbell)."
        unit="kg"
        data={data.weekVolume}
      >
        <CountBars unit="kg" data={data.weekVolume} />
      </ChartCard>

      <section className="tr-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="tr-h2">Werksets per spiergroep</h3>
          <Segment
            label="Periode"
            value={muscleRange}
            onChange={setMuscleRange}
            options={[
              { value: 7, label: "7 dagen" },
              { value: 28, label: "28 dagen" },
            ]}
          />
        </div>
        <p className="tr-muted mt-1 text-xs">
          Telregel: elke werkset telt 1 voor de primaire spiergroepen en ½ voor
          de secundaire. Opwarmsets tellen niet.
        </p>
        <ul className="mt-3 space-y-1.5">
          {MUSCLE_GROUPS.map((m) => {
            const value = data.muscles[m] ?? 0;
            return (
              <li
                key={m}
                className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-sm"
              >
                <span className="tr-ink-2">{MUSCLE_LABELS[m]}</span>
                <span className="tr-progress h-2.5" aria-hidden="true">
                  <span
                    style={{
                      width: `${(value / maxMuscle) * 100}%`,
                      background: "var(--tr-chart-1)",
                    }}
                  />
                </span>
                <span className="tr-num text-right font-semibold">
                  {value.toLocaleString("nl-NL")}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {body.filter((b) => b.weightKg !== null).length > 1 && (
        <ChartCard
          title="Lichaamsgewicht"
          unit="kg"
          data={body
            .filter((b) => b.weightKg !== null)
            .map((b) => ({
              key: b.id,
              label: shortDate(b.measuredOn),
              value: b.weightKg,
            }))}
          subtitle={
            <Link to="/training/lichaam" className="tr-aqua-text font-semibold">
              Gewicht bijhouden →
            </Link>
          }
        >
          <TrendLine
            unit="kg"
            data={body
              .filter((b) => b.weightKg !== null)
              .map((b) => ({
                key: b.id,
                label: shortDate(b.measuredOn),
                value: b.weightKg,
              }))}
          />
        </ChartCard>
      )}

      <section className="tr-card p-4">
        <h3 className="tr-h2">Oefeningen en records</h3>
        {exerciseRows.length === 0 ? (
          <p className="tr-muted mt-2 text-sm">
            Nog geen afgeronde trainingen.
          </p>
        ) : (
          <ul
            className="mt-2 divide-y"
            style={{ borderColor: "var(--tr-border)" }}
          >
            {exerciseRows.map(({ id, list, exercise, records }) => {
              const first = list[list.length - 1];
              const latest = list[0];
              const top = (p: typeof latest) =>
                Math.max(...p.work.map((s) => s.weightKg ?? 0));
              const delta =
                exercise.tracking === "weight_reps"
                  ? top(latest) - top(first)
                  : null;
              return (
                <li key={id}>
                  <Link
                    to={`/training/oefeningen/${id}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {exercise.name}
                      </span>
                      <span className="tr-muted text-xs">
                        {list.length}× gedaan · laatst {shortDate(latest.date)}
                      </span>
                    </span>
                    <span className="tr-num shrink-0 text-right text-sm">
                      {exercise.tracking === "weight_reps" &&
                      records.heaviest ? (
                        <>
                          <span className="block font-semibold">
                            {formatKg(records.heaviest.value)} kg
                          </span>
                          {delta !== null && delta !== 0 && (
                            <span className="tr-aqua-text text-xs">
                              {delta > 0 ? "+" : ""}
                              {formatKg(delta)} kg sinds start
                            </span>
                          )}
                        </>
                      ) : records.mostReps ? (
                        <span className="font-semibold">
                          {records.mostReps.value} herh.
                        </span>
                      ) : records.longest ? (
                        <span className="font-semibold">
                          {records.longest.value} s
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="tr-muted text-center text-xs">
        Statistiek over voltooide trainingen van week{" "}
        {shortDate(weekStart(today))}.
      </p>
    </div>
  );
}
