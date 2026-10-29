import { useState, type ReactNode } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Sheet, NumberField } from "@/features/training/components/ui";
import type { SessionExercise, SetValues, Tracking } from "@/features/training/domain/types";
import { formatDuration, formatKg, roundKg } from "@/features/training/domain/units";
import { positionKey, type DoneMap, type Position } from "@/features/training/domain/workout";

export function describeValues(tracking: Tracking, v: SetValues, perSide?: boolean): string {
  const side = perSide ? " per kant" : "";
  switch (tracking) {
    case "weight_reps":
      return `${formatKg(v.weightKg)} kg × ${v.reps ?? "–"}${side}`;
    case "bodyweight_reps":
      return `${v.reps ?? "–"} herh.${side}${v.weightKg ? ` · +${formatKg(v.weightKg)} kg` : ""}`;
    case "duration":
      return `${formatDuration(v.durationSec)}${side}`;
    case "jump_rope":
      return `${formatDuration(v.durationSec)}${v.jumps ? ` · ${v.jumps} sprongen` : ""}`;
  }
}

// Groot getal met plus/min. Tik op het getal om exact in te typen.
export function Stepper({
  label,
  value,
  display,
  unit,
  step,
  min = 0,
  max,
  onChange,
  integer = false,
  extra,
}: {
  label: string;
  value: number | null;
  display?: string;
  unit: string;
  step: number;
  min?: number;
  max: number;
  onChange: (value: number | null) => void;
  integer?: boolean;
  extra?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | null>(value);
  const change = (delta: number) => {
    const base = value ?? (delta > 0 ? 0 : min);
    const next = integer ? Math.round(base + delta) : roundKg(base + delta);
    onChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <div className="tr-card-flat px-2 py-2">
      <div className="flex items-center justify-between px-1">
        <span className="tr-label">{label}</span>
        {extra}
      </div>
      <div className="tr-stepper mt-1">
        <button type="button" className="tr-step" onClick={() => change(-step)} aria-label={`${label} min ${step}`}>
          <Minus className="h-6 w-6" />
        </button>
        <button
          type="button"
          className="tr-value"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          aria-label={`${label}: ${display ?? value ?? "leeg"} ${unit}. Tik om te typen.`}
        >
          <span className="tr-big-number">{display ?? (value === null ? "–" : String(value).replace(".", ","))}</span>
          <span className="tr-muted ml-1 text-base font-semibold">{unit}</span>
        </button>
        <button type="button" className="tr-step" onClick={() => change(step)} aria-label={`${label} plus ${step}`}>
          <Plus className="h-6 w-6" />
        </button>
      </div>
      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title={label}
        footer={
          <>
            <button type="button" className="tr-btn tr-btn-ghost" onClick={() => setEditing(false)}>
              Annuleren
            </button>
            <button
              type="button"
              className="tr-btn tr-btn-primary"
              onClick={() => {
                onChange(draft === null ? null : Math.min(max, Math.max(min, integer ? Math.round(draft) : roundKg(draft))));
                setEditing(false);
              }}
            >
              Opslaan
            </button>
          </>
        }
      >
        <NumberField label={`${label} (${unit})`} value={draft} onChange={setDraft} integer={integer} suffix={unit} />
      </Sheet>
    </div>
  );
}

export function SetList({
  exercise,
  done,
  cursor,
  onSelect,
  onEditDone,
}: {
  exercise: SessionExercise;
  done: DoneMap;
  cursor: Position | null;
  onSelect: (p: Position) => void;
  onEditDone: (p: Position) => void;
}) {
  const rows: { p: Position; v: SetValues; label: string }[] = [
    ...exercise.warmup.map((v, index) => ({ p: { slot: exercise.slot, kind: "warmup" as const, index }, v, label: `W${index + 1}` })),
    ...exercise.work.map((v, index) => ({ p: { slot: exercise.slot, kind: "work" as const, index }, v, label: String(index + 1) })),
  ];
  return (
    <ol className="space-y-1" aria-label="Sets">
      {rows.map(({ p, v, label }) => {
        const doneSet = done.get(positionKey(p));
        const isCurrent = !!cursor && positionKey(cursor) === positionKey(p);
        const state = doneSet ? "done" : isCurrent ? "current" : "todo";
        const shown = doneSet ?? v;
        return (
          <li key={positionKey(p)}>
            <button
              type="button"
              className="tr-set-row w-full text-left"
              data-state={state}
              onClick={() => (doneSet ? onEditDone(p) : onSelect(p))}
              aria-label={`${p.kind === "warmup" ? "Opwarmset" : "Set"} ${label}: ${describeValues(exercise.tracking, shown, exercise.perSide)}${doneSet ? ", voltooid" : ""}`}
            >
              <span className="tr-set-dot">{doneSet ? <Check className="h-4 w-4" /> : label}</span>
              <span className="tr-num font-semibold">
                {describeValues(exercise.tracking, shown, exercise.perSide)}
                {p.kind === "warmup" && <span className="tr-muted ml-2 text-xs font-medium">opwarmen</span>}
              </span>
              <span className="tr-muted text-xs">{doneSet ? "aanpassen" : isCurrent ? "nu" : ""}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function SetValueFields({
  tracking,
  value,
  onChange,
}: {
  tracking: Tracking;
  value: SetValues;
  onChange: (v: SetValues) => void;
}) {
  const field = (key: keyof SetValues, label: string, suffix: string, integer = true) => (
    <NumberField label={label} value={value[key]} suffix={suffix} integer={integer} onChange={(n) => onChange({ ...value, [key]: n })} />
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {(tracking === "weight_reps" || tracking === "bodyweight_reps") && field("weightKg", tracking === "weight_reps" ? "Gewicht" : "Extra gewicht", "kg", false)}
      {(tracking === "weight_reps" || tracking === "bodyweight_reps") && field("reps", "Herhalingen", "reps")}
      {(tracking === "duration" || tracking === "jump_rope") && field("durationSec", "Duur", "sec")}
      {tracking === "jump_rope" && field("jumps", "Sprongen", "x")}
    </div>
  );
}
