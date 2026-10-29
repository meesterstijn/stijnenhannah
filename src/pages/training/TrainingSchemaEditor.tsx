import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Plus,
  Replace,
  Trash2,
} from "lucide-react";
import { ExercisePicker } from "@/features/training/components/ExercisePicker";
import {
  EmptyState,
  Loading,
  NumberField,
  Segment,
} from "@/features/training/components/ui";
import { saveProgram } from "@/features/training/db/repository";
import { estimateMinutes } from "@/features/training/domain/generator";
import type {
  Exercise,
  PlannedExercise,
  ProgramContent,
  ProgramDay,
} from "@/features/training/domain/types";
import { WEEKDAY_SHORT } from "@/features/training/domain/units";
import { adHocPlan } from "@/features/training/domain/workout";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import {
  useExercises,
  useProgram,
} from "@/features/training/hooks/useTrainingData";
import { newId } from "@/features/training/lib/ids";

const move = <T,>(list: T[], from: number, delta: number) => {
  const to = from + delta;
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

const planned = (exercise: Exercise): PlannedExercise => ({
  id: newId().slice(0, 8),
  exerciseId: exercise.id,
  ...adHocPlan(exercise),
});

// Schema-editor. Wijzigingen gelden alleen voor nieuwe trainingen: elke
// training bewaart zijn eigen momentopname, dus historie verandert nooit.
export default function TrainingSchemaEditor() {
  const { id } = useParams();
  const program = useProgram(id);
  const { db } = useTraining();
  const { get } = useExercises();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [content, setContent] = useState<ProgramContent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState<{
    day: number;
    replace?: number;
  } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (program && !content) {
      setName(program.name);
      setContent(structuredClone(program.content));
    }
  }, [program, content]);

  if (program === undefined || (program && !content)) return <Loading />;
  if (!program || !content)
    return (
      <EmptyState
        title="Schema niet gevonden"
        action={
          <Link to="/training/schemas" className="tr-btn tr-btn-ghost">
            Terug
          </Link>
        }
      />
    );

  const change = (next: ProgramContent) => {
    setContent(next);
    setDirty(true);
    setSaved(false);
  };
  const setDay = (index: number, day: ProgramDay) =>
    change({
      ...content,
      days: content.days.map((d, i) => (i === index ? day : d)),
    });
  const setExercise = (
    di: number,
    ei: number,
    patch: Partial<PlannedExercise>,
  ) => {
    const day = content.days[di];
    setDay(di, {
      ...day,
      exercises: day.exercises.map((e, i) =>
        i === ei ? { ...e, ...patch } : e,
      ),
    });
  };

  const save = async () => {
    await saveProgram(db, program.id, { name, content });
    setDirty(false);
    setSaved(true);
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="tr-icon-btn -ml-2"
          onClick={() => navigate("/training/schemas")}
          aria-label="Terug"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="tr-h1 flex-1">Schema bewerken</h1>
      </div>
      <p className="tr-muted text-sm">
        Wijzigingen gelden voor nieuwe trainingen. Afgeronde trainingen blijven
        precies zoals je ze deed.
      </p>

      <section className="tr-card space-y-4 p-4">
        <label className="tr-field">
          <span>Naam</span>
          <input
            className="tr-input"
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        <div className="space-y-1.5">
          <span className="tr-label">Planning</span>
          <Segment
            label="Planning"
            value={content.scheduleMode}
            onChange={(scheduleMode) => change({ ...content, scheduleMode })}
            options={[
              { value: "weekly", label: "Vaste weekdagen" },
              { value: "sequence", label: "Doorlopende volgorde" },
            ]}
          />
        </div>
      </section>

      {content.days.map((day, di) => (
        <section key={day.id} className="tr-card space-y-3 p-4">
          <div className="flex items-center gap-2">
            <input
              className="tr-input flex-1 font-semibold"
              value={day.name}
              maxLength={60}
              aria-label="Naam trainingsdag"
              onChange={(e) => setDay(di, { ...day, name: e.target.value })}
            />
            <button
              type="button"
              className="tr-icon-btn"
              aria-label="Dag omhoog"
              onClick={() =>
                change({ ...content, days: move(content.days, di, -1) })
              }
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="tr-icon-btn"
              aria-label="Dag omlaag"
              onClick={() =>
                change({ ...content, days: move(content.days, di, 1) })
              }
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="tr-icon-btn tr-danger-text"
              aria-label="Dag verwijderen"
              disabled={content.days.length <= 1}
              onClick={() =>
                change({
                  ...content,
                  days: content.days.filter((_, i) => i !== di),
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {content.scheduleMode === "weekly" && (
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Weekdagen"
            >
              {WEEKDAY_SHORT.map((w, wi) => (
                <button
                  key={w}
                  type="button"
                  className="tr-chip"
                  aria-pressed={day.weekdays.includes(wi)}
                  onClick={() =>
                    setDay(di, {
                      ...day,
                      weekdays: day.weekdays.includes(wi)
                        ? day.weekdays.filter((x) => x !== wi)
                        : [...day.weekdays, wi].sort(),
                    })
                  }
                >
                  {w}
                </button>
              ))}
            </div>
          )}
          <p className="tr-muted text-xs">
            ~{estimateMinutes(day.exercises)} minuten
          </p>

          <ol className="space-y-2">
            {day.exercises.map((pe, ei) => {
              const exercise = get(pe.exerciseId);
              const timed =
                exercise.tracking === "duration" ||
                exercise.tracking === "jump_rope";
              return (
                <li key={pe.id} className="tr-card-flat space-y-2 p-3">
                  <div className="flex items-center gap-1">
                    <span className="flex-1 font-semibold">
                      {ei + 1}. {exercise.name}
                    </span>
                    <button
                      type="button"
                      className="tr-icon-btn"
                      aria-label="Omhoog"
                      onClick={() =>
                        setDay(di, {
                          ...day,
                          exercises: move(day.exercises, ei, -1),
                        })
                      }
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="tr-icon-btn"
                      aria-label="Omlaag"
                      onClick={() =>
                        setDay(di, {
                          ...day,
                          exercises: move(day.exercises, ei, 1),
                        })
                      }
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="tr-icon-btn"
                      aria-label="Vervangen"
                      onClick={() => setPicker({ day: di, replace: ei })}
                    >
                      <Replace className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="tr-icon-btn tr-danger-text"
                      aria-label="Verwijderen"
                      onClick={() =>
                        setDay(di, {
                          ...day,
                          exercises: day.exercises.filter((_, i) => i !== ei),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <NumberField
                      label="Werksets"
                      integer
                      value={pe.sets}
                      onChange={(v) =>
                        setExercise(di, ei, {
                          sets: Math.max(1, Math.min(20, v ?? 1)),
                        })
                      }
                    />
                    <NumberField
                      label="Opwarmsets"
                      integer
                      value={pe.warmupSets}
                      onChange={(v) =>
                        setExercise(di, ei, {
                          warmupSets: Math.max(0, Math.min(5, v ?? 0)),
                        })
                      }
                    />
                    {timed ? (
                      <NumberField
                        label="Doel (sec)"
                        integer
                        value={pe.durationSec}
                        onChange={(v) =>
                          setExercise(di, ei, { durationSec: v })
                        }
                      />
                    ) : (
                      <>
                        <NumberField
                          label="Herh. min"
                          integer
                          value={pe.repMin}
                          onChange={(v) => setExercise(di, ei, { repMin: v })}
                        />
                        <NumberField
                          label="Herh. max"
                          integer
                          value={pe.repMax}
                          onChange={(v) => setExercise(di, ei, { repMax: v })}
                        />
                      </>
                    )}
                    <NumberField
                      label="Rust (sec)"
                      integer
                      value={pe.restSec}
                      onChange={(v) =>
                        setExercise(di, ei, {
                          restSec: Math.max(0, Math.min(3600, v ?? 0)),
                        })
                      }
                    />
                  </div>
                  {exercise.tracking === "weight_reps" && (
                    <NumberField
                      label="Startgewicht (alleen zolang er nog geen historie is)"
                      value={pe.startWeightKg}
                      suffix="kg"
                      onChange={(v) =>
                        setExercise(di, ei, { startWeightKg: v })
                      }
                    />
                  )}
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            onClick={() => setPicker({ day: di })}
          >
            <Plus className="h-4 w-4" /> Oefening toevoegen
          </button>
        </section>
      ))}

      <button
        type="button"
        className="tr-btn tr-btn-ghost tr-btn-block"
        onClick={() =>
          change({
            ...content,
            days: [
              ...content.days,
              {
                id: `dag-${newId().slice(0, 6)}`,
                name: `Dag ${content.days.length + 1}`,
                weekdays: [],
                exercises: [],
              },
            ],
          })
        }
      >
        <Plus className="h-4 w-4" /> Trainingsdag toevoegen
      </button>

      <div className="fixed inset-x-0 bottom-16 z-30 px-4 md:bottom-4">
        <div className="tr-card mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <span className="tr-muted text-sm">
            {dirty
              ? "Niet opgeslagen wijzigingen"
              : saved
                ? "Opgeslagen"
                : "Geen wijzigingen"}
          </span>
          <button
            type="button"
            className="tr-btn tr-btn-primary"
            disabled={!dirty}
            onClick={() => void save()}
          >
            Opslaan
          </button>
        </div>
      </div>

      {picker && (
        <ExercisePicker
          open
          onClose={() => setPicker(null)}
          title={
            picker.replace !== undefined
              ? "Oefening vervangen"
              : "Oefening toevoegen"
          }
          suggested={
            picker.replace !== undefined
              ? get(
                  content.days[picker.day].exercises[picker.replace].exerciseId,
                ).alternatives
              : []
          }
          onPick={(exercise) => {
            const day = content.days[picker.day];
            if (picker.replace !== undefined) {
              const old = day.exercises[picker.replace];
              const fresh = planned(exercise);
              const timed =
                exercise.tracking === "duration" ||
                exercise.tracking === "jump_rope";
              setDay(picker.day, {
                ...day,
                exercises: day.exercises.map((e, i) =>
                  i === picker.replace
                    ? {
                        ...fresh,
                        id: old.id,
                        sets: old.sets,
                        warmupSets: timed ? 0 : old.warmupSets,
                        repMin: timed ? null : (old.repMin ?? fresh.repMin),
                        repMax: timed ? null : (old.repMax ?? fresh.repMax),
                      }
                    : e,
                ),
              });
            } else {
              setDay(picker.day, {
                ...day,
                exercises: [...day.exercises, planned(exercise)],
              });
            }
          }}
        />
      )}
    </div>
  );
}
