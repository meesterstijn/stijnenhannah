import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Star } from "lucide-react";
import {
  ChartCard,
  TrendLine,
  shortDate,
} from "@/features/training/components/charts";
import { ExerciseInfo } from "@/features/training/components/ExercisePicker";
import {
  Loading,
  NumberField,
  Segment,
  Stat,
} from "@/features/training/components/ui";
import { setExercisePref } from "@/features/training/db/repository";
import { performances } from "@/features/training/domain/performance";
import {
  exerciseRecords,
  exerciseSeries,
  type ExercisePoint,
} from "@/features/training/domain/stats";
import {
  MUSCLE_LABELS,
  equipmentLabel,
  formatDuration,
  formatKg,
} from "@/features/training/domain/units";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import {
  useExercises,
  useHistoryIndex,
  useProfile,
} from "@/features/training/hooks/useTrainingData";
import { describeValues } from "@/features/training/workout/SetControls";
import { TYPE_LABELS } from "./TrainingOefeningen";

type Metric = "weight" | "reps" | "volume" | "e1rm" | "duration";

export default function TrainingOefeningDetail() {
  const { id = "" } = useParams();
  const { get, loaded } = useExercises();
  const index = useHistoryIndex();
  const profile = useProfile();
  const { db, userId } = useTraining();
  const navigate = useNavigate();
  const exercise = get(id);
  const pref = profile.exercisePrefs[id] ?? {};
  const [notes, setNotes] = useState(pref.notes ?? "");
  useEffect(() => setNotes(pref.notes ?? ""), [pref.notes]);

  const list = useMemo(
    () => (index ? performances(index, id, { scope: "any" }) : []),
    [index, id],
  );
  const series = useMemo(() => exerciseSeries(list), [list]);
  const records = useMemo(() => exerciseRecords(list), [list]);
  const timed =
    exercise.tracking === "duration" || exercise.tracking === "jump_rope";
  const [metric, setMetric] = useState<Metric>(
    timed
      ? "duration"
      : exercise.tracking === "weight_reps"
        ? "weight"
        : "reps",
  );

  if (!loaded || !index) return <Loading />;

  const metricOptions: { value: Metric; label: string }[] = timed
    ? [{ value: "duration", label: "Duur" }]
    : exercise.tracking === "weight_reps"
      ? [
          { value: "weight", label: "Gewicht" },
          { value: "reps", label: "Herhalingen" },
          { value: "volume", label: "Volume" },
          ...(profile.settings.showE1rm
            ? [{ value: "e1rm" as const, label: "Geschat 1RM" }]
            : []),
        ]
      : [{ value: "reps", label: "Herhalingen" }];
  const pick = (p: ExercisePoint): number | null =>
    metric === "weight"
      ? p.topWeightKg
      : metric === "reps"
        ? p.totalReps
        : metric === "volume"
          ? p.volumeKg
          : metric === "e1rm"
            ? p.bestE1rm
            : p.bestDurationSec;
  const unit =
    metric === "reps" ? "herh. totaal" : metric === "duration" ? "sec" : "kg";
  const points = series.map((p) => ({
    key: p.sessionId,
    label: shortDate(p.date),
    value: pick(p),
    detail:
      metric === "weight" && p.repsAtTop
        ? `× ${p.repsAtTop} herhalingen`
        : undefined,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="tr-icon-btn -ml-2"
          onClick={() => navigate(-1)}
          aria-label="Terug"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="tr-h1 flex-1">{exercise.name}</h1>
        <button
          type="button"
          className="tr-icon-btn"
          aria-pressed={!!pref.favorite}
          aria-label={pref.favorite ? "Geen favoriet meer" : "Favoriet maken"}
          onClick={() =>
            void setExercisePref(db, userId, id, { favorite: !pref.favorite })
          }
        >
          <Star
            className={`h-5 w-5 ${pref.favorite ? "tr-aqua-text fill-current" : ""}`}
          />
        </button>
        {exercise.custom && (
          <Link
            to={`/training/oefeningen/${id}/bewerken`}
            className="tr-icon-btn"
            aria-label="Bewerken"
          >
            <Pencil className="h-5 w-5" />
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {exercise.nameEn && <span className="tr-chip">{exercise.nameEn}</span>}
        <span className="tr-chip">{TYPE_LABELS[exercise.type]}</span>
        {exercise.primary.map((m) => (
          <span key={m} className="tr-chip tr-chip-aqua">
            {MUSCLE_LABELS[m]}
          </span>
        ))}
        {exercise.secondary.map((m) => (
          <span key={m} className="tr-chip">
            {MUSCLE_LABELS[m]} (secundair)
          </span>
        ))}
        {exercise.equipment.map((k) => (
          <span key={k} className="tr-chip">
            {equipmentLabel(k)}
          </span>
        ))}
      </div>

      {list.length > 0 && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {exercise.tracking === "weight_reps" && (
            <Stat
              label="Zwaarste set"
              value={
                records.heaviest
                  ? `${formatKg(records.heaviest.value)} kg`
                  : "–"
              }
              hint={
                records.heaviest
                  ? `× ${records.heaviest.reps} · ${shortDate(records.heaviest.date)}`
                  : undefined
              }
            />
          )}
          {exercise.tracking === "weight_reps" && profile.settings.showE1rm && (
            <Stat
              label="Geschat 1RM"
              value={
                records.bestE1rm
                  ? `${formatKg(records.bestE1rm.value)} kg`
                  : "–"
              }
              hint="schatting (Epley)"
            />
          )}
          {exercise.tracking === "weight_reps" && (
            <Stat
              label="Meeste volume"
              value={
                records.bestVolume
                  ? `${formatKg(records.bestVolume.value)} kg`
                  : "–"
              }
              hint={
                records.bestVolume
                  ? shortDate(records.bestVolume.date)
                  : undefined
              }
            />
          )}
          {!timed && (
            <Stat
              label="Meeste herhalingen"
              value={records.mostReps?.value ?? "–"}
              hint="in één set"
            />
          )}
          {timed && (
            <Stat
              label="Langste"
              value={formatDuration(records.longest?.value)}
            />
          )}
          {exercise.tracking === "jump_rope" && (
            <Stat
              label="Meeste sprongen"
              value={records.mostJumps?.value ?? "–"}
              hint="in één ronde"
            />
          )}
          <Stat label="Keer gedaan" value={list.length} />
        </section>
      )}

      {series.length > 1 && (
        <ChartCard
          title="Ontwikkeling"
          subtitle={
            metric === "e1rm"
              ? "Geschatte 1RM is alleen een indicatie."
              : undefined
          }
          data={points}
          unit={unit}
        >
          {metricOptions.length > 1 && (
            <Segment
              label="Grafiek"
              value={metric}
              onChange={setMetric}
              options={metricOptions}
            />
          )}
          <div className="mt-3">
            <TrendLine
              data={points}
              unit={unit}
              zeroBased={metric === "reps" || metric === "volume"}
            />
          </div>
        </ChartCard>
      )}

      {exercise.tracking === "weight_reps" &&
        records.repsByWeight.length > 0 && (
          <section className="tr-card p-4">
            <h2 className="tr-h2">Meeste herhalingen per gewicht</h2>
            <ul className="tr-num mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {records.repsByWeight.slice(0, 12).map((r) => (
                <li key={r.weightKg} className="flex justify-between">
                  <span>{formatKg(r.weightKg)} kg</span>
                  <span className="font-semibold">{r.reps}×</span>
                </li>
              ))}
            </ul>
          </section>
        )}

      <section className="tr-card p-4">
        <h2 className="tr-h2 mb-3">Uitleg</h2>
        <ExerciseInfo exercise={exercise} />
      </section>

      <section className="tr-card space-y-3 p-4">
        <h2 className="tr-h2">Mijn instellingen</h2>
        <label className="tr-field">
          <span>Notitie (zie je tijdens de training)</span>
          <textarea
            className="tr-textarea"
            value={notes}
            maxLength={1000}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() =>
              notes !== (pref.notes ?? "") &&
              void setExercisePref(db, userId, id, {
                notes: notes.trim() || undefined,
              })
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Standaard rusttijd"
            integer
            suffix="sec"
            value={pref.restSec ?? exercise.defaultRestSec}
            onChange={(v) =>
              v !== null &&
              void setExercisePref(db, userId, id, {
                restSec: Math.min(3600, v),
              })
            }
          />
          {exercise.tracking === "weight_reps" && (
            <NumberField
              label="Startgewicht (zonder historie)"
              suffix="kg"
              value={pref.startWeightKg ?? null}
              onChange={(v) =>
                void setExercisePref(db, userId, id, {
                  startWeightKg: v ?? undefined,
                })
              }
            />
          )}
        </div>
        <p className="tr-muted text-xs">
          Rusttijd geldt voor nieuwe trainingen; aanbevolen standaard:{" "}
          {exercise.defaultRestSec} seconden.
        </p>
      </section>

      {list.length > 0 && (
        <section className="tr-card p-4">
          <h2 className="tr-h2 mb-2">Historie</h2>
          <ul className="space-y-2">
            {list.slice(0, 30).map((p) => (
              <li key={p.sessionId}>
                <Link
                  to={`/training/historie/${p.sessionId}`}
                  className="block"
                >
                  <div className="tr-muted text-xs">
                    {shortDate(p.date)} · {p.dayName}
                    {p.programName && ` (${p.programName})`}
                  </div>
                  <div className="tr-num text-sm font-medium">
                    {p.work
                      .map((s) => describeValues(exercise.tracking, s))
                      .join("  ·  ")}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
