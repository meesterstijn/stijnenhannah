import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Rustige grafieken: één reeks per grafiek (titel noemt de reeks, dus geen
// legenda), dunne lijnen, recessief raster, tooltip bij hover/tik, en altijd
// een tabelweergave voor wie de getallen wil zien.

export type Point = {
  key: string;
  label: string;
  value: number | null;
  detail?: string;
};

const axis = { fontSize: 11, fill: "var(--tr-muted)" } as const;

function TooltipBox({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="tr-card px-3 py-2 text-sm"
      style={{ boxShadow: "0 4px 16px rgb(0 0 0 / 0.12)" }}
    >
      <div className="tr-muted text-xs">{p.label}</div>
      <div className="tr-num font-semibold">
        {p.value === null
          ? "–"
          : p.value.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}{" "}
        {unit}
      </div>
      {p.detail && <div className="tr-muted text-xs">{p.detail}</div>}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  data,
  unit,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  data: Point[];
  unit: string;
}) {
  return (
    <section className="tr-card p-4">
      <h3 className="tr-h2">{title}</h3>
      {subtitle && <p className="tr-muted text-sm">{subtitle}</p>}
      <div className="mt-3">{children}</div>
      <details className="mt-2 text-sm">
        <summary className="tr-muted cursor-pointer select-none">Tabel</summary>
        <table className="tr-num mt-2 w-full text-left">
          <tbody>
            {data.map((p) => (
              <tr key={p.key} className="tr-divider">
                <td className="py-1 pr-2">{p.label}</td>
                <td className="py-1 text-right font-medium">
                  {p.value === null
                    ? "–"
                    : p.value.toLocaleString("nl-NL", {
                        maximumFractionDigits: 1,
                      })}{" "}
                  {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function TrendLine({
  data,
  unit,
  height = 200,
  zeroBased = false,
}: {
  data: Point[];
  unit: string;
  height?: number;
  zeroBased?: boolean;
}) {
  const values = data
    .map((d) => d.value)
    .filter((v): v is number => v !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.15);
  return (
    <div
      style={{ height }}
      role="img"
      aria-label={`Lijngrafiek, ${data.length} punten`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        >
          <CartesianGrid vertical={false} stroke="var(--tr-border)" />
          <XAxis
            dataKey="label"
            tick={axis}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={axis}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={
              zeroBased
                ? [0, "auto"]
                : [Math.floor(min - pad), Math.ceil(max + pad)]
            }
            allowDecimals={false}
          />
          <Tooltip
            content={<TooltipBox unit={unit} />}
            cursor={{ stroke: "var(--tr-steel)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--tr-chart-1)"
            strokeWidth={2}
            dot={{
              r: 4,
              fill: "var(--tr-chart-1)",
              stroke: "var(--tr-surface)",
              strokeWidth: 2,
            }}
            activeDot={{ r: 6, stroke: "var(--tr-surface)", strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CountBars({
  data,
  unit,
  height = 160,
}: {
  data: Point[];
  unit: string;
  height?: number;
}) {
  return (
    <div
      style={{ height }}
      role="img"
      aria-label={`Staafgrafiek, ${data.length} staven`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: -20 }}
          barCategoryGap={4}
        >
          <CartesianGrid vertical={false} stroke="var(--tr-border)" />
          <XAxis
            dataKey="label"
            tick={axis}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tick={axis}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            content={<TooltipBox unit={unit} />}
            cursor={{ fill: "var(--tr-surface-2)" }}
          />
          <Bar
            dataKey="value"
            fill="var(--tr-chart-1)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
