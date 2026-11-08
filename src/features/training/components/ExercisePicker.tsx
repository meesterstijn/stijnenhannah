import { useCallback, useMemo, useState } from "react";
import { Plus, Search, Star } from "lucide-react";
import { saveCustomExercise } from "@/features/training/db/repository";
import {
  QUICK_KIND_LABELS,
  quickExercise,
  type QuickKind,
} from "@/features/training/domain/quick-exercise";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import { isAvailable } from "@/features/training/domain/exercises";
import {
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from "@/features/training/domain/types";
import {
  MUSCLE_LABELS,
  equipmentLabel,
} from "@/features/training/domain/units";
import {
  useExercises,
  useProfile,
} from "@/features/training/hooks/useTrainingData";
import { Sheet } from "./ui";

export function exerciseMatches(e: Exercise, query: string) {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    e.name.toLowerCase().includes(q) ||
    (e.nameEn ?? "").toLowerCase().includes(q)
  );
}

// Oefening kiezen (toevoegen of vervangen). Bovenaan de voorgestelde
// alternatieven; oefeningen waarvoor apparatuur ontbreekt staan onderaan.
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = "Oefening kiezen",
  suggested = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  title?: string;
  suggested?: string[];
}) {
  const { all } = useExercises();
  const { equipment, exercisePrefs } = useProfile();
  const owned = useMemo(() => new Set(equipment.owned), [equipment.owned]);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const filtered = all.filter(
      (e) =>
        !e.archived &&
        exerciseMatches(e, query) &&
        (!muscle || e.primary.includes(muscle)),
    );
    const rank = (e: Exercise) =>
      (suggested.includes(e.id) ? 0 : 10) +
      (exercisePrefs[e.id]?.favorite ? 0 : 1) +
      (isAvailable(e, owned) ? 0 : 100);
    return filtered.sort(
      (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "nl"),
    );
  }, [all, query, muscle, suggested, exercisePrefs, owned]);

  const close = useCallback(() => {
    setCreating(false);
    onClose();
  }, [onClose]);

  if (creating) {
    return (
      <Sheet open={open} onClose={close} title="Eigen oefening">
        <QuickExerciseForm
          initialName={query}
          initialMuscle={muscle}
          onCancel={() => setCreating(false)}
          onCreated={(exercise) => {
            setCreating(false);
            setQuery("");
            onPick(exercise);
            onClose();
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      <label className="relative block">
        <Search className="tr-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          className="tr-input tr-input-search"
          placeholder="Zoek oefening"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          className="tr-chip"
          aria-pressed={muscle === null}
          onClick={() => setMuscle(null)}
        >
          Alles
        </button>
        {MUSCLE_GROUPS.map((m) => (
          <button
            key={m}
            type="button"
            className="tr-chip"
            aria-pressed={muscle === m}
            onClick={() => setMuscle(muscle === m ? null : m)}
          >
            {MUSCLE_LABELS[m]}
          </button>
        ))}
      </div>
      <ul className="divide-y" style={{ borderColor: "var(--tr-border)" }}>
        {list.map((e) => {
          const available = isAvailable(e, owned);
          return (
            <li key={e.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 py-3 text-left"
                onClick={() => {
                  onPick(e);
                  onClose();
                }}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    {exercisePrefs[e.id]?.favorite && (
                      <Star className="h-3.5 w-3.5 fill-current tr-aqua-text" />
                    )}
                    {e.name}
                  </span>
                  <span className="tr-muted block truncate text-xs">
                    {e.primary.map((m) => MUSCLE_LABELS[m]).join(", ")} ·{" "}
                    {e.equipment.map(equipmentLabel).join(", ")}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {suggested.includes(e.id) && (
                    <span className="tr-chip tr-chip-aqua">Alternatief</span>
                  )}
                  {!available && (
                    <span className="tr-chip tr-chip-warn">
                      Apparatuur ontbreekt
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && (
        <p className="tr-muted py-2 text-center text-sm">
          {query.trim()
            ? `Geen oefening gevonden voor "${query.trim()}".`
            : "Geen oefeningen in deze groep."}
        </p>
      )}
      <button
        type="button"
        className={`tr-btn tr-btn-block tr-btn-wrap ${list.length === 0 ? "tr-btn-primary" : "tr-btn-ghost"}`}
        onClick={() => setCreating(true)}
      >
        <Plus className="h-4 w-4" />
        {query.trim()
          ? `"${query.trim()}" als eigen oefening toevoegen`
          : "Eigen oefening toevoegen"}
      </button>
    </Sheet>
  );
}

const QUICK_KINDS: QuickKind[] = [
  "machine",
  "dumbbell_pair",
  "dumbbell_single",
  "barbell",
  "bodyweight",
  "duration",
];

// Kort formulier in het kiesvenster: naam, hoe je het registreert en de
// spiergroep. Uitleg, rusttijd en de rest kan later via Oefeningen.
function QuickExerciseForm({
  initialName,
  initialMuscle,
  onCancel,
  onCreated,
}: {
  initialName: string;
  initialMuscle: MuscleGroup | null;
  onCancel: () => void;
  onCreated: (exercise: Exercise) => void;
}) {
  const { db, userId } = useTraining();
  const [name, setName] = useState(initialName.trim());
  const [kind, setKind] = useState<QuickKind>("machine");
  const [primary, setPrimary] = useState<MuscleGroup[]>(
    initialMuscle ? [initialMuscle] : [],
  );
  const [saving, setSaving] = useState(false);
  const valid = name.trim().length > 0 && primary.length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const exercise = quickExercise({ name, kind, primary });
    const id = await saveCustomExercise(db, userId, exercise);
    onCreated({ ...exercise, id });
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <label className="tr-field">
        <span>Naam</span>
        <input
          className="tr-input"
          value={name}
          maxLength={80}
          autoFocus
          placeholder="Bijv. Leg press"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="space-y-1.5">
        <span className="tr-label">Waarmee?</span>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Waarmee"
        >
          {QUICK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className="tr-chip"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {QUICK_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="tr-label">Spiergroep</span>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Spiergroep"
        >
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m}
              type="button"
              className="tr-chip"
              aria-pressed={primary.includes(m)}
              onClick={() =>
                setPrimary(
                  primary.includes(m)
                    ? primary.filter((x) => x !== m)
                    : [...primary, m],
                )
              }
            >
              {MUSCLE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <p className="tr-muted text-xs">
        Uitleg, rusttijd en meer kun je later aanvullen bij Oefeningen.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="tr-btn tr-btn-ghost"
          onClick={onCancel}
        >
          Terug
        </button>
        <button
          type="submit"
          className="tr-btn tr-btn-primary"
          disabled={!valid || saving}
        >
          Toevoegen
        </button>
      </div>
    </form>
  );
}

export function ExerciseInfo({ exercise }: { exercise: Exercise }) {
  return (
    <div className="space-y-4 text-[0.95rem]">
      {exercise.summary && <p className="tr-ink-2">{exercise.summary}</p>}
      {exercise.steps.length > 0 && (
        <section>
          <h3 className="tr-label mb-1.5">Uitvoering</h3>
          <ol className="list-decimal space-y-1 pl-5">
            {exercise.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      )}
      {exercise.mistakes.length > 0 && (
        <section>
          <h3 className="tr-label mb-1.5">Veelgemaakte fouten</h3>
          <ul className="list-disc space-y-1 pl-5">
            {exercise.mistakes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}
      {(exercise.safety.length > 0 || exercise.homeNote) && (
        <section className="tr-banner tr-banner-warn flex-col gap-1">
          <h3 className="font-semibold">Veilig trainen</h3>
          <ul className="list-disc space-y-1 pl-5">
            {exercise.safety.map((s) => (
              <li key={s}>{s}</li>
            ))}
            {exercise.homeNote && <li>{exercise.homeNote}</li>}
          </ul>
        </section>
      )}
      {exercise.link && (
        <a
          href={exercise.link}
          target="_blank"
          rel="noreferrer"
          className="tr-aqua-text font-semibold underline"
        >
          Instructie (externe link)
        </a>
      )}
    </div>
  );
}
