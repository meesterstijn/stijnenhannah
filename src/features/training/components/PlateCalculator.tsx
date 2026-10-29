import { useMemo, useState } from "react";
import { calculatePlates, plateRequestFor, type PlateCombo } from "@/features/training/domain/plates";
import type { EquipmentConfig, LoadMode } from "@/features/training/domain/types";
import { formatKg } from "@/features/training/domain/units";
import { useProfile, useUpdateProfile } from "@/features/training/hooks/useTrainingData";
import { NumberField, Segment } from "./ui";

function ComboView({ combo, implementsCount }: { combo: PlateCombo; implementsCount: number }) {
  if (combo.length === 0) return <p className="tr-muted text-sm">Geen schijven: alleen de stang.</p>;
  const plates = combo.flatMap((p) => Array.from({ length: p.perSide }, () => p.weightKg));
  const max = Math.max(...plates);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1" aria-hidden="true">
        <div className="h-2 w-10 rounded-full" style={{ background: "var(--tr-steel)" }} />
        {plates.map((w, i) => (
          <div
            key={i}
            className="flex items-center justify-center rounded-md text-[10px] font-bold"
            style={{
              width: 14 + Math.round((w / max) * 8),
              height: 26 + Math.round((w / max) * 34),
              background: w >= 10 ? "var(--tr-grape)" : w >= 5 ? "var(--tr-aqua)" : "var(--tr-border-strong)",
              color: w >= 10 ? "var(--tr-on-grape)" : "var(--tr-ink)",
            }}
          />
        ))}
      </div>
      <p className="text-sm">
        <strong>Per kant{implementsCount > 1 ? ", per dumbbell" : ""}:</strong>{" "}
        {combo.map((p) => `${p.perSide} × ${formatKg(p.weightKg)} kg`).join(" + ")}
      </p>
    </div>
  );
}

// Schijvenverdeling voor een doelgewicht, met alleen schijven die je hebt.
export function PlateCalculator({
  loadMode,
  targetKg,
  onPick,
}: {
  loadMode: LoadMode;
  targetKg: number | null;
  onPick?: (kg: number) => void;
}) {
  const { equipment } = useProfile();
  const update = useUpdateProfile();
  const [mode, setMode] = useState<LoadMode>(loadMode === "none" ? "barbell" : loadMode);
  const [target, setTarget] = useState<number | null>(targetKg);
  const [barDraft, setBarDraft] = useState<number | null>(null);
  const request = target !== null ? plateRequestFor(mode, target, equipment) : null;
  const result = useMemo(() => (request ? calculatePlates(request) : null), [request]);
  const isBar = mode === "barbell";
  const missingWeight = isBar ? equipment.barbell.weightKg === null : equipment.dumbbells.handleWeightKg === null;

  const setEquipment = (change: (e: EquipmentConfig) => EquipmentConfig) =>
    update((p) => ({ ...p, equipment: change(p.equipment) }));

  return (
    <div className="space-y-4">
      <Segment
        label="Soort"
        value={mode}
        onChange={setMode}
        options={[
          { value: "barbell", label: "Lange stang" },
          { value: "dumbbell_pair", label: "2 dumbbells" },
          { value: "dumbbell_single", label: "1 dumbbell" },
        ]}
      />
      <NumberField
        label={isBar ? "Doelgewicht totaal" : "Doelgewicht per dumbbell"}
        value={target}
        onChange={setTarget}
        suffix="kg"
      />
      {missingWeight && (
        <div className="tr-banner tr-banner-warn flex-col">
          <span>
            Het gewicht van {isBar ? "de lange stang" : "een dumbbellstang"} is nog onbekend. Weeg hem (bijvoorbeeld op een
            personenweegschaal) en vul het in; het wordt bewaard.
          </span>
          <div className="flex w-full items-end gap-2">
            <div className="flex-1">
              <NumberField
                label={isBar ? "Gewicht lange stang" : "Gewicht per dumbbellstang"}
                value={barDraft}
                suffix="kg"
                onChange={setBarDraft}
              />
            </div>
            <button
              type="button"
              className="tr-btn tr-btn-secondary"
              disabled={barDraft === null || barDraft <= 0}
              onClick={() =>
                barDraft &&
                void setEquipment((e) =>
                  isBar
                    ? { ...e, barbell: { ...e.barbell, weightKg: barDraft } }
                    : { ...e, dumbbells: { ...e.dumbbells, handleWeightKg: barDraft } },
                )
              }
            >
              Bewaar
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className="space-y-3">
          <p className="tr-muted text-sm">
            {isBar ? "Stang" : "Dumbbellstang"} {formatKg(request!.barKg)} kg
            {request!.collarKg > 0 && ` + sluitingen 2 × ${formatKg(request!.collarKg)} kg`}
            {result.perSideKg > 0 && ` · ${formatKg(result.perSideKg)} kg per kant`}
            {mode === "dumbbell_pair" && " · beide dumbbells tegelijk geladen"}
          </p>
          {result.warnings.map((w) => (
            <div key={w} className="tr-banner tr-banner-warn">
              {w}
            </div>
          ))}
          {result.options.map((combo, i) => (
            <div key={i} className="tr-card-flat p-3">
              {result.options.length > 1 && <div className="tr-label mb-2">Verdeling {i + 1}</div>}
              <ComboView combo={combo} implementsCount={request!.implements} />
            </div>
          ))}
          {!result.exact && (
            <div className="grid gap-2 sm:grid-cols-2">
              {[result.nearestBelow, result.nearestAbove].map(
                (near, i) =>
                  near && (
                    <div key={i} className="tr-card-flat space-y-2 p-3">
                      <div className="tr-label">{i === 0 ? "Dichtstbij lager" : "Dichtstbij hoger"}</div>
                      <div className="text-lg font-bold">{formatKg(near.totalKg)} kg</div>
                      <ComboView combo={near.combo} implementsCount={request!.implements} />
                      {onPick && (
                        <button type="button" className="tr-btn tr-btn-ghost" onClick={() => onPick(near.totalKg)}>
                          Gebruik {formatKg(near.totalKg)} kg
                        </button>
                      )}
                    </div>
                  ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
