import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChartLine, Crosshair, NotebookText, Target } from "lucide-react";
import {
  Panel,
  PanelEmpty,
  QuickAction,
  SchietsportHero,
  StatCard,
} from "@/features/schietsport/components/SchietsportSurface";
import {
  SessionRow,
  TYPE_STYLE,
} from "@/features/schietsport/components/SessionRow";
import { WeaponRow } from "@/features/schietsport/components/WeaponCard";
import { ScoreTrendChart } from "@/features/schietsport/components/charts";
import {
  FilterBar,
  useUiFilter,
} from "@/features/schietsport/filters/FilterBar";
import {
  SESSION_TYPE_LABELS,
  SESSION_TYPE_SHORT_LABELS,
  type SessionType,
} from "@/features/schietsport/domain/rules";
import {
  filterSessions,
  splitByScale,
} from "@/features/schietsport/domain/stats";
import { headline, trendSeries } from "@/features/schietsport/domain/insights";
import {
  useCompetitionMembership,
  useDisciplines,
  useSessions,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import {
  formatDateShort,
  formatInt,
  formatMean,
} from "@/features/schietsport/lib/format";
import {
  SCHIETSPORT_BASE,
  SCHIETSPORT_NEW_PATH,
} from "@/features/schietsport/nav";

const NONE: never[] = [];
const TYPES: SessionType[] = ["match", "practice_match", "free_card"];

export default function SchietsportDashboard() {
  const sessions = useSessions();
  const weapons = useWeapons() ?? NONE;
  const allWeapons = useWeapons({ includeArchived: true }) ?? NONE;
  const disciplines = useDisciplines({ includeArchived: true }) ?? NONE;
  const entries = useCompetitionMembership() ?? NONE;
  const { filter, setFilter, sessionFilter } = useUiFilter();

  const filtered = useMemo(
    () => filterSessions(sessions ?? NONE, sessionFilter, entries),
    [sessions, sessionFilter, entries],
  );
  const stats = useMemo(
    () => headline(filtered, filter.types),
    [filtered, filter.types],
  );
  const trend = useMemo(
    () => trendSeries(splitByScale(filtered)[300]),
    [filtered],
  );
  const recent = [...filtered].reverse().slice(0, 5);
  const latest = stats.latest;
  const empty = sessions !== undefined && sessions.length === 0;

  return (
    <div className="space-y-5">
      <SchietsportHero>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Laatste resultaat"
            value={latest ? latest.totalScore : "—"}
            suffix={latest ? `/${latest.maxScore}` : undefined}
            detail={
              latest
                ? `${SESSION_TYPE_SHORT_LABELS[latest.type]} · ${formatDateShort(latest.sessionDate)} · ${latest.distance} m`
                : "Nog geen schietbeurten"
            }
          />
          <StatCard
            label="Gemiddelde"
            value={
              stats.focus.summary ? formatMean(stats.focus.summary.mean) : "—"
            }
            suffix={stats.focus.summary ? `/${stats.focus.scale}` : undefined}
            detail={
              stats.focus.summary
                ? `${stats.focus.summary.count}× ${stats.focus.label.toLowerCase()}`
                : stats.focus.label
            }
          />
          <StatCard
            label="Record"
            tone="copper"
            value={stats.focus.best ? stats.focus.best.totalScore : "—"}
            suffix={stats.focus.best ? `/${stats.focus.scale}` : undefined}
            detail={
              stats.focus.best
                ? `${stats.focus.label} · ${formatDateShort(stats.focus.best.sessionDate)}`
                : stats.focus.label
            }
          />
          <StatCard
            label="Totaal schoten"
            value={formatInt(stats.totalShots)}
            detail={`${filtered.length} ${filtered.length === 1 ? "schietbeurt" : "schietbeurten"}`}
          />
        </div>
      </SchietsportHero>

      <div className="grid grid-cols-3 gap-3">
        <QuickAction
          to={`${SCHIETSPORT_NEW_PATH}?type=match`}
          icon={TYPE_STYLE.match.icon}
          iconClassName={TYPE_STYLE.match.className}
          title="Nieuwe wedstrijd"
          detail="30 schoten"
        />
        <QuickAction
          to={`${SCHIETSPORT_NEW_PATH}?type=free_card`}
          icon={TYPE_STYLE.free_card.icon}
          iconClassName={TYPE_STYLE.free_card.className}
          title="Vrije kaart"
          detail="5 schoten"
        />
        <QuickAction
          to={`${SCHIETSPORT_BASE}/logboek`}
          icon={NotebookText}
          title="Logboek"
          detail="Alle resultaten"
        />
      </div>

      {empty ? (
        <Panel title="Welkom">
          <PanelEmpty
            icon={Target}
            text="Leg je eerste schietbeurt vast; daarna verschijnen hier je statistieken en grafieken."
            action={{ to: SCHIETSPORT_NEW_PATH, label: "Nieuwe schietbeurt" }}
          />
        </Panel>
      ) : (
        <>
          <FilterBar filter={filter} onChange={setFilter} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel
              title="Scoreontwikkeling"
              action={{
                to: `${SCHIETSPORT_BASE}/statistieken`,
                label: "Statistieken",
              }}
            >
              {trend.length > 0 ? (
                <>
                  <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                    Wedstrijden en oefenwedstrijden, schaal 300
                  </p>
                  <ScoreTrendChart points={trend} scale={300} />
                </>
              ) : (
                <PanelEmpty
                  icon={ChartLine}
                  text={
                    filtered.length > 0
                      ? "Alleen vrije kaarten in deze selectie; die staan op schaal 50 bij Statistieken."
                      : "Geen schietbeurten met deze filters."
                  }
                />
              )}
            </Panel>

            <Panel
              title="Mijn wapens"
              action={{
                to: `${SCHIETSPORT_BASE}/wapens`,
                label: "Alle wapens",
              }}
            >
              {weapons.length === 0 ? (
                <PanelEmpty
                  icon={Crosshair}
                  text="Nog geen wapens."
                  action={{
                    to: `${SCHIETSPORT_BASE}/wapens`,
                    label: "Wapen toevoegen",
                  }}
                />
              ) : (
                <div className="-mx-2 space-y-0.5">
                  {weapons.slice(0, 5).map((weapon) => (
                    <WeaponRow
                      key={weapon.id}
                      weapon={weapon}
                      sessions={filtered}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel
              title="Recente resultaten"
              action={{ to: `${SCHIETSPORT_BASE}/logboek`, label: "Logboek" }}
            >
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Geen schietbeurten met deze filters.
                </p>
              ) : (
                <div className="-mx-2 divide-y divide-white/5">
                  {recent.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      weapons={allWeapons}
                      disciplines={disciplines}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Overzicht & records">
              <div className="space-y-2.5">
                {TYPES.filter(
                  (type) => type !== "practice_match" || stats.counts[type] > 0,
                ).map((type) => {
                  const record = stats.records[type];
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${TYPE_STYLE[type].className}`}
                      >
                        {(() => {
                          const Icon = TYPE_STYLE[type].icon;
                          return <Icon className="h-4 w-4" strokeWidth={1.8} />;
                        })()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {SESSION_TYPE_LABELS[type]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stats.counts[type]}× geschoten
                        </p>
                      </div>
                      {record ? (
                        <Link
                          to={`${SCHIETSPORT_BASE}/logboek/${record.id}`}
                          className="ss-number text-right hover:text-[var(--ss-copper)]"
                          title="Persoonlijk record"
                        >
                          <span className="text-base font-semibold">
                            {record.totalScore}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            /{record.maxScore}
                          </span>
                          <span className="block text-[0.65rem] text-muted-foreground">
                            record
                          </span>
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
