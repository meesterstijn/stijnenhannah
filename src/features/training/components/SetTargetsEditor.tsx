import { Plus, X } from "lucide-react";
import { NumberField, Switch } from "./ui";
import {
  MAX_SETS,
  initialTargets,
  isTimed,
  resizeTargets,
} from "@/features/training/domain/set-targets";
import type {
  Exercise,
  PlannedExercise,
  PlannedSetTarget,
} from "@/features/training/domain/types";

const fmtKg = (kg: number) => String(kg).replace(".", ",");

// Schema-editor: gewicht en herhalingen (of tijd) per werkset, bijv. een
// piramide. Uit = één voorschrift voor alle sets.
export function SetTargetsEditor({
  planned,
  exercise,
  trainerKg,
  onChange,
}: {
  planned: PlannedExercise;
  exercise: Exercise;
  trainerKg: number | null;
  onChange: (targets: PlannedSetTarget[] | null) => void;
}) {
  const targets = planned.setTargets?.length ? planned.setTargets : null;
  const timed = isTimed(exercise.tracking);
  const weighted =
    exercise.tracking === "weight_reps" ||
    exercise.tracking === "bodyweight_reps";
  const weightLabel =
    exercise.tracking === "bodyweight_reps" ? "Extra kg" : "Gewicht";

  const update = (i: number, patch: Partial<PlannedSetTarget>) =>
    targets &&
    onChange(targets.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-2">
      <Switch
        label="Per set instellen"
        description={
          timed
            ? "Eigen tijd per set"
            : "Bijv. 10 × 20 kg, 10 × 25 kg, 8 × 30 kg"
        }
        checked={targets !== null}
        onChange={(on) =>
          onChange(on ? initialTargets(planned, exercise.tracking) : null)
        }
      />
      {targets && (
        <>
          <ol className="space-y-2">
            {targets.map((t, i) => (
              <li
                key={i}
                className="grid grid-cols-[3.25rem_1fr_1fr_auto] items-end gap-2"
              >
                <span className="tr-label pb-3">Set {i + 1}</span>
                {weighted && (
                  <NumberField
                    label={weightLabel}
                    suffix="kg"
                    value={t.weightKg}
                    placeholder={
                      trainerKg !== null && i === 0
                        ? fmtKg(trainerKg)
                        : undefined
                    }
                    onChange={(v) => update(i, { weightKg: v })}
                  />
                )}
                {timed ? (
                  <NumberField
                    label="Tijd"
                    integer
                    suffix="sec"
                    value={t.durationSec}
                    onChange={(v) => update(i, { durationSec: v })}
                  />
                ) : (
                  <NumberField
                    label="Herhalingen"
                    integer
                    value={t.reps}
                    onChange={(v) => update(i, { reps: v })}
                  />
                )}
                {timed && <span />}
                <button
                  type="button"
                  className="tr-icon-btn mb-0.5"
                  aria-label={`Set ${i + 1} verwijderen`}
                  disabled={targets.length <= 1}
                  onClick={() => onChange(targets.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            disabled={targets.length >= MAX_SETS}
            onClick={() => onChange(resizeTargets(targets, targets.length + 1))}
          >
            <Plus className="h-4 w-4" /> Set toevoegen
          </button>
          <p className="tr-muted text-xs">
            Geldt de eerste keer en na elke wijziging hier. Daarna staat per set
            klaar wat je de vorige keer echt deed. De trainer geeft hier geen
            verhoogadvies: zwaarder gaan doe je door de sets hier aan te passen.
          </p>
        </>
      )}
    </div>
  );
}
