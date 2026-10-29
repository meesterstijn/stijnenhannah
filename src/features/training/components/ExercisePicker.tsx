import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
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

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <label className="relative block">
        <Search className="tr-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          className="tr-input pl-9"
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
    </Sheet>
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
