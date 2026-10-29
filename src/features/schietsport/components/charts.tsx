import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  SESSION_TYPE_LABELS,
  type ScoreScale,
  type SessionType,
} from "@/features/schietsport/domain/rules";
import type {
  GroupRow,
  TrendPoint,
} from "@/features/schietsport/domain/insights";
import { TYPE_STYLE } from "@/features/schietsport/components/SessionRow";
import { niceScale } from "@/features/schietsport/lib/axis";

export { niceScale };
import {
  formatDate,
  formatDateShort,
  formatMean,
  formatMonth,
} from "@/features/schietsport/lib/format";

// Grafieken volgens de dataviz-richtlijnen: dunne lijnen (2px), punten
// ≥ 8px met een ring in de oppervlaktekleur, haarfijne recessieve grid,
// één y-as, legenda bij ≥ 2 reeksen, tekst nooit in reekskleur, en altijd
// een tooltip. Kleuren komen uit --ss-series-* (gevalideerd).

const SURFACE = "#1d1c19";
const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 };
const AVERAGE_COLOR = "oklch(0.9 0.02 85)";
const AVERAGE_10_COLOR = "oklch(0.7 0.02 85)";

function niceDomain(values: number[], scale: number): [number, number] {
  return niceScale(values, scale).domain;
}

export function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[oklch(0.17_0.008_85/0.96)] px-3 py-2 text-xs shadow-xl backdrop-blur">
      {children}
    </div>
  );
}

export function LegendItem({
  color,
  label,
  kind = "dot",
}: {
  color: string;
  label: string;
  kind?: "dot" | "line";
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {kind === "dot" ? (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: color }}
        />
      ) : (
        <span
          className="h-0.5 w-4 rounded-full"
          style={{ background: color }}
        />
      )}
      {label}
    </span>
  );
}

// ── Scoreverloop ──────────────────────────────────────────────────────

export function ScoreTrendChart({
  points,
  scale,
  showMa5 = true,
  showMa10 = false,
  height = 260,
}: {
  points: TrendPoint[];
  scale: ScoreScale;
  showMa5?: boolean;
  showMa10?: boolean;
  height?: number;
}) {
  const types = [...new Set(points.map((p) => p.type))] as SessionType[];
  const { domain, ticks } = niceScale(
    points.map((p) => p.score),
    scale,
  );
  const hasMa5 = showMa5 && points.some((p) => p.ma5 !== null);
  const hasMa10 = showMa10 && points.some((p) => p.ma10 !== null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {types.map((type) => (
          <LegendItem
            key={type}
            color={TYPE_STYLE[type].color}
            label={SESSION_TYPE_LABELS[type]}
          />
        ))}
        {hasMa5 && (
          <LegendItem
            color={AVERAGE_COLOR}
            label="Gem. laatste 5"
            kind="line"
          />
        )}
        {hasMa10 && (
          <LegendItem
            color={AVERAGE_10_COLOR}
            label="Gem. laatste 10"
            kind="line"
          />
        )}
      </div>
      <div style={{ height }} role="img" aria-label="Scoreverloop">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          >
            <CartesianGrid vertical={false} stroke="var(--ss-grid)" />
            <XAxis
              dataKey="index"
              type="number"
              domain={[0, Math.max(points.length - 1, 1)]}
              tickFormatter={(i: number) =>
                points[i] ? formatDateShort(points[i].sessionDate) : ""
              }
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              minTickGap={28}
            />
            <YAxis
              domain={domain}
              ticks={ticks}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={44}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "oklch(1 0 0 / 0.2)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as TrendPoint | undefined;
                if (!active || !point) return null;
                return (
                  <TooltipBox>
                    <p className="font-medium">
                      {formatDate(point.sessionDate)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: TYPE_STYLE[point.type].color }}
                      />
                      {SESSION_TYPE_LABELS[point.type]}:{" "}
                      <span className="ss-number font-semibold">
                        {point.score}/{scale}
                      </span>
                    </p>
                    {hasMa5 && point.ma5 !== null && (
                      <p className="text-muted-foreground">
                        Gem. laatste 5: {formatMean(point.ma5)}
                      </p>
                    )}
                    {hasMa10 && point.ma10 !== null && (
                      <p className="text-muted-foreground">
                        Gem. laatste 10: {formatMean(point.ma10)}
                      </p>
                    )}
                  </TooltipBox>
                );
              }}
            />
            <Line
              dataKey="score"
              stroke="oklch(1 0 0 / 0.14)"
              strokeWidth={1.5}
              isAnimationActive={false}
              dot={(props: {
                cx?: number;
                cy?: number;
                payload?: TrendPoint;
                index?: number;
              }) => (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={4.5}
                  fill={
                    props.payload
                      ? TYPE_STYLE[props.payload.type].color
                      : "currentColor"
                  }
                  stroke={SURFACE}
                  strokeWidth={2}
                />
              )}
              activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
            />
            {hasMa5 && (
              <Line
                dataKey="ma5"
                stroke={AVERAGE_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {hasMa10 && (
              <Line
                dataKey="ma10"
                stroke={AVERAGE_10_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                strokeLinecap="round"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Eenvoudige lijn (maandgemiddelde, spreiding, kaartpositie) ─────────

export function SimpleLineChart({
  data,
  xKey,
  yKey,
  xFormatter,
  yDomain,
  yTicks,
  valueLabel,
  valueFormatter = formatMean,
  color = "var(--ss-series-1)",
  height = 200,
  ariaLabel,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  yKey: string;
  xFormatter?: (value: string | number) => string;
  yDomain: [number, number] | ["auto", "auto"];
  yTicks?: number[];
  valueLabel: string;
  valueFormatter?: (value: number) => string;
  color?: string;
  height?: number;
  ariaLabel: string;
}) {
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        >
          <CartesianGrid vertical={false} stroke="var(--ss-grid)" />
          <XAxis
            dataKey={xKey}
            tickFormatter={xFormatter}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            minTickGap={20}
          />
          <YAxis
            domain={yDomain}
            ticks={yTicks}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) =>
              Number.isInteger(v) ? String(v) : formatMean(v)
            }
          />
          <Tooltip
            cursor={{ stroke: "oklch(1 0 0 / 0.2)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              const value = payload?.[0]?.value;
              if (!active || typeof value !== "number") return null;
              const row = payload?.[0]?.payload as Record<string, unknown>;
              return (
                <TooltipBox>
                  <p className="font-medium">
                    {xFormatter ? xFormatter(label as string) : String(label)}
                  </p>
                  <p className="mt-1">
                    {valueLabel}:{" "}
                    <span className="ss-number font-semibold">
                      {valueFormatter(value)}
                    </span>
                  </p>
                  {typeof row.count === "number" && (
                    <p className="text-muted-foreground">
                      {row.count}{" "}
                      {row.count === 1 ? "schietbeurt" : "schietbeurten"}
                    </p>
                  )}
                </TooltipBox>
              );
            }}
          />
          <Line
            dataKey={yKey}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={false}
            dot={{ r: 4, fill: color, stroke: SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const monthTick = (value: string | number) => formatMonth(String(value));

// ── Bandbreedte per groep (wapen, afstand, discipline, type) ──────────
// Per rij: lijn van laagste tot hoogste score, stip op het gemiddelde.
// Werkt ook als tabel (de getallen staan ernaast), dus geen kleur alleen.

export function RangeRows({
  rows,
  scale,
  color = "var(--ss-series-1)",
  colorOf,
  context,
}: {
  rows: GroupRow[];
  scale: ScoreScale;
  color?: string;
  colorOf?: (key: string) => string;
  context?: (row: GroupRow) => ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Geen gegevens met deze filters.
      </p>
    );
  }
  const [lo, hi] = niceDomain(
    rows.flatMap((r) => [r.summary.min, r.summary.max]),
    scale,
  );
  const pos = (value: number) => `${((value - lo) / (hi - lo || 1)) * 100}%`;
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-3 px-1 pb-1 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
        <span />
        <span className="flex justify-between">
          <span>{lo}</span>
          <span>{hi}</span>
        </span>
        <span className="w-20 text-right">gem. · n</span>
      </div>
      {rows.map((row) => {
        const rowColor = colorOf?.(row.key) ?? color;
        return (
          <div
            key={row.key}
            className="group grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2 hover:bg-white/5"
            title={`${row.label}: gemiddeld ${formatMean(row.summary.mean)}, laagste ${row.summary.min}, hoogste ${row.summary.max}, ${row.summary.count} beurten`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm">{row.label}</p>
              {context && (
                <p className="truncate text-[0.7rem] text-muted-foreground">
                  {context(row)}
                </p>
              )}
            </div>
            <div className="relative h-4">
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--ss-grid)]" />
              <div
                className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full opacity-60"
                style={{
                  left: pos(row.summary.min),
                  width: `calc(${pos(row.summary.max)} - ${pos(row.summary.min)})`,
                  background: rowColor,
                }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: pos(row.summary.mean),
                  background: rowColor,
                  boxShadow: `0 0 0 2px ${SURFACE}`,
                }}
              />
            </div>
            <p className="ss-number w-20 text-right text-sm">
              <span className="font-semibold">
                {formatMean(row.summary.mean)}
              </span>
              <span className="text-xs text-muted-foreground">
                {" "}
                · {row.summary.count}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
