import { Check, Undo2 } from "lucide-react";
import type { SetValues, Tracking } from "@/features/training/domain/types";
import { describeValues } from "./SetControls";
import { countsReps, repChoices } from "./set-check";

export type LastDone = {
  id: string;
  label: string; // "Set 2" / "Opwarmset 1"
  warmup: boolean;
  tracking: Tracking;
  perSide?: boolean;
  target: SetValues; // wat op de knop stond
  values: SetValues; // wat nu is opgeslagen
  confirmed: boolean; // "Ja, gehaald" of een getal gekozen
};

// Direct na het opslaan (ook tijdens de rust): klopt het, of deed je
// minder/meer? Eén tik op het echte aantal past de set aan; de trainer
// rekent daarmee.
export function SetCheck({
  last,
  onReps,
  onConfirm,
  onOther,
  onUndo,
}: {
  last: LastDone;
  onReps: (reps: number) => void;
  onConfirm: () => void;
  onOther: () => void;
  onUndo: () => void;
}) {
  const summary = describeValues(last.tracking, last.values, last.perSide);
  const choices = countsReps(last.tracking) ? repChoices(last.target.reps) : [];

  // Opwarmsets tellen niet mee voor de trainer: alleen een korte regel.
  if (last.warmup || last.confirmed || choices.length === 0) {
    return (
      <div
        className="tr-card flex items-center justify-between gap-2 px-3 py-2"
        role="status"
      >
        <span className="flex items-center gap-1.5 text-sm">
          {last.confirmed && <Check className="tr-aqua-text h-4 w-4" />}
          <span className="tr-muted">{last.label}:</span>{" "}
          <span className="tr-num font-semibold">{summary}</span>
        </span>
        <span className="flex shrink-0 items-center">
          {!last.warmup && (
            <button
              type="button"
              className="tr-btn tr-btn-quiet px-2"
              onClick={onOther}
            >
              Aanpassen
            </button>
          )}
          <button
            type="button"
            className="tr-btn tr-btn-quiet px-2"
            onClick={onUndo}
            aria-label="Ongedaan maken"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <section
      className="tr-card space-y-3 p-4"
      aria-label={`Hoeveel herhalingen deed je bij ${last.label}?`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Hoeveel herhalingen deed je?</p>
          <p className="tr-muted text-sm">
            {last.label} opgeslagen als{" "}
            <span className="tr-num font-semibold">{summary}</span>
          </p>
        </div>
        <button
          type="button"
          className="tr-btn tr-btn-quiet -mr-2 -mt-1 shrink-0 px-2"
          onClick={onUndo}
          aria-label="Ongedaan maken"
        >
          <Undo2 className="h-4 w-4" />
        </button>
      </div>
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Aantal herhalingen"
      >
        {choices.map((n) => {
          const isTarget = n === last.target.reps;
          return (
            <button
              key={n}
              type="button"
              className={`tr-chip tr-num min-w-[2.75rem] justify-center text-base ${isTarget ? "tr-chip-aqua" : ""}`}
              aria-pressed={n === last.values.reps && !isTarget}
              aria-label={
                isTarget ? `${n} herhalingen (gehaald)` : `${n} herhalingen`
              }
              onClick={() => (isTarget ? onConfirm() : onReps(n))}
            >
              {n}
              {isTarget && <Check className="h-4 w-4" />}
            </button>
          );
        })}
        <button type="button" className="tr-chip" onClick={onOther}>
          Anders…
        </button>
      </div>
      <p className="tr-muted text-xs">
        Tik op wat je echt deed. De trainer bepaalt daarmee wanneer je zwaarder
        kunt.
      </p>
    </section>
  );
}
