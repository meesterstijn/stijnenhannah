import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Loading, NumberField } from "@/features/training/components/ui";
import {
  archiveCustomExercise,
  saveCustomExercise,
} from "@/features/training/db/repository";
import {
  MUSCLE_GROUPS,
  type Exercise,
  type ExerciseType,
  type LoadMode,
  type MuscleGroup,
  type Tracking,
} from "@/features/training/domain/types";
import {
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
} from "@/features/training/domain/units";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import { useExercises } from "@/features/training/hooks/useTrainingData";
import { TYPE_LABELS } from "./TrainingOefeningen";

const TRACKING_LABELS: Record<Tracking, string> = {
  weight_reps: "Gewicht × herhalingen",
  bodyweight_reps: "Herhalingen (optioneel extra gewicht)",
  duration: "Tijd",
  jump_rope: "Tijd + aantal sprongen",
};
const LOAD_LABELS: Record<LoadMode, string> = {
  barbell: "Lange stang (totaalgewicht)",
  dumbbell_pair: "Twee dumbbells (gewicht per dumbbell)",
  dumbbell_single: "Eén dumbbell",
  none: "Geen schijven",
};

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const empty = (): Exercise => ({
  id: "",
  name: "",
  primary: [],
  secondary: [],
  type: "isolation",
  equipment: ["dumbbell"],
  tracking: "weight_reps",
  loadMode: "dumbbell_pair",
  summary: "",
  steps: [],
  mistakes: [],
  safety: [],
  defaultRestSec: 90,
  alternatives: [],
});

export default function TrainingOefeningForm() {
  const { id } = useParams();
  const { get, loaded } = useExercises();
  const { db, userId } = useTraining();
  const navigate = useNavigate();
  const [form, setForm] = useState<Exercise | null>(id ? null : empty());
  const [steps, setSteps] = useState("");
  const [extraGear, setExtraGear] = useState("");

  useEffect(() => {
    if (id && loaded && !form) {
      const e = get(id);
      setForm(e);
      setSteps(e.steps.join("\n"));
    }
  }, [id, loaded, form, get]);

  if (!form) return <Loading />;
  const set = (patch: Partial<Exercise>) => setForm({ ...form, ...patch });
  const toggle = (list: MuscleGroup[], m: MuscleGroup) =>
    list.includes(m) ? list.filter((x) => x !== m) : [...list, m];

  const save = async () => {
    const newId = await saveCustomExercise(db, userId, {
      ...form,
      steps: lines(steps),
      equipment: extraGear.trim()
        ? [...new Set([...form.equipment, extraGear.trim().toLowerCase()])]
        : form.equipment,
    });
    navigate(`/training/oefeningen/${newId}`, { replace: true });
  };

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
        <h1 className="tr-h1">{id ? "Oefening bewerken" : "Eigen oefening"}</h1>
      </div>
      <section className="tr-card space-y-4 p-4">
        <label className="tr-field">
          <span>Naam</span>
          <input
            className="tr-input"
            value={form.name}
            maxLength={80}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="tr-field">
            <span>Type</span>
            <select
              className="tr-select"
              value={form.type}
              onChange={(e) => set({ type: e.target.value as ExerciseType })}
            >
              {(Object.keys(TYPE_LABELS) as ExerciseType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="tr-field">
            <span>Registratie</span>
            <select
              className="tr-select"
              value={form.tracking}
              onChange={(e) => set({ tracking: e.target.value as Tracking })}
            >
              {(Object.keys(TRACKING_LABELS) as Tracking[]).map((t) => (
                <option key={t} value={t}>
                  {TRACKING_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="tr-field">
            <span>Belading</span>
            <select
              className="tr-select"
              value={form.loadMode}
              onChange={(e) => set({ loadMode: e.target.value as LoadMode })}
            >
              {(Object.keys(LOAD_LABELS) as LoadMode[]).map((t) => (
                <option key={t} value={t}>
                  {LOAD_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Aanbevolen rusttijd"
            integer
            suffix="sec"
            value={form.defaultRestSec}
            onChange={(v) => set({ defaultRestSec: Math.min(3600, v ?? 60) })}
          />
        </div>
        <div className="space-y-1.5">
          <span className="tr-label">Primaire spiergroepen</span>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                type="button"
                className="tr-chip"
                aria-pressed={form.primary.includes(m)}
                onClick={() => set({ primary: toggle(form.primary, m) })}
              >
                {MUSCLE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="tr-label">Secundaire spiergroepen</span>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                type="button"
                className="tr-chip"
                aria-pressed={form.secondary.includes(m)}
                onClick={() => set({ secondary: toggle(form.secondary, m) })}
              >
                {MUSCLE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="tr-label">Benodigde apparatuur</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(EQUIPMENT_LABELS)
              .filter(([k]) => k !== "plates")
              .map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  className="tr-chip"
                  aria-pressed={form.equipment.includes(k)}
                  onClick={() =>
                    set({
                      equipment: form.equipment.includes(k)
                        ? form.equipment.filter((x) => x !== k)
                        : [...form.equipment, k],
                    })
                  }
                >
                  {v}
                </button>
              ))}
          </div>
          <input
            className="tr-input"
            placeholder="Andere apparatuur (bijv. kettlebell)"
            value={extraGear}
            onChange={(e) => setExtraGear(e.target.value)}
          />
        </div>
        <label className="tr-field">
          <span>Korte beschrijving</span>
          <textarea
            className="tr-textarea"
            value={form.summary}
            maxLength={500}
            onChange={(e) => set({ summary: e.target.value })}
          />
        </label>
        <label className="tr-field">
          <span>Uitvoering (één stap per regel)</span>
          <textarea
            className="tr-textarea"
            value={steps}
            maxLength={2000}
            onChange={(e) => setSteps(e.target.value)}
          />
        </label>
        <label className="tr-field">
          <span>Instructielink (optioneel)</span>
          <input
            className="tr-input"
            type="url"
            value={form.link ?? ""}
            onChange={(e) => set({ link: e.target.value || undefined })}
          />
        </label>
      </section>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="tr-btn tr-btn-primary"
          disabled={!form.name.trim() || form.primary.length === 0}
          onClick={() => void save()}
        >
          Opslaan
        </button>
        {id && (
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            onClick={async () => {
              await archiveCustomExercise(db, id, !form.archived);
              navigate("/training/oefeningen");
            }}
          >
            {form.archived ? "Terugzetten" : "Archiveren"}
          </button>
        )}
      </div>
      <p className="tr-muted text-xs">
        Archiveren verbergt de oefening; je historie ermee blijft bewaard.
      </p>
    </div>
  );
}
