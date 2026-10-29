import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  ChartCard,
  TrendLine,
  shortDate,
} from "@/features/training/components/charts";
import {
  Loading,
  NumberField,
  PageHeader,
  Sheet,
  Stat,
} from "@/features/training/components/ui";
import {
  deleteBodyMetric,
  saveBodyMetric,
} from "@/features/training/db/repository";
import { addDays } from "@/features/training/domain/schedule";
import type { BodyMetric } from "@/features/training/domain/types";
import { formatKg } from "@/features/training/domain/units";
import { useTraining } from "@/features/training/hooks/TrainingProvider";
import {
  useBodyMetrics,
  useToday,
} from "@/features/training/hooks/useTrainingData";

const MEASUREMENTS: { key: string; label: string }[] = [
  { key: "waist", label: "Taille" },
  { key: "chest", label: "Borst" },
  { key: "hips", label: "Heupen" },
  { key: "arm", label: "Bovenarm" },
  { key: "thigh", label: "Bovenbeen" },
  { key: "calf", label: "Kuit" },
  { key: "neck", label: "Nek" },
];
const LABEL = Object.fromEntries(MEASUREMENTS.map((m) => [m.key, m.label]));

// Lichaamsgewicht per datum (één meting per dag) en optionele omtrekmaten.
export default function TrainingLichaam() {
  const metrics = useBodyMetrics();
  const { db, userId } = useTraining();
  const { today } = useToday();
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState<number | null>(null);
  const [extra, setExtra] = useState<Record<string, number | null>>({});
  const [notes, setNotes] = useState("");
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState<BodyMetric | null>(null);
  const [measure, setMeasure] = useState("weight");

  const existing = metrics?.find((m) => m.measuredOn === date);
  const withWeight = useMemo(
    () => (metrics ?? []).filter((m) => m.weightKg !== null),
    [metrics],
  );

  if (!metrics) return <Loading />;

  const latest = withWeight[withWeight.length - 1];
  const monthAgo = [...withWeight]
    .reverse()
    .find((m) => m.measuredOn <= addDays(today, -30));
  const weights = withWeight.map((m) => m.weightKg!);

  const loadDate = (d: string) => {
    setDate(d);
    const m = metrics.find((x) => x.measuredOn === d);
    setWeight(m?.weightKg ?? null);
    setExtra(m?.measurements ?? {});
    setNotes(m?.notes ?? "");
  };

  const save = async () => {
    setError(null);
    if (weight !== null && (weight < 20 || weight > 400))
      return setError("Vul een gewicht tussen 20 en 400 kg in.");
    if (date > today) return setError("Een datum in de toekomst kan niet.");
    const measurements: Record<string, number> = {};
    for (const [k, v] of Object.entries(extra))
      if (v !== null && v > 0 && v < 400) measurements[k] = v;
    if (weight === null && Object.keys(measurements).length === 0)
      return setError("Vul een gewicht of een maat in.");
    await saveBodyMetric(db, userId, {
      measuredOn: date,
      weightKg: weight !== null ? Math.round(weight * 100) / 100 : null,
      measurements,
      notes,
    });
    setWeight(null);
    setExtra({});
    setNotes("");
    setDate(today);
  };

  const measureSeries = (key: string) =>
    metrics
      .filter((m) =>
        key === "weight"
          ? m.weightKg !== null
          : m.measurements?.[key] !== undefined,
      )
      .map((m) => ({
        key: m.id,
        label: shortDate(m.measuredOn),
        value: key === "weight" ? m.weightKg : m.measurements[key],
      }));
  const usedKeys = MEASUREMENTS.filter((m) =>
    metrics.some((x) => x.measurements?.[m.key] !== undefined),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lichaamsgewicht"
        subtitle="Optioneel. Eén meting per dag; opnieuw invullen op dezelfde dag past die aan."
      />

      <section className="tr-card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="tr-field">
            <span>Datum</span>
            <input
              className="tr-input"
              type="date"
              value={date}
              max={today}
              onChange={(e) => loadDate(e.target.value)}
            />
          </label>
          <NumberField
            label="Gewicht"
            suffix="kg"
            value={weight}
            onChange={setWeight}
            placeholder={latest ? formatKg(latest.weightKg) : undefined}
          />
        </div>
        {existing && (
          <p className="tr-muted text-xs">
            Voor deze datum staat al een meting; opslaan past die aan.
          </p>
        )}
        <button
          type="button"
          className="tr-btn tr-btn-quiet -ml-2"
          onClick={() => setShowMeasurements(!showMeasurements)}
        >
          {showMeasurements
            ? "Maten verbergen"
            : "Lichaamsmaten toevoegen (cm)"}
        </button>
        {showMeasurements && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MEASUREMENTS.map((m) => (
              <NumberField
                key={m.key}
                label={m.label}
                suffix="cm"
                value={extra[m.key] ?? null}
                onChange={(v) => setExtra({ ...extra, [m.key]: v })}
              />
            ))}
          </div>
        )}
        <label className="tr-field">
          <span>Notitie (optioneel)</span>
          <input
            className="tr-input"
            value={notes}
            maxLength={200}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {error && <p className="tr-danger-text text-sm">{error}</p>}
        <button
          type="button"
          className="tr-btn tr-btn-primary"
          onClick={() => void save()}
        >
          Opslaan
        </button>
      </section>

      {latest && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Laatste"
            value={`${formatKg(latest.weightKg)} kg`}
            hint={shortDate(latest.measuredOn)}
          />
          <Stat
            label="30 dagen"
            value={
              monthAgo
                ? `${latest.weightKg! - monthAgo.weightKg! > 0 ? "+" : ""}${formatKg(Math.round((latest.weightKg! - monthAgo.weightKg!) * 100) / 100)} kg`
                : "–"
            }
            hint={
              monthAgo
                ? `sinds ${shortDate(monthAgo.measuredOn)}`
                : "nog te weinig metingen"
            }
          />
          <Stat
            label="Laagste"
            value={`${formatKg(Math.min(...weights))} kg`}
          />
          <Stat
            label="Hoogste"
            value={`${formatKg(Math.max(...weights))} kg`}
          />
        </section>
      )}

      {measureSeries(measure).length > 1 && (
        <ChartCard
          title={
            measure === "weight"
              ? "Gewicht door de tijd"
              : `${LABEL[measure]} door de tijd`
          }
          unit={measure === "weight" ? "kg" : "cm"}
          data={measureSeries(measure)}
        >
          {usedKeys.length > 0 && (
            <select
              className="tr-select mb-3 max-w-xs"
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              aria-label="Meting"
            >
              <option value="weight">Gewicht</option>
              {usedKeys.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
          <TrendLine
            unit={measure === "weight" ? "kg" : "cm"}
            data={measureSeries(measure)}
          />
        </ChartCard>
      )}

      {metrics.length > 0 && (
        <section className="tr-card p-4">
          <h2 className="tr-h2 mb-2">Metingen</h2>
          <ul className="divide-y" style={{ borderColor: "var(--tr-border)" }}>
            {[...metrics].reverse().map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => loadDate(m.measuredOn)}
                >
                  <span className="tr-num font-semibold">
                    {m.weightKg !== null ? `${formatKg(m.weightKg)} kg` : "—"}
                  </span>
                  <span className="tr-muted ml-2 text-sm">
                    {new Date(`${m.measuredOn}T12:00:00`).toLocaleDateString(
                      "nl-NL",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                  </span>
                  {Object.keys(m.measurements ?? {}).length > 0 && (
                    <span className="tr-muted block truncate text-xs">
                      {Object.entries(m.measurements)
                        .map(([k, v]) => `${LABEL[k] ?? k} ${formatKg(v)} cm`)
                        .join(" · ")}
                    </span>
                  )}
                  {m.notes && (
                    <span className="tr-muted block truncate text-xs">
                      {m.notes}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="tr-icon-btn"
                  aria-label="Verwijderen"
                  onClick={() => setRemove(m)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet
        open={!!remove}
        onClose={() => setRemove(null)}
        title="Meting verwijderen?"
      >
        <button
          type="button"
          className="tr-btn tr-btn-danger tr-btn-block"
          onClick={async () => {
            if (remove) await deleteBodyMetric(db, remove.id);
            setRemove(null);
          }}
        >
          Verwijderen
        </button>
      </Sheet>
    </div>
  );
}
