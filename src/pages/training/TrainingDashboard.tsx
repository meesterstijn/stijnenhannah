import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Play,
  Trophy,
} from "lucide-react";
import { CountBars, shortDate } from "@/features/training/components/charts";
import { Loading, Sheet, Stat } from "@/features/training/components/ui";
import { estimateMinutes } from "@/features/training/domain/generator";
import {
  planToday,
  weekOverview,
  weekdayOf,
} from "@/features/training/domain/schedule";
import {
  latestRecords,
  sessionSummary,
  weekStreak,
  weeklyCounts,
} from "@/features/training/domain/stats";
import type { MuscleGroup, ProgramDay } from "@/features/training/domain/types";
import {
  MUSCLE_LABELS,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  formatKg,
} from "@/features/training/domain/units";
import {
  useActiveProgram,
  useExercises,
  useHistoryIndex,
  useOpenSession,
  useSessions,
  useSets,
  useToday,
} from "@/features/training/hooks/useTrainingData";
import { useWorkoutActions } from "@/features/training/hooks/useWorkoutActions";
import { describeValues } from "@/features/training/workout/SetControls";

const RECORD_LABELS = {
  heaviest: "Zwaarste set",
  e1rm: "Hoogste geschatte 1RM",
  volume: "Meeste volume",
  reps: "Meeste herhalingen",
  duration: "Langste duur",
};

export default function TrainingDashboard() {
  const program = useActiveProgram();
  const sessions = useSessions();
  const sets = useSets();
  const open = useOpenSession();
  const index = useHistoryIndex();
  const { get } = useExercises();
  const { today } = useToday();
  const actions = useWorkoutActions();
  const [pickDay, setPickDay] = useState(false);

  const plan = useMemo(
    () => (program && sessions ? planToday(program, sessions, today) : null),
    [program, sessions, today],
  );
  const week = useMemo(
    () => weekOverview(program ?? null, sessions ?? [], today),
    [program, sessions, today],
  );
  const counts = useMemo(
    () => weeklyCounts(sessions ?? [], today, 8),
    [sessions, today],
  );
  const streak = useMemo(
    () => weekStreak(sessions ?? [], today),
    [sessions, today],
  );
  const records = useMemo(
    () =>
      index ? latestRecords(index, (id) => get(id).tracking).slice(0, 4) : [],
    [index, get],
  );
  const recent = useMemo(() => {
    const last = sessions?.find((s) => s.status === "completed");
    if (!last || !index) return null;
    const exercises = last.snapshot.exercises
      .filter((e) => !e.removed)
      .map((e) => ({
        e,
        perf: index.get(e.exerciseId)?.find((p) => p.sessionId === last.id),
      }))
      .filter((x) => x.perf);
    return {
      session: last,
      exercises,
      summary: sessionSummary(last, sets ?? []),
    };
  }, [sessions, index, sets]);

  if (program === undefined || sessions === undefined) return <Loading />;

  const dayLabel = new Date(`${today}T12:00:00`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const day = plan?.day ?? null;

  return (
    <div className="space-y-5">
      <div>
        <p className="tr-muted text-sm capitalize">{dayLabel}</p>
        <h1 className="tr-h1">Vandaag</h1>
      </div>

      {!program ? (
        <section className="tr-card space-y-3 p-5">
          <p className="tr-label">Nog geen schema</p>
          <h2 className="text-xl font-bold">Kies je trainingsschema</h2>
          <p className="tr-ink-2">
            Full Body (3 dagen), een vijfdaagse split of Push/Pull/Legs (6
            dagen), afgestemd op jouw niveau, doel en apparatuur. Daarna zie je
            hier elke dag precies wat je moet doen.
          </p>
          <Link
            to="/training/schemas"
            className="tr-btn tr-btn-primary tr-btn-lg"
          >
            Schema kiezen
          </Link>
        </section>
      ) : (
        <TodayCard
          programName={program.name}
          day={day}
          openName={open?.name ?? null}
          plan={plan!}
          get={get}
          onStart={(d) => void actions.begin({ program, day: d })}
          onSkip={(d) => void actions.skip(program, d)}
          onOther={() => setPickDay(true)}
        />
      )}

      {/* Deze week */}
      <section className="tr-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="tr-h2">Deze week</h2>
          <span className="tr-num text-sm font-semibold">
            {week.completedCount}
            {week.plannedCount > 0 && ` van ${week.plannedCount}`} gedaan
          </span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {week.days.map((d) => {
            const doneHere = d.sessions.length > 0;
            const planned = d.planned.length > 0;
            return (
              <div key={d.date} className="flex flex-col items-center gap-1">
                <span
                  className={`text-xs ${d.isToday ? "font-bold" : "tr-muted"}`}
                >
                  {WEEKDAY_SHORT[d.weekday]}
                </span>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: doneHere
                      ? "var(--tr-aqua)"
                      : "var(--tr-surface-2)",
                    color: doneHere ? "var(--tr-on-aqua)" : "var(--tr-ink-2)",
                    outline: d.isToday
                      ? "2px solid var(--tr-grape)"
                      : undefined,
                    outlineOffset: 1,
                    border:
                      planned && !doneHere
                        ? "2px dashed var(--tr-steel)"
                        : undefined,
                  }}
                  title={[
                    ...d.planned.map((p) => `Gepland: ${p.name}`),
                    ...d.sessions.map((s) => `Gedaan: ${s.name}`),
                  ].join("\n")}
                >
                  {doneHere ? "✓" : Number(d.date.slice(8))}
                </span>
              </div>
            );
          })}
        </div>
        <p className="tr-muted mt-3 text-sm">
          {plan?.upcoming
            ? `Volgende: ${plan.upcoming.day.name}, ${WEEKDAY_LONG[weekdayOf(plan.upcoming.date)]} ${shortDate(plan.upcoming.date)}`
            : program
              ? program.content.scheduleMode === "sequence"
                ? "Doorlopende volgorde: de volgende training staat altijd klaar."
                : ""
              : ""}
          <span className="sr-only">
            {" "}
            Gestippeld = gepland, groen = gedaan.
          </span>
        </p>
      </section>

      {/* Voortgang compact */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Weken op rij"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Flame className="tr-aqua-text h-5 w-5" />
              {streak}
            </span>
          }
          hint="met minstens één training"
        />
        <Stat
          label="Trainingen totaal"
          value={sessions.filter((s) => s.status === "completed").length}
        />
        <Stat
          label="Laatste training"
          value={recent ? shortDate(recent.session.localDate) : "–"}
          hint={
            recent
              ? `${recent.summary.workSets} sets · ${formatKg(recent.summary.volumeKg)} kg volume`
              : undefined
          }
        />
      </section>

      <section className="tr-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="tr-h2">Trainingen per week</h2>
          <Link
            to="/training/voortgang"
            className="tr-aqua-text text-sm font-semibold"
          >
            Voortgang →
          </Link>
        </div>
        <CountBars
          height={130}
          unit="trainingen"
          data={counts.map((c) => ({
            key: c.weekStart,
            label: shortDate(c.weekStart),
            value: c.count,
            detail: `week van ${shortDate(c.weekStart)}`,
          }))}
        />
      </section>

      {/* Laatste prestaties */}
      {(records.length > 0 || recent) && (
        <section className="tr-card space-y-3 p-4">
          <h2 className="tr-h2">Laatste prestaties</h2>
          {records.length > 0 && (
            <ul className="space-y-1.5">
              {records.map((r) => (
                <li
                  key={`${r.exerciseId}-${r.kind}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Trophy className="tr-aqua-text h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    <strong>Nieuw record</strong> · {get(r.exerciseId).name}:{" "}
                    {RECORD_LABELS[r.kind]}{" "}
                    <span className="tr-num font-semibold">
                      {r.kind === "duration"
                        ? `${r.value} s`
                        : r.kind === "reps"
                          ? `${r.value} herh.`
                          : `${formatKg(r.value)} kg`}
                    </span>
                  </span>
                  <span className="tr-muted text-xs">{shortDate(r.date)}</span>
                </li>
              ))}
            </ul>
          )}
          {recent && (
            <div>
              <Link
                to={`/training/historie/${recent.session.id}`}
                className="flex items-center justify-between text-sm font-semibold"
              >
                <span>
                  {recent.session.name} · {shortDate(recent.session.localDate)}
                </span>
                <ChevronRight className="tr-muted h-4 w-4" />
              </Link>
              <ul className="mt-2 space-y-1">
                {recent.exercises.slice(0, 6).map(({ e, perf }) => (
                  <li
                    key={e.slot}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="tr-ink-2 truncate">{e.name}</span>
                    <span className="tr-num shrink-0 font-medium">
                      {perf!.work.length} ×{" "}
                      {describeValues(e.tracking, perf!.work[0])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {program && (
        <Sheet
          open={pickDay}
          onClose={() => setPickDay(false)}
          title="Welke training wil je doen?"
        >
          <p className="tr-muted text-sm">
            Een andere dag starten verandert je planning niet; het telt als die
            training.
          </p>
          <ul className="space-y-2">
            {program.content.days.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="tr-card-flat flex w-full items-center justify-between gap-3 p-3 text-left"
                  onClick={() => {
                    setPickDay(false);
                    void actions.begin({ program, day: d });
                  }}
                >
                  <span>
                    <span className="block font-semibold">{d.name}</span>
                    <span className="tr-muted text-xs">
                      {d.exercises.length} oefeningen · ~
                      {estimateMinutes(d.exercises)} min
                      {d.weekdays.length > 0 &&
                        ` · ${d.weekdays.map((w) => WEEKDAY_SHORT[w]).join(", ")}`}
                    </span>
                  </span>
                  <Play className="tr-aqua-text h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}

function TodayCard({
  programName,
  day,
  openName,
  plan,
  get,
  onStart,
  onSkip,
  onOther,
}: {
  programName: string;
  day: ProgramDay | null;
  openName: string | null;
  plan: ReturnType<typeof planToday>;
  get: ReturnType<typeof useExercises>["get"];
  onStart: (day: ProgramDay) => void;
  onSkip: (day: ProgramDay) => void;
  onOther: () => void;
}) {
  const muscles = useMemo(() => {
    const set = new Set<MuscleGroup>();
    day?.exercises.forEach((e) =>
      get(e.exerciseId).primary.forEach((m) => set.add(m)),
    );
    return [...set];
  }, [day, get]);

  if (openName) {
    return (
      <section className="tr-card space-y-3 p-5">
        <p className="tr-label">Training bezig</p>
        <h2 className="text-2xl font-bold">{openName}</h2>
        <Link
          to="/training/workout"
          className="tr-btn tr-btn-primary tr-btn-lg tr-btn-block"
        >
          <Play className="h-5 w-5" /> Training hervatten
        </Link>
      </section>
    );
  }

  const isMissed =
    day && plan.missed.some((m) => m.id === day.id) && !plan.restDay;
  const title =
    plan.doneToday && !day
      ? "Vandaag voltooid"
      : plan.restDay && !day
        ? "Rustdag"
        : (day?.name ?? "Rustdag");

  return (
    <section className="tr-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tr-label">{programName}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
          {day?.focus && <p className="tr-muted text-sm">{day.focus}</p>}
          {isMissed && (
            <p className="tr-chip tr-chip-warn mt-2">
              Gemist eerder deze week, nu inhalen?
            </p>
          )}
        </div>
        <CalendarCheck className="tr-aqua-text h-7 w-7 shrink-0" />
      </div>

      {day ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {muscles.map((m) => (
              <span key={m} className="tr-chip">
                {MUSCLE_LABELS[m]}
              </span>
            ))}
          </div>
          <div className="tr-ink-2 flex gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Dumbbell className="h-4 w-4" /> {day.exercises.length} oefeningen
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> ~{estimateMinutes(day.exercises)}{" "}
              min
            </span>
          </div>
          <button
            type="button"
            className="tr-btn tr-btn-primary tr-btn-lg tr-btn-block"
            onClick={() => onStart(day)}
          >
            <Play className="h-5 w-5" /> Start training
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="tr-btn tr-btn-quiet"
              onClick={onOther}
            >
              Andere training kiezen
            </button>
            <button
              type="button"
              className="tr-btn tr-btn-quiet"
              onClick={() => onSkip(day)}
            >
              Overslaan
            </button>
          </div>
          {plan.missed.length > 1 && (
            <p className="tr-muted text-sm">
              Ook nog open deze week:{" "}
              {plan.missed
                .filter((m) => m.id !== day.id)
                .map((m) => m.name)
                .join(", ")}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="tr-ink-2">
            {plan.doneToday
              ? "Goed bezig. Herstel hoort bij de training."
              : "Geen training gepland. Herstel is ook trainen."}
            {plan.upcoming &&
              ` Volgende: ${plan.upcoming.day.name} (${WEEKDAY_LONG[weekdayOf(plan.upcoming.date)]}).`}
          </p>
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            onClick={onOther}
          >
            Toch trainen
          </button>
        </>
      )}
    </section>
  );
}
