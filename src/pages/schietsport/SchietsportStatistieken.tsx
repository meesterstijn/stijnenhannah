import { useMemo, useState } from "react";
import { ChartLine, Info } from "lucide-react";
import {
  Panel,
  PanelEmpty,
  SchietsportPageHeader,
  StatCard,
} from "@/features/schietsport/components/SchietsportSurface";
import { Segmented } from "@/features/schietsport/components/form";
import {
  RangeRows,
  ScoreTrendChart,
  SimpleLineChart,
  monthTick,
  niceScale,
} from "@/features/schietsport/components/charts";
import { TYPE_STYLE } from "@/features/schietsport/components/SessionRow";
import {
  FilterBar,
  useUiFilter,
} from "@/features/schietsport/filters/FilterBar";
import {
  SESSION_TYPE_LABELS,
  type ScoreScale,
  type SessionType,
} from "@/features/schietsport/domain/rules";
import {
  cardPositionAverages,
  filterSessions,
  monthlyAverages,
  splitByScale,
  summarize,
} from "@/features/schietsport/domain/stats";
import {
  groupRows,
  monthlyConsistency,
  trendSeries,
} from "@/features/schietsport/domain/insights";
import {
  useCompetitionMembership,
  useDisciplines,
  useSessions,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import {
  formatInt,
  formatMean,
  formatPercent,
} from "@/features/schietsport/lib/format";

const NONE: never[] = [];

export default function SchietsportStatistieken() {
  const sessions = useSessions();
  const weapons = useWeapons({ includeArchived: true }) ?? NONE;
  const disciplines = useDisciplines({ includeArchived: true }) ?? NONE;
  const entries = useCompetitionMembership() ?? NONE;
  const { filter, setFilter, sessionFilter } = useUiFilter();
  const [scaleChoice, setScaleChoice] = useState<ScoreScale>(300);
  const [showMa5, setShowMa5] = useState(true);
  const [showMa10, setShowMa10] = useState(false);

  const filtered = useMemo(
    () => filterSessions(sessions ?? NONE, sessionFilter, entries),
    [sessions, sessionFilter, entries],
  );
  const byScale = useMemo(() => splitByScale(filtered), [filtered]);
  // Valt de gekozen schaal leeg terwijl de andere gegevens heeft, toon die.
  const scale: ScoreScale =
    byScale[scaleChoice].length === 0 &&
    byScale[scaleChoice === 300 ? 50 : 300].length > 0
      ? scaleChoice === 300
        ? 50
        : 300
      : scaleChoice;
  const selection = byScale[scale];
  const summary = summarize(selection);
  const trend = useMemo(() => trendSeries(selection), [selection]);
  const months = useMemo(() => monthlyAverages(selection), [selection]);
  const consistency = useMemo(() => monthlyConsistency(selection), [selection]);

  const weaponName = (id: string) =>
    weapons.find((w) => w.id === id)?.name ?? "Onbekend wapen";
  const disciplineName = (id: string) =>
    disciplines.find((d) => d.id === id)?.name ?? "—";
  const rowsByWeapon = groupRows(
    selection,
    (s) => s.weaponId ?? "onbekend",
    weaponName,
  );
  const rowsByDistance = groupRows(
    selection,
    (s) => String(s.distance),
    (k) => `${k} meter`,
  );
  const rowsByDiscipline = groupRows(
    selection,
    (s) => s.disciplineId,
    disciplineName,
  );
  const rowsByType = groupRows(
    selection,
    (s) => s.type,
    (k) => SESSION_TYPE_LABELS[k as SessionType],
  );
  const cardGroups = scale === 300 ? cardPositionAverages(selection) : [];

  if (sessions !== undefined && sessions.length === 0) {
    return (
      <div className="space-y-5">
        <SchietsportPageHeader icon={ChartLine} title="Statistieken" />
        <Panel title="Nog geen gegevens">
          <PanelEmpty
            icon={ChartLine}
            text="Zodra je schietbeurten vastlegt, verschijnen hier je analyses."
          />
        </Panel>
      </div>
    );
  }

  const scaleLabel =
    scale === 300 ? "wedstrijden (schaal 300)" : "vrije kaarten (schaal 50)";

  return (
    <div className="space-y-5">
      <SchietsportPageHeader
        icon={ChartLine}
        title="Statistieken"
        description="Combineer filters om precies te zien hoe je je ontwikkelt."
      />

      <FilterBar filter={filter} onChange={setFilter} showCompetition />

      <Segmented
        ariaLabel="Schaal"
        value={scale}
        onChange={setScaleChoice}
        options={[
          {
            value: 300,
            label: "Wedstrijden",
            detail: `schaal 300 · ${byScale[300].length}×`,
          },
          {
            value: 50,
            label: "Vrije kaarten",
            detail: `schaal 50 · ${byScale[50].length}×`,
          },
        ]}
      />

      {!summary ? (
        <Panel title="Geen resultaten">
          <PanelEmpty
            icon={ChartLine}
            text="Geen schietbeurten met deze filters."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Gemiddelde"
              value={formatMean(summary.mean)}
              suffix={`/${scale}`}
              detail={formatPercent(summary.percentOfMax) + " van max"}
            />
            <StatCard
              label="Mediaan"
              value={formatMean(summary.median)}
              suffix={`/${scale}`}
            />
            <StatCard
              label="Hoogste"
              tone="copper"
              value={summary.max}
              suffix={`/${scale}`}
              detail="persoonlijk record"
            />
            <StatCard
              label="Laagste"
              value={summary.min}
              suffix={`/${scale}`}
            />
            <StatCard
              label="Spreiding"
              value={formatMean(summary.stdDev)}
              detail={`σ · bereik ${summary.range}`}
            />
            <StatCard label="Schietbeurten" value={summary.count} />
            <StatCard label="Schoten" value={formatInt(summary.totalShots)} />
            <StatCard
              label="Laatste 5"
              value={
                trend.at(-1)?.ma5 != null ? formatMean(trend.at(-1)!.ma5!) : "—"
              }
              suffix={trend.at(-1)?.ma5 != null ? `/${scale}` : undefined}
              detail={
                trend.at(-1)?.ma10 != null
                  ? `laatste 10: ${formatMean(trend.at(-1)!.ma10!)}`
                  : "voortschrijdend gemiddelde"
              }
            />
          </div>

          <Panel title="Scoreontwikkeling">
            <div className="-mt-2 mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Alle {scaleLabel}, op volgorde
              </p>
              <div className="flex gap-1.5 text-xs">
                {[
                  { label: "Gem. 5", on: showMa5, set: setShowMa5 },
                  { label: "Gem. 10", on: showMa10, set: setShowMa10 },
                ].map((toggle) => (
                  <button
                    key={toggle.label}
                    type="button"
                    aria-pressed={toggle.on}
                    onClick={() => toggle.set(!toggle.on)}
                    className={`rounded-full border px-2.5 py-1 transition-colors ${
                      toggle.on
                        ? "border-white/25 bg-white/10 text-foreground"
                        : "border-white/10 text-muted-foreground"
                    }`}
                  >
                    {toggle.label}
                  </button>
                ))}
              </div>
            </div>
            <ScoreTrendChart
              points={trend}
              scale={scale}
              showMa5={showMa5}
              showMa10={showMa10}
            />
          </Panel>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Gemiddelde per maand">
              {months.length > 1 ? (
                <SimpleLineChart
                  data={months}
                  xKey="month"
                  yKey="mean"
                  xFormatter={monthTick}
                  yDomain={["auto", "auto"]}
                  valueLabel="Gemiddelde"
                  ariaLabel="Gemiddelde score per maand"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Meer maanden nodig voor een verloop.
                </p>
              )}
            </Panel>
            <Panel title="Consistentie">
              <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                Standaardafwijking per maand: lager = constanter.
              </p>
              {consistency.length > 1 ? (
                <SimpleLineChart
                  data={consistency}
                  xKey="month"
                  yKey="stdDev"
                  xFormatter={monthTick}
                  yDomain={["auto", "auto"]}
                  valueLabel="Spreiding"
                  color="var(--ss-series-2)"
                  ariaLabel="Spreiding van scores per maand"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Meer maanden nodig voor een verloop.
                </p>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Per wapen">
              <RangeRows rows={rowsByWeapon} scale={scale} />
            </Panel>
            {scale === 300 && rowsByType.length > 0 && (
              <Panel title="Wedstrijd versus oefenwedstrijd">
                <RangeRows
                  rows={rowsByType}
                  scale={scale}
                  colorOf={(key) => TYPE_STYLE[key as SessionType].color}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Beide op schaal 300; een oefenwedstrijd telt niet mee voor
                  competities.
                </p>
              </Panel>
            )}
            <Panel title="Per afstand">
              <RangeRows rows={rowsByDistance} scale={scale} />
            </Panel>
            <Panel title="Per discipline">
              <RangeRows rows={rowsByDiscipline} scale={scale} />
            </Panel>
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Afstanden en disciplines verschillen in moeilijkheid. Vergelijk
            wapens het eerlijkst met dezelfde afstand, discipline en hetzelfde
            type (gebruik de filters).
          </p>

          {scale === 300 && (
            <Panel title="Kaartanalyse">
              <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                Gemiddelde per kaart, alleen binnen dezelfde kaartindeling:
                verandert je score in de loop van een wedstrijd?
              </p>
              {cardGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nog geen wedstrijden of oefenwedstrijden met kaartscores in
                  deze selectie.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {cardGroups.map((group) => {
                    const max = group.cards[0].shotCount * 10;
                    const means = group.cards.map((c) => c.mean);
                    return (
                      <div key={group.layoutKey}>
                        <p className="mb-2 text-sm font-medium">
                          {group.layoutLabel}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            · {group.sessionCount}× · max {max} per kaart
                          </span>
                        </p>
                        <SimpleLineChart
                          data={group.cards.map((c) => ({
                            kaart: `Kaart ${c.cardNumber}`,
                            mean: c.mean,
                          }))}
                          xKey="kaart"
                          yKey="mean"
                          yDomain={niceScale(means, max).domain}
                          yTicks={niceScale(means, max).ticks}
                          valueLabel="Gemiddelde"
                          height={180}
                          ariaLabel={`Gemiddelde per kaart, indeling ${group.layoutLabel}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
