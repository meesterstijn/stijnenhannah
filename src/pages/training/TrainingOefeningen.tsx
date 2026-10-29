import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Star } from "lucide-react";
import { exerciseMatches } from "@/features/training/components/ExercisePicker";
import { PageHeader } from "@/features/training/components/ui";
import { isAvailable } from "@/features/training/domain/exercises";
import {
  MUSCLE_GROUPS,
  type ExerciseType,
  type MuscleGroup,
} from "@/features/training/domain/types";
import {
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  equipmentLabel,
} from "@/features/training/domain/units";
import {
  useExercises,
  useProfile,
} from "@/features/training/hooks/useTrainingData";

export const TYPE_LABELS: Record<ExerciseType, string> = {
  compound: "Compound",
  isolation: "Isolatie",
  core: "Core",
  conditioning: "Conditie",
};

export default function TrainingOefeningen() {
  const { all } = useExercises();
  const { exercisePrefs, equipment } = useProfile();
  const owned = useMemo(() => new Set(equipment.owned), [equipment.owned]);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | "">("");
  const [gear, setGear] = useState("");
  const [type, setType] = useState<ExerciseType | "">("");
  const [favorites, setFavorites] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const list = useMemo(
    () =>
      all
        .filter(
          (e) =>
            !e.archived &&
            exerciseMatches(e, query) &&
            (!muscle ||
              e.primary.includes(muscle) ||
              e.secondary.includes(muscle)) &&
            (!gear || e.equipment.includes(gear)) &&
            (!type || e.type === type) &&
            (!favorites || exercisePrefs[e.id]?.favorite) &&
            (!onlyAvailable || isAvailable(e, owned)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "nl")),
    [
      all,
      query,
      muscle,
      gear,
      type,
      favorites,
      onlyAvailable,
      exercisePrefs,
      owned,
    ],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Oefeningen"
        subtitle={`${all.filter((e) => !e.archived).length} oefeningen, met techniek, veelgemaakte fouten en veiligheid.`}
        actions={
          <Link to="/training/oefeningen/nieuw" className="tr-btn tr-btn-ghost">
            <Plus className="h-4 w-4" /> Eigen oefening
          </Link>
        }
      />
      <div className="tr-card space-y-3 p-3">
        <label className="relative block">
          <Search className="tr-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            className="tr-input pl-9"
            placeholder="Zoeken"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select
            className="tr-select"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value as MuscleGroup | "")}
            aria-label="Spiergroep"
          >
            <option value="">Alle spiergroepen</option>
            {MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABELS[m]}
              </option>
            ))}
          </select>
          <select
            className="tr-select"
            value={gear}
            onChange={(e) => setGear(e.target.value)}
            aria-label="Materiaal"
          >
            <option value="">Alle materialen</option>
            {Object.entries(EQUIPMENT_LABELS)
              .filter(([k]) => k !== "plates")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
          <select
            className="tr-select col-span-2 sm:col-span-1"
            value={type}
            onChange={(e) => setType(e.target.value as ExerciseType | "")}
            aria-label="Type"
          >
            <option value="">Alle typen</option>
            {(Object.keys(TYPE_LABELS) as ExerciseType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="tr-chip"
            aria-pressed={favorites}
            onClick={() => setFavorites(!favorites)}
          >
            <Star className="h-3.5 w-3.5" /> Favorieten
          </button>
          <button
            type="button"
            className="tr-chip"
            aria-pressed={onlyAvailable}
            onClick={() => setOnlyAvailable(!onlyAvailable)}
          >
            Kan met mijn apparatuur
          </button>
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((e) => (
          <li key={e.id}>
            <Link
              to={`/training/oefeningen/${e.id}`}
              className="tr-card flex h-full flex-col gap-1 p-3"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                {exercisePrefs[e.id]?.favorite && (
                  <Star className="tr-aqua-text h-4 w-4 fill-current" />
                )}
                {e.name}
                {e.custom && <span className="tr-chip ml-auto">Eigen</span>}
              </span>
              <span className="tr-muted text-sm">
                {e.primary.map((m) => MUSCLE_LABELS[m]).join(", ")} ·{" "}
                {TYPE_LABELS[e.type]}
              </span>
              <span className="tr-muted text-xs">
                {e.equipment.map(equipmentLabel).join(", ")}
                {!isAvailable(e, owned) && " · apparatuur ontbreekt"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className="tr-muted py-8 text-center">Geen oefeningen gevonden.</p>
      )}
    </div>
  );
}
