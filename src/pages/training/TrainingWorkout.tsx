import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Disc3,
  Info,
  ListChecks,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Replace,
  SkipForward,
  Timer,
  Trash2,
  Undo2,
} from "lucide-react";
import { useWakeLock } from "@/features/guitar/hooks/useWakeLock";
import { ExerciseInfo, ExercisePicker } from "@/features/training/components/ExercisePicker";
import { PlateCalculator } from "@/features/training/components/PlateCalculator";
import { EmptyState, Loading, NumberField, Sheet } from "@/features/training/components/ui";
import {
  completeSet,
  editSet,
  setExercisePref,
  setSessionStatus,
  undoSet,
  updateSession,
  updateSnapshot,
} from "@/features/training/db/repository";
import { performances, progressionHint } from "@/features/training/domain/performance";
import { smallestStep } from "@/features/training/domain/plates";
import {
  addExercise,
  addSet,
  moveExercise,
  patchExercise,
  removeExercise,
  removeSet,
  replaceExercise,
  setValuesForward,
} from "@/features/training/domain/session-edit";
import type { Exercise, SessionExercise, SetValues, TrainingSession, TrainingSet } from "@/features/training/domain/types";
import { formatClock, formatDuration, formatKg } from "@/features/training/domain/units";
import {
  LIMITS,
  activeExercises,
  adHocPlan,
  doneMap,
  nextOpenPosition,
  positionKey,
  sessionExercise,
  validateSetValues,
  valuesAt,
  workProgress,
  type Position,
} from "@/features/training/domain/workout";
import { useRestTimer } from "@/features/training/hooks/RestTimer";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import { useExercises, useHistoryIndex, useOpenSession, useProfile, useSessionSets } from "@/features/training/hooks/useTrainingData";
import { useWorkoutActions } from "@/features/training/hooks/useWorkoutActions";
import { RestPanel } from "@/features/training/workout/RestPanel";
import { SetList, SetValueFields, Stepper, describeValues } from "@/features/training/workout/SetControls";

export default function TrainingWorkout() {
  const session = useOpenSession();
  const sets = useSessionSets(session?.id);
  if (session === undefined || (session && sets === undefined)) return <Loading />;
  if (!session) {
    return (
      <div className="pt-10">
        <EmptyState title="Geen training bezig" action={<Link to="/training" className="tr-btn tr-btn-primary">Naar vandaag</Link>}>
          Start een training vanaf het dashboard of kies een dag bij je schema.
        </EmptyState>
      </div>
    );
  }
  return <Workout key={session.id} session={session} sets={sets!} />;
}

const restLabel = (sec: number) => formatClock(sec);

function useElapsed(startedAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, (now - Date.parse(startedAt)) / 1000);
}

function Workout({ session, sets }: { session: TrainingSession; sets: TrainingSet[] }) {
  const { db, userId } = useTraining();
  const navigate = useNavigate();
  const profile = useProfile();
  const { get, lookup } = useExercises();
  const index = useHistoryIndex();
  const timer = useRestTimer();
  const wake = useWakeLock();
  const { context } = useWorkoutActions();
  const snapshot = session.snapshot;
  const done = useMemo(() => doneMap(sets, session.id), [sets, session.id]);
  const elapsed = useElapsed(session.startedAt);

  const valid = (p: Position | null | undefined): p is Position =>
    !!p && !!valuesAt(snapshot, p) && !snapshot.exercises.find((e) => e.slot === p.slot)?.removed && !done.has(positionKey(p));
  const [cursor, setCursor] = useState<Position | null>(() =>
    valid(snapshot.cursor) ? snapshot.cursor : nextOpenPosition(snapshot, done),
  );
  // Cursor ongeldig geworden (set elders voltooid, oefening weg): door naar de eerstvolgende.
  useEffect(() => {
    if (cursor && !valid(cursor)) setCursor(nextOpenPosition(snapshot, done, cursor));
    if (!cursor) {
      const next = nextOpenPosition(snapshot, done);
      if (next) setCursor(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, done]);

  const [restOpen, setRestOpen] = useState(() => timer.state.status !== "idle");
  const [lastDone, setLastDone] = useState<{ id: string; position: Position; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "menu" | "info" | "rest" | "replace" | "add" | "plates" | "note" | "sessionNote" | "overview" | "finish" | "cancel">(null);
  const [editing, setEditing] = useState<Position | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (session.status === "active" && profile.settings.keepAwake) void wake.request();
    return () => void wake.release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, profile.settings.keepAwake]);

  const exercises = activeExercises(snapshot);
  const current = cursor ? snapshot.exercises.find((e) => e.slot === cursor.slot) ?? null : null;
  const shownExercise = current ?? exercises[exercises.length - 1] ?? null;
  const values = cursor ? valuesAt(snapshot, cursor) : null;
  const progress = workProgress(snapshot, done);
  const exerciseIndex = shownExercise ? exercises.findIndex((e) => e.slot === shownExercise.slot) : -1;
  const nextExercise = exerciseIndex >= 0 ? exercises[exerciseIndex + 1] : undefined;

  const persist = (change: (s: typeof snapshot) => typeof snapshot) => updateSnapshot(db, session.id, change);

  const setField = (field: keyof SetValues, value: number | null) => {
    if (!cursor || !values) return;
    setError(null);
    void persist((s) => setValuesForward(s, cursor, { ...values, [field]: value }, done, field));
  };

  const complete = async () => {
    if (!cursor || !current || !values || busy.current) return;
    const problem = validateSetValues(current.tracking, values);
    if (problem) {
      setError(problem);
      return;
    }
    busy.current = true;
    try {
      const { set } = await completeSet(db, userId, {
        sessionId: session.id,
        position: cursor,
        exerciseId: current.exerciseId,
        tracking: current.tracking,
        values,
      });
      const after = new Map(done);
      after.set(positionKey(cursor), set);
      const next = nextOpenPosition(snapshot, after, cursor);
      setLastDone({
        id: set.id,
        position: cursor,
        text: `${cursor.kind === "warmup" ? "Opwarmset" : "Set"} ${cursor.index + 1} · ${describeValues(current.tracking, values, current.perSide)}`,
      });
      setCursor(next);
      void persist((s) => ({ ...s, cursor: next }));
      if (next) {
        timer.start(current.restSec, current.name, current.slot);
        setRestOpen(true);
      } else {
        timer.stop();
        setSheet("finish");
      }
    } finally {
      // Korte vergrendeling tegen dubbel tikken; de opslag zelf is ook
      // idempotent per positie.
      setTimeout(() => {
        busy.current = false;
      }, 350);
    }
  };

  const undo = async () => {
    if (!lastDone) return;
    await undoSet(db, lastDone.id);
    timer.stop();
    setRestOpen(false);
    setCursor(lastDone.position);
    void persist((s) => ({ ...s, cursor: lastDone.position }));
    setLastDone(null);
  };

  const makeExercise = async (exercise: Exercise, slot: number, base?: SessionExercise): Promise<SessionExercise> => {
    const ctx = await context();
    const plan = base
      ? { sets: base.work.length, warmupSets: 0, repMin: base.repMin, repMax: base.repMax, durationSec: base.durationSec, restSec: exercise.defaultRestSec, startWeightKg: null }
      : adHocPlan(exercise);
    const timed = exercise.tracking === "duration" || exercise.tracking === "jump_rope";
    return sessionExercise(
      slot,
      exercise,
      { ...plan, repMin: timed ? null : plan.repMin ?? 8, repMax: timed ? null : plan.repMax ?? 12, durationSec: timed ? plan.durationSec ?? 30 : null },
      ctx,
      session.programId,
    );
  };

  const finish = async () => {
    const open = progress.total - progress.completed;
    await setSessionStatus(db, session.id, "completed", { endedEarly: open > 0 });
    timer.stop();
    void wake.release();
    navigate(`/training/historie/${session.id}?klaar=1`, { replace: true });
  };

  const previous = useMemo(() => {
    if (!index || !shownExercise) return null;
    return performances(index, shownExercise.exerciseId, {
      scope: profile.settings.historyScope,
      programId: session.programId,
      excludeSessionId: session.id,
    });
  }, [index, shownExercise, profile.settings.historyScope, session.programId, session.id]);
  const hint =
    profile.settings.progressionHints && previous && shownExercise ? progressionHint(previous, shownExercise.tracking) : null;
  const exerciseInfo = shownExercise ? get(shownExercise.exerciseId, shownExercise.name) : null;
  const note = shownExercise ? profile.exercisePrefs[shownExercise.exerciseId]?.notes : undefined;
  const step = shownExercise ? smallestStep(profile.equipment.plates, shownExercise.loadMode) : 1;

  const nextLabel = (() => {
    if (!cursor) return null;
    const e = snapshot.exercises.find((x) => x.slot === cursor.slot);
    const v = valuesAt(snapshot, cursor);
    if (!e || !v) return null;
    return `${e.name} · ${cursor.kind === "warmup" ? "opwarmset" : "set"} ${cursor.index + 1} · ${describeValues(e.tracking, v, e.perSide)}`;
  })();

  const problem = current && values ? validateSetValues(current.tracking, values) : null;
  const isLast = cursor ? nextOpenPosition(snapshot, new Map(done).set(positionKey(cursor), {} as TrainingSet), cursor) === null : false;

  return (
    <div className="mx-auto max-w-xl">
      {/* Kop: training, tijd, voortgang */}
      <header className="sticky top-0 z-30 -mx-4 mb-3 px-4 pb-2 pt-3" style={{ background: "var(--tr-bg)" }}>
        <div className="flex items-center gap-2">
          <Link to="/training" className="tr-icon-btn -ml-2" aria-label="Naar dashboard (training loopt door)">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold leading-tight">{session.name}</div>
            <div className="tr-muted tr-num text-sm">
              {formatClock(elapsed)} · {progress.completed} van {progress.total} werksets
              {session.status === "paused" && " · onderbroken"}
            </div>
          </div>
          {timer.state.status !== "idle" && !restOpen && (
            <button type="button" className="tr-chip tr-chip-aqua tr-num" onClick={() => setRestOpen(true)}>
              <Timer className="h-4 w-4" />
              {timer.finished ? "Klaar" : formatClock(timer.remainingMs / 1000)}
            </button>
          )}
          <button type="button" className="tr-icon-btn" onClick={() => setSheet("overview")} aria-label="Overzicht oefeningen">
            <ListChecks className="h-5 w-5" />
          </button>
          <button type="button" className="tr-icon-btn -mr-2" onClick={() => setSheet("menu")} aria-label="Trainingsmenu">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
        <div className="tr-progress mt-2" aria-hidden="true">
          <span style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} />
        </div>
      </header>

      {session.status === "paused" && (
        <div className="tr-banner tr-banner-warn mb-3 items-center justify-between">
          <span>Deze training is onderbroken.</span>
          <button type="button" className="tr-btn tr-btn-secondary" onClick={() => void setSessionStatus(db, session.id, "active")}>
            Hervatten
          </button>
        </div>
      )}

      {restOpen && timer.state.status !== "idle" ? (
        <RestPanel nextLabel={nextLabel} onBack={() => setRestOpen(false)} />
      ) : !shownExercise ? (
        <EmptyState title="Geen oefeningen" action={<button type="button" className="tr-btn tr-btn-primary" onClick={() => setSheet("add")}>Oefening toevoegen</button>}>
          Voeg een oefening toe om te beginnen.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <section className="tr-card space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="tr-label">
                  Oefening {exerciseIndex + 1} van {exercises.length}
                </div>
                <h2 className="mt-0.5 text-xl font-bold leading-tight">{shownExercise.name}</h2>
                {exerciseInfo?.summary && <p className="tr-muted mt-1 line-clamp-2 text-sm">{exerciseInfo.summary}</p>}
              </div>
              <button type="button" className="tr-icon-btn -mr-2 shrink-0" onClick={() => setSheet("info")} aria-label="Uitleg oefening">
                <Info className="h-5 w-5" />
              </button>
            </div>

            <PreviousLine exercise={shownExercise} previous={previous?.[0] ?? null} />
            {hint && <div className="tr-banner tr-banner-info text-sm">{hint}</div>}
            {note && (
              <p className="tr-card-flat px-3 py-2 text-sm">
                <NotebookPen className="tr-muted mr-1.5 inline h-4 w-4" />
                {note}
              </p>
            )}

            <SetList
              exercise={shownExercise}
              done={done}
              cursor={cursor}
              onSelect={(p) => {
                setCursor(p);
                setError(null);
              }}
              onEditDone={(p) => setEditing(p)}
            />

            <div className="flex flex-wrap gap-1">
              <button type="button" className="tr-chip" onClick={() => void persist((s) => addSet(s, shownExercise.slot))}>
                <Plus className="h-3.5 w-3.5" /> Set
              </button>
              <button type="button" className="tr-chip" onClick={() => void persist((s) => removeSet(s, shownExercise.slot, "work", done))}>
                − Set
              </button>
              <button type="button" className="tr-chip" onClick={() => void persist((s) => addSet(s, shownExercise.slot, "warmup"))}>
                <Plus className="h-3.5 w-3.5" /> Opwarmset
              </button>
              <button type="button" className="tr-chip" onClick={() => setSheet("rest")}>
                <Timer className="h-3.5 w-3.5" /> Rust {restLabel(shownExercise.restSec)}
              </button>
              <button type="button" className="tr-chip" onClick={() => setSheet("replace")}>
                <Replace className="h-3.5 w-3.5" /> Vervangen
              </button>
              <button type="button" className="tr-chip" onClick={() => setSheet("note")}>
                <NotebookPen className="h-3.5 w-3.5" /> Notitie
              </button>
            </div>
          </section>

          {current && values ? (
            <section className="space-y-3">
              <ValueEditors exercise={current} values={values} step={step} onChange={setField} onPlates={() => setSheet("plates")} />
              {error && <div className="tr-banner tr-banner-danger">{error}</div>}
              <button type="button" className="tr-set-button" onClick={() => void complete()} disabled={!!problem}>
                {problem ? (
                  <span className="tr-set-title text-lg">{problem}</span>
                ) : (
                  <>
                    <span className="tr-set-title">
                      {cursor!.kind === "warmup" ? "OPWARMSET" : "SET"} {cursor!.index + 1} VOLTOOID
                    </span>
                    <span className="tr-set-values tr-num">{describeValues(current.tracking, values, current.perSide)}</span>
                    <span className="tr-set-hint">
                      {isLast ? "LAATSTE SET · DAARNA AFRONDEN" : `TIK OM ${restLabel(current.restSec)} RUST TE STARTEN`}
                    </span>
                  </>
                )}
              </button>
            </section>
          ) : (
            <section className="tr-card space-y-3 p-4 text-center">
              <p className="tr-h2">Alle sets gedaan</p>
              <button type="button" className="tr-btn tr-btn-primary tr-btn-lg tr-btn-block" onClick={() => void finish()}>
                Training afronden
              </button>
            </section>
          )}

          {lastDone && (
            <div className="tr-card flex items-center justify-between gap-2 px-3 py-2" role="status">
              <span className="text-sm">
                <span className="tr-muted">Opgeslagen:</span> <span className="tr-num font-semibold">{lastDone.text}</span>
              </span>
              <button type="button" className="tr-btn tr-btn-quiet" onClick={() => void undo()}>
                <Undo2 className="h-4 w-4" /> Ongedaan maken
              </button>
            </div>
          )}

          {nextExercise && (
            <p className="tr-muted px-1 text-sm">
              Daarna: <span className="tr-ink-2 font-medium">{nextExercise.name}</span>
            </p>
          )}
        </div>
      )}

      {/* ── Sheets ── */}
      <Sheet open={sheet === "menu"} onClose={() => setSheet(null)} title="Training">
        <div className="grid gap-2">
          <button type="button" className="tr-btn tr-btn-primary tr-btn-block" onClick={() => setSheet("finish")}>
            Training afronden
          </button>
          <button
            type="button"
            className="tr-btn tr-btn-ghost tr-btn-block"
            onClick={async () => {
              await setSessionStatus(db, session.id, session.status === "paused" ? "active" : "paused");
              setSheet(null);
              if (session.status !== "paused") {
                timer.stop();
                navigate("/training");
              }
            }}
          >
            {session.status === "paused" ? "Hervatten" : "Onderbreken (later hervatten)"}
          </button>
          <button type="button" className="tr-btn tr-btn-ghost tr-btn-block" onClick={() => setSheet("add")}>
            <Plus className="h-4 w-4" /> Oefening toevoegen
          </button>
          <button type="button" className="tr-btn tr-btn-ghost tr-btn-block" onClick={() => setSheet("sessionNote")}>
            <NotebookPen className="h-4 w-4" /> Notitie bij training
          </button>
          <button type="button" className="tr-btn tr-btn-danger tr-btn-block" onClick={() => setSheet("cancel")}>
            <Trash2 className="h-4 w-4" /> Training annuleren
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "finish"} onClose={() => setSheet(null)} title="Training afronden?">
        <p>
          {progress.completed} van {progress.total} werksets gedaan in {formatClock(elapsed)}.
          {progress.total > progress.completed && " De sets die je niet deed worden niet opgeslagen; je doel voor de volgende keer blijft staan."}
        </p>
        <div className="grid gap-2">
          <button type="button" className="tr-btn tr-btn-primary tr-btn-lg tr-btn-block" onClick={() => void finish()}>
            Opslaan en afronden
          </button>
          <button type="button" className="tr-btn tr-btn-ghost tr-btn-block" onClick={() => setSheet(null)}>
            Nog niet
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "cancel"} onClose={() => setSheet(null)} title="Training annuleren?">
        <p>
          De training wordt als geannuleerd bewaard en telt niet mee: je vorige prestaties blijven de opdracht voor de
          volgende keer.
        </p>
        <div className="grid gap-2">
          <button
            type="button"
            className="tr-btn tr-btn-danger tr-btn-block"
            onClick={async () => {
              await setSessionStatus(db, session.id, "cancelled");
              timer.stop();
              navigate("/training", { replace: true });
            }}
          >
            Ja, annuleren
          </button>
          <button type="button" className="tr-btn tr-btn-ghost tr-btn-block" onClick={() => setSheet(null)}>
            Doorgaan met trainen
          </button>
        </div>
      </Sheet>

      {exerciseInfo && (
        <Sheet open={sheet === "info"} onClose={() => setSheet(null)} title={exerciseInfo.name}>
          <ExerciseInfo exercise={exerciseInfo} />
        </Sheet>
      )}

      {shownExercise && (
        <RestSheet
          open={sheet === "rest"}
          onClose={() => setSheet(null)}
          exercise={shownExercise}
          onSave={async (sec, remember) => {
            await persist((s) => patchExercise(s, shownExercise.slot, { restSec: sec }));
            if (remember) await setExercisePref(db, userId, shownExercise.exerciseId, { restSec: sec });
            setSheet(null);
          }}
        />
      )}

      {shownExercise && (
        <ExercisePicker
          open={sheet === "replace"}
          onClose={() => setSheet(null)}
          title={`${shownExercise.name} vervangen`}
          suggested={lookup(shownExercise.exerciseId)?.alternatives ?? []}
          onPick={async (exercise) => {
            const made = await makeExercise(exercise, 0, shownExercise);
            await persist((s) => replaceExercise(s, shownExercise.slot, (slot) => ({ ...made, slot }), done));
            setCursor(null);
          }}
        />
      )}

      <ExercisePicker
        open={sheet === "add"}
        onClose={() => setSheet(null)}
        title="Oefening toevoegen"
        onPick={async (exercise) => {
          const made = await makeExercise(exercise, 0);
          await persist((s) => addExercise(s, (slot) => ({ ...made, slot })));
        }}
      />

      {shownExercise && (
        <Sheet open={sheet === "plates"} onClose={() => setSheet(null)} title="Schijvencalculator">
          <PlateCalculator
            loadMode={shownExercise.loadMode}
            targetKg={values?.weightKg ?? null}
            onPick={(kg) => {
              setField("weightKg", kg);
              setSheet(null);
            }}
          />
        </Sheet>
      )}

      {shownExercise && (
        <NoteSheet
          open={sheet === "note"}
          onClose={() => setSheet(null)}
          title={`Notitie: ${shownExercise.name}`}
          hint="Blijft bij deze oefening staan, ook bij volgende trainingen."
          initial={note ?? ""}
          onSave={(text) => setExercisePref(db, userId, shownExercise.exerciseId, { notes: text.trim() || undefined })}
        />
      )}
      <NoteSheet
        open={sheet === "sessionNote"}
        onClose={() => setSheet(null)}
        title="Notitie bij deze training"
        initial={session.notes ?? ""}
        onSave={(text) => updateSession(db, session.id, { notes: text.trim() || null })}
      />

      <Sheet open={sheet === "overview"} onClose={() => setSheet(null)} title="Oefeningen in deze training">
        <ul className="space-y-1">
          {exercises.map((e, i) => {
            const workDone = e.work.filter((_, idx) => done.has(positionKey({ slot: e.slot, kind: "work", index: idx }))).length;
            return (
              <li key={e.slot} className="flex items-center gap-1">
                <button
                  type="button"
                  className="tr-set-row flex-1 text-left"
                  data-state={current?.slot === e.slot ? "current" : workDone === e.work.length ? "done" : "todo"}
                  onClick={() => {
                    const first = nextOpenPosition({ ...snapshot, exercises: [e] }, done);
                    setCursor(first ?? { slot: e.slot, kind: "work", index: 0 });
                    setRestOpen(false);
                    setSheet(null);
                  }}
                >
                  <span className="tr-set-dot">{i + 1}</span>
                  <span className="font-medium">{e.name}</span>
                  <span className="tr-muted tr-num text-xs">
                    {workDone}/{e.work.length}
                  </span>
                </button>
                <button type="button" className="tr-icon-btn" aria-label="Omhoog" onClick={() => void persist((s) => moveExercise(s, e.slot, -1))}>
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" className="tr-icon-btn" aria-label="Omlaag" onClick={() => void persist((s) => moveExercise(s, e.slot, 1))}>
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="tr-icon-btn"
                  aria-label={`${e.name} overslaan`}
                  onClick={() => void persist((s) => removeExercise(s, e.slot, done))}
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="tr-btn tr-btn-ghost tr-btn-block" onClick={() => setSheet("add")}>
          <Plus className="h-4 w-4" /> Oefening toevoegen
        </button>
      </Sheet>

      {editing && (
        <EditDoneSheet
          set={done.get(positionKey(editing))!}
          exercise={snapshot.exercises.find((e) => e.slot === editing.slot)!}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const set = done.get(positionKey(editing));
            const e = snapshot.exercises.find((x) => x.slot === editing.slot);
            if (set && e) await editSet(db, set.id, e.tracking, v);
            setEditing(null);
          }}
          onUndo={async () => {
            const set = done.get(positionKey(editing));
            if (set) await undoSet(db, set.id);
            setCursor(editing);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PreviousLine({
  exercise,
  previous,
}: {
  exercise: SessionExercise;
  previous: { date: string; programName: string | null; dayName: string | null; work: SetValues[] } | null;
}) {
  if (!previous) {
    const target =
      exercise.tracking === "duration" || exercise.tracking === "jump_rope"
        ? formatDuration(exercise.durationSec)
        : exercise.repMin !== null
          ? `${exercise.repMin}${exercise.repMax && exercise.repMax !== exercise.repMin ? `–${exercise.repMax}` : ""} herh.`
          : "";
    return (
      <p className="tr-muted text-sm">
        Nieuw voor jou. Doel uit het schema: {exercise.work.length} × {target}
        {exercise.tracking === "weight_reps" && " — kies zelf een gewicht."}
      </p>
    );
  }
  const date = new Date(`${previous.date}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  return (
    <div className="tr-card-flat px-3 py-2">
      <div className="tr-muted text-xs">
        Vorige keer · {date}
        {previous.dayName && ` · ${previous.dayName}`}
        {previous.programName && ` (${previous.programName})`}
      </div>
      <div className="tr-num mt-0.5 text-sm font-semibold">
        {previous.work.map((v) => describeValues(exercise.tracking, v)).join("  ·  ")}
      </div>
    </div>
  );
}

function ValueEditors({
  exercise,
  values,
  step,
  onChange,
  onPlates,
}: {
  exercise: SessionExercise;
  values: SetValues;
  step: number;
  onChange: (field: keyof SetValues, value: number | null) => void;
  onPlates: () => void;
}) {
  const plateButton =
    exercise.loadMode !== "none" ? (
      <button type="button" className="tr-chip" onClick={onPlates} aria-label="Schijvencalculator">
        <Disc3 className="h-4 w-4" /> Schijven
      </button>
    ) : null;
  const perDumbbell = exercise.loadMode === "dumbbell_pair" ? "kg per dumbbell" : "kg";
  switch (exercise.tracking) {
    case "weight_reps":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Stepper label="Gewicht" unit={perDumbbell} value={values.weightKg} step={step} max={LIMITS.weightKg} onChange={(v) => onChange("weightKg", v)} extra={plateButton} />
          <Stepper label={exercise.perSide ? "Herhalingen per kant" : "Herhalingen"} unit="reps" value={values.reps} step={1} max={LIMITS.reps} integer onChange={(v) => onChange("reps", v)} />
        </div>
      );
    case "bodyweight_reps":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Stepper label={exercise.perSide ? "Herhalingen per kant" : "Herhalingen"} unit="reps" value={values.reps} step={1} max={LIMITS.reps} integer onChange={(v) => onChange("reps", v)} />
          <Stepper label="Extra gewicht (optioneel)" unit="kg" value={values.weightKg} step={Math.min(step, 2)} max={LIMITS.weightKg} onChange={(v) => onChange("weightKg", v || null)} />
        </div>
      );
    case "duration":
      return (
        <Stepper
          label={exercise.perSide ? "Tijd per kant" : "Tijd"}
          unit="sec"
          value={values.durationSec}
          display={values.durationSec !== null ? formatClock(values.durationSec) : undefined}
          step={5}
          max={LIMITS.durationSec}
          integer
          onChange={(v) => onChange("durationSec", v)}
        />
      );
    case "jump_rope":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Stepper
            label="Duur ronde"
            unit="sec"
            value={values.durationSec}
            display={values.durationSec !== null ? formatClock(values.durationSec) : undefined}
            step={15}
            max={LIMITS.durationSec}
            integer
            onChange={(v) => onChange("durationSec", v)}
          />
          <Stepper label="Sprongen (optioneel)" unit="x" value={values.jumps} step={10} max={LIMITS.jumps} integer onChange={(v) => onChange("jumps", v || null)} />
        </div>
      );
  }
}

const REST_OPTIONS = [45, 60, 75, 90, 120, 150, 180, 240];

function RestSheet({
  open,
  onClose,
  exercise,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  exercise: SessionExercise;
  onSave: (sec: number, remember: boolean) => void;
}) {
  const [sec, setSec] = useState(exercise.restSec);
  const [remember, setRemember] = useState(true);
  useEffect(() => setSec(exercise.restSec), [exercise.restSec, open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Rusttijd ${exercise.name}`}
      footer={
        <button type="button" className="tr-btn tr-btn-primary" onClick={() => onSave(sec, remember)}>
          Opslaan
        </button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {REST_OPTIONS.map((o) => (
          <button key={o} type="button" className="tr-chip" aria-pressed={o === sec} onClick={() => setSec(o)}>
            {formatClock(o)}
          </button>
        ))}
      </div>
      <NumberField label="Of zelf (seconden)" value={sec} integer onChange={(v) => v !== null && setSec(Math.min(3600, v))} suffix="s" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Onthouden als standaard voor deze oefening
      </label>
    </Sheet>
  );
}

function NoteSheet({
  open,
  onClose,
  title,
  hint,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  initial: string;
  onSave: (text: string) => Promise<unknown>;
}) {
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial, open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <button
          type="button"
          className="tr-btn tr-btn-primary"
          onClick={async () => {
            await onSave(text);
            onClose();
          }}
        >
          Opslaan
        </button>
      }
    >
      {hint && <p className="tr-muted text-sm">{hint}</p>}
      <textarea className="tr-textarea" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
    </Sheet>
  );
}

function EditDoneSheet({
  set,
  exercise,
  onClose,
  onSave,
  onUndo,
}: {
  set: TrainingSet;
  exercise: SessionExercise;
  onClose: () => void;
  onSave: (v: SetValues) => void;
  onUndo: () => void;
}) {
  const [v, setV] = useState<SetValues>({ weightKg: set.weightKg, reps: set.reps, durationSec: set.durationSec, jumps: set.jumps });
  const problem = validateSetValues(exercise.tracking, v);
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${set.kind === "warmup" ? "Opwarmset" : "Set"} ${set.setIndex + 1} aanpassen`}
      footer={
        <>
          <button type="button" className="tr-btn tr-btn-danger" onClick={onUndo}>
            <Undo2 className="h-4 w-4" /> Ongedaan maken
          </button>
          <button type="button" className="tr-btn tr-btn-primary" disabled={!!problem} onClick={() => onSave(v)}>
            Opslaan
          </button>
        </>
      }
    >
      <SetValueFields tracking={exercise.tracking} value={v} onChange={setV} />
      {problem && <p className="tr-danger-text text-sm">{problem}</p>}
      <p className="tr-muted text-xs">Gedaan om {new Date(set.completedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</p>
    </Sheet>
  );
}
