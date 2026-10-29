import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shortDate } from "@/features/training/components/charts";
import {
  Loading,
  PageHeader,
  Segment,
} from "@/features/training/components/ui";
import { addDays, weekStart } from "@/features/training/domain/schedule";
import { sessionSummary } from "@/features/training/domain/stats";
import {
  STATUS_LABELS,
  WEEKDAY_SHORT,
  formatKg,
} from "@/features/training/domain/units";
import {
  useSessions,
  useSets,
  useToday,
} from "@/features/training/hooks/useTrainingData";

export default function TrainingHistorie() {
  const sessions = useSessions();
  const sets = useSets();
  const { today } = useToday();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(
    () =>
      (sessions ?? []).filter(
        (s) =>
          showAll ||
          s.status === "completed" ||
          s.status === "paused" ||
          s.status === "active",
      ),
    [sessions, showAll],
  );

  if (!sessions || !sets) return <Loading />;

  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const gridStart = weekStart(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Historie"
        subtitle={`${sessions.filter((s) => s.status === "completed").length} voltooide trainingen`}
      />
      <Segment
        label="Weergave"
        value={view}
        onChange={setView}
        options={[
          { value: "list", label: "Lijst" },
          { value: "calendar", label: "Kalender" },
        ]}
      />

      {view === "calendar" ? (
        <section className="tr-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="tr-icon-btn"
              onClick={() => shiftMonth(-1)}
              aria-label="Vorige maand"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="tr-h2 capitalize">
              {new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("nl-NL", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              type="button"
              className="tr-icon-btn"
              onClick={() => shiftMonth(1)}
              aria-label="Volgende maand"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="tr-cal mb-1">
            {WEEKDAY_SHORT.map((w) => (
              <div
                key={w}
                className="tr-muted text-center text-xs font-semibold"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="tr-cal">
            {days.map((d) => {
              const onDay = sessions.filter((s) => s.localDate === d);
              const done = onDay.find((s) => s.status === "completed");
              const skipped = onDay.some((s) => s.status === "skipped");
              const content = (
                <>
                  <span>{Number(d.slice(8))}</span>
                  {done && (
                    <span className="text-[9px] leading-none">
                      {onDay.filter((s) => s.status === "completed").length > 1
                        ? "2×"
                        : "●"}
                    </span>
                  )}
                </>
              );
              return done ? (
                <Link
                  key={d}
                  to={`/training/historie/${done.id}`}
                  className="tr-cal-day"
                  data-done="true"
                  data-today={d === today}
                  data-outside={!d.startsWith(month)}
                  aria-label={`${d}: ${done.name}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={d}
                  className="tr-cal-day"
                  data-today={d === today}
                  data-skipped={skipped}
                  data-outside={!d.startsWith(month)}
                >
                  {content}
                </div>
              );
            })}
          </div>
          <p className="tr-muted mt-3 text-xs">
            Gekleurd = training voltooid · grijs = overgeslagen
          </p>
        </section>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Ook geannuleerde en overgeslagen trainingen tonen
          </label>
          <ul className="space-y-2">
            {visible.map((s) => {
              const summary = sessionSummary(s, sets);
              return (
                <li key={s.id}>
                  <Link
                    to={
                      s.status === "active" || s.status === "paused"
                        ? "/training/workout"
                        : `/training/historie/${s.id}`
                    }
                    className="tr-card flex items-center gap-3 p-3"
                  >
                    <div className="tr-card-flat flex h-12 w-12 shrink-0 flex-col items-center justify-center">
                      <span className="text-sm font-bold leading-none">
                        {Number(s.localDate.slice(8))}
                      </span>
                      <span className="tr-muted text-[10px] uppercase">
                        {shortDate(s.localDate).split(" ")[1]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{s.name}</div>
                      <div className="tr-muted truncate text-sm">
                        {s.status !== "completed"
                          ? STATUS_LABELS[s.status]
                          : `${summary.workSets} sets · ${formatKg(summary.volumeKg)} kg${summary.durationMin !== null ? ` · ${summary.durationMin} min` : ""}`}
                        {s.snapshot.programName &&
                          ` · ${s.snapshot.programName}`}
                      </div>
                    </div>
                    <ChevronRight className="tr-muted h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && (
            <p className="tr-muted py-8 text-center">Nog geen trainingen.</p>
          )}
        </>
      )}
    </div>
  );
}
