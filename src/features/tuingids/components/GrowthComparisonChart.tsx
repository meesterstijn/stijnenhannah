import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getPlantNamesWithGrowth,
  getGrowthSeries,
  toRelativeSeries,
  computeGrowthStats,
  getPlantNamesWithFruitData,
  getFruitMeasurements,
  formatMeasurement,
  type GrowthPoint,
  type FruitMeasurement,
} from "@/features/tuingids/lib/growthStats";
import { EmptyState } from "@/features/tuingids/components/EmptyState";
import type { LogEntry } from "@/features/tuingids/types";

// Validated categorical palette (dataviz skill, light-mode steps) — fixed
// order, assigned by each plant's stable index in the full plant list so a
// plant's color never shifts when other plants are toggled on/off.
const PLANT_COLORS = [
  "#2a78d6", // blue
  "#008300", // green
  "#e87ba4", // magenta
  "#eda100", // yellow
  "#1baf7a", // aqua
  "#eb6834", // orange
  "#4a3aa7", // violet
  "#e34948", // red
];

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

function segmentedButtonClass(active: boolean): string {
  return `px-3 py-1 rounded-full transition-colors ${active ? "sv-badge-ok" : "sv-muted"}`;
}

type SeriesDetail = { height: number; deltaFromPrev: number | null; relativeFromFirst: number };

function buildSeriesDetails(series: GrowthPoint[]): Map<string, SeriesDetail> {
  const map = new Map<string, SeriesDetail>();
  const baseline = series[0]?.height ?? 0;
  let prev: number | null = null;
  for (const p of series) {
    map.set(p.date, {
      height: p.height,
      deltaFromPrev: prev !== null ? p.height - prev : null,
      relativeFromFirst: p.height - baseline,
    });
    prev = p.height;
  }
  return map;
}

export function GrowthComparisonChart({ entries }: { entries: LogEntry[] }) {
  const [metric, setMetric] = useState<"height" | "fruit">("height");

  const heightPlantNames = useMemo(() => getPlantNamesWithGrowth(entries), [entries]);
  const fruitPlantNames = useMemo(() => getPlantNamesWithFruitData(entries), [entries]);
  // Union so a plant keeps the same color whether viewed under Planthoogte or Vruchtgrootte.
  const allPlantNames = useMemo(() => {
    return [...new Set([...heightPlantNames, ...fruitPlantNames])].sort();
  }, [heightPlantNames, fruitPlantNames]);

  const colorByPlant = useMemo(() => {
    const map = new Map<string, string>();
    allPlantNames.forEach((name, i) => map.set(name, PLANT_COLORS[i % PLANT_COLORS.length]));
    return map;
  }, [allPlantNames]);

  const [selected, setSelected] = useState<string[]>(() => heightPlantNames.slice(0, 3));
  const [mode, setMode] = useState<"absolute" | "relative">("absolute");

  const absoluteSeriesByPlant = useMemo(() => {
    const map = new Map<string, GrowthPoint[]>();
    for (const name of selected) map.set(name, getGrowthSeries(entries, name));
    return map;
  }, [entries, selected]);

  const detailsByPlant = useMemo(() => {
    const map = new Map<string, Map<string, SeriesDetail>>();
    for (const [name, series] of absoluteSeriesByPlant) map.set(name, buildSeriesDetails(series));
    return map;
  }, [absoluteSeriesByPlant]);

  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, number | null | string>>();
    for (const name of selected) {
      const series = mode === "relative" ? toRelativeSeries(absoluteSeriesByPlant.get(name) ?? []) : absoluteSeriesByPlant.get(name) ?? [];
      for (const point of series) {
        const row = rows.get(point.date) ?? { date: point.date };
        row[name] = point.height;
        rows.set(point.date, row);
      }
    }
    return [...rows.values()].sort((a, b) => (a.date as string).localeCompare(b.date as string));
  }, [selected, mode, absoluteSeriesByPlant]);

  function toggle(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  // ─── Fruit/vegetable size (independent from the height chart above) ──────
  const [fruitDimension, setFruitDimension] = useState<"length" | "width">("length");
  const [selectedFruit, setSelectedFruit] = useState<string[]>(() => fruitPlantNames.slice(0, 3));

  const fruitMeasurementsByPlant = useMemo(() => {
    const map = new Map<string, FruitMeasurement[]>();
    for (const name of selectedFruit) map.set(name, getFruitMeasurements(entries, name));
    return map;
  }, [entries, selectedFruit]);

  const fruitDetailsByPlant = useMemo(() => {
    const map = new Map<string, Map<string, FruitMeasurement>>();
    for (const [name, measurements] of fruitMeasurementsByPlant) {
      const inner = new Map<string, FruitMeasurement>();
      for (const m of measurements) inner.set(m.date, m);
      map.set(name, inner);
    }
    return map;
  }, [fruitMeasurementsByPlant]);

  const fruitChartData = useMemo(() => {
    const rows = new Map<string, Record<string, number | string>>();
    for (const name of selectedFruit) {
      const measurements = fruitMeasurementsByPlant.get(name) ?? [];
      for (const m of measurements) {
        const value = fruitDimension === "length" ? m.length : m.width;
        if (value === null) continue;
        const row = rows.get(m.date) ?? { date: m.date };
        row[name] = value;
        rows.set(m.date, row);
      }
    }
    return [...rows.values()].sort((a, b) => (a.date as string).localeCompare(b.date as string));
  }, [selectedFruit, fruitDimension, fruitMeasurementsByPlant]);

  function toggleFruit(name: string) {
    setSelectedFruit((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  if (allPlantNames.length === 0) {
    return (
      <EmptyState
        emoji="📈"
        title="Nog geen groeimetingen"
        description="Voeg eerst hoogte- of vruchtmetingen toe via het logboek om planten hier te vergelijken."
      />
    );
  }

  return (
    <div className="sv-panel p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="sv-heading text-xl">Groei vergelijken</p>
        <div className="flex sv-inset rounded-full p-1 gap-1 text-xs font-medium">
          <button type="button" onClick={() => setMetric("height")} className={segmentedButtonClass(metric === "height")}>
            Planthoogte
          </button>
          <button type="button" onClick={() => setMetric("fruit")} className={segmentedButtonClass(metric === "fruit")}>
            Vruchtgrootte
          </button>
        </div>
      </div>

      {metric === "height" && (
        <div className="space-y-4">
          <div className="flex sv-inset rounded-full p-1 gap-1 text-xs font-medium w-fit">
            <button type="button" onClick={() => setMode("absolute")} className={segmentedButtonClass(mode === "absolute")}>
              Absolute groei
            </button>
            <button type="button" onClick={() => setMode("relative")} className={segmentedButtonClass(mode === "relative")}>
              Relatieve groei
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {heightPlantNames.map((name) => {
              const active = selected.includes(name);
              const color = colorByPlant.get(name)!;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggle(name)}
                  className={`sv-chip px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5${active ? " active" : ""}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color, opacity: active ? 1 : 0.35 }} />
                  {name}
                </button>
              );
            })}
          </div>

          {selected.length === 0 || chartData.length === 0 ? (
            <p className="text-sm sv-muted px-1">
              {selected.length === 0 ? "Selecteer minimaal één plant om te vergelijken." : "Nog geen metingen voor de geselecteerde plant(en)."}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c4a06a" />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 11, fill: "#6b3f1f" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b3f1f" }}
                  unit=" cm"
                  label={mode === "relative" ? { value: "Groei sinds start (cm)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#6b3f1f" } : undefined}
                />
                <Tooltip content={<GrowthTooltip details={detailsByPlant} colorByPlant={colorByPlant} />} />
                {selected.map((name) => (
                  <Line key={name} type="monotone" dataKey={name} name={name} stroke={colorByPlant.get(name)} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}

          {selected.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selected.map((name) => {
                const stats = computeGrowthStats(absoluteSeriesByPlant.get(name) ?? []);
                const color = colorByPlant.get(name)!;
                return (
                  <div key={name} className="sv-inset rounded-lg p-3 space-y-1.5" style={{ borderLeft: `4px solid ${color}` }}>
                    <p className="sv-heading text-sm">{name}</p>
                    {stats ? (
                      <div className="text-xs sv-muted space-y-0.5">
                        <p>Huidige lengte: <span className="text-foreground">{stats.current} cm</span></p>
                        <p>Totale groei: <span className="text-foreground">{stats.totalGrowth >= 0 ? "+" : ""}{stats.totalGrowth} cm</span></p>
                        <p>Gemiddeld per dag: <span className="text-foreground">{stats.avgPerDay >= 0 ? "+" : ""}{stats.avgPerDay.toFixed(2)} cm</span></p>
                        {stats.biggestSpurt && (
                          <p>
                            Grootste groeispurt: <span className="text-foreground">{stats.biggestSpurt.delta >= 0 ? "+" : ""}{stats.biggestSpurt.delta} cm</span>{" "}
                            ({formatDateShort(stats.biggestSpurt.from)} → {formatDateShort(stats.biggestSpurt.to)})
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs sv-muted">Nog geen metingen.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {metric === "fruit" && (
        <div className="space-y-4">
          <div className="flex sv-inset rounded-full p-1 gap-1 text-xs font-medium w-fit">
            <button type="button" onClick={() => setFruitDimension("length")} className={segmentedButtonClass(fruitDimension === "length")}>
              Lengte
            </button>
            <button type="button" onClick={() => setFruitDimension("width")} className={segmentedButtonClass(fruitDimension === "width")}>
              Breedte / diameter
            </button>
          </div>

          {fruitPlantNames.length === 0 ? (
            <p className="text-sm sv-muted px-1">Nog geen vruchtmetingen geregistreerd.</p>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap">
                {fruitPlantNames.map((name) => {
                  const active = selectedFruit.includes(name);
                  const color = colorByPlant.get(name)!;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleFruit(name)}
                      className={`sv-chip px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5${active ? " active" : ""}`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color, opacity: active ? 1 : 0.35 }} />
                      {name}
                    </button>
                  );
                })}
              </div>

              {selectedFruit.length === 0 || fruitChartData.length === 0 ? (
                <p className="text-sm sv-muted px-1">
                  {selectedFruit.length === 0
                    ? "Selecteer minimaal één plant om te vergelijken."
                    : `Nog geen ${fruitDimension === "length" ? "lengte" : "breedte"}metingen voor de geselecteerde plant(en).`}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={fruitChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#c4a06a" />
                    <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 11, fill: "#6b3f1f" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6b3f1f" }} unit=" cm" />
                    <Tooltip content={<FruitTooltip details={fruitDetailsByPlant} colorByPlant={colorByPlant} />} />
                    {selectedFruit.map((name) => (
                      <Line key={name} type="monotone" dataKey={name} name={name} stroke={colorByPlant.get(name)} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GrowthTooltip({
  active,
  payload,
  label,
  details,
  colorByPlant,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
  details: Map<string, Map<string, SeriesDetail>>;
  colorByPlant: Map<string, string>;
}) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  return (
    <div
      className="rounded-lg p-3 text-xs space-y-2"
      style={{ background: "#f8edd2", border: "2px solid #6b3f1f", color: "#561607" }}
    >
      <p className="font-semibold">{formatDateLong(label)}</p>
      {payload.map((entry) => {
        const plantName = entry.name;
        if (!plantName) return null;
        const info = details.get(plantName)?.get(label);
        return (
          <div key={plantName} className="flex items-start gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 mt-0.5"
              style={{ background: colorByPlant.get(plantName) }}
            />
            <div>
              <p className="font-medium">{plantName}</p>
              {info && (
                <p>
                  {info.height} cm
                  {info.deltaFromPrev !== null && ` (${info.deltaFromPrev >= 0 ? "+" : ""}${info.deltaFromPrev} cm sinds vorige meting)`}
                  {" · "}
                  {info.relativeFromFirst >= 0 ? "+" : ""}
                  {info.relativeFromFirst} cm sinds eerste meting
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FruitTooltip({
  active,
  payload,
  label,
  details,
  colorByPlant,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
  details: Map<string, Map<string, FruitMeasurement>>;
  colorByPlant: Map<string, string>;
}) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  return (
    <div
      className="rounded-lg p-3 text-xs space-y-2"
      style={{ background: "#f8edd2", border: "2px solid #6b3f1f", color: "#561607" }}
    >
      <p className="font-semibold">{formatDateLong(label)}</p>
      {payload.map((entry) => {
        const plantName = entry.name;
        if (!plantName) return null;
        const info = details.get(plantName)?.get(label);
        const sizeParts = info
          ? [
              info.length !== null ? `${formatMeasurement(info.length)} cm lang` : null,
              info.width !== null ? `${formatMeasurement(info.width)} cm breed` : null,
            ].filter(Boolean)
          : [];
        return (
          <div key={plantName} className="flex items-start gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 mt-0.5"
              style={{ background: colorByPlant.get(plantName) }}
            />
            <div>
              <p className="font-medium">{plantName}</p>
              {sizeParts.length > 0 && <p>{sizeParts.join(" · ")}</p>}
              {info?.note && <p className="sv-muted">{info.note}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
