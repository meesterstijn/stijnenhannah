import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, GitCompareArrows, Info } from "lucide-react";
import {
  Panel,
  PanelEmpty,
  SchietsportPageHeader,
} from "@/features/schietsport/components/SchietsportSurface";
import { Segmented } from "@/features/schietsport/components/form";
import { RangeRows } from "@/features/schietsport/components/charts";
import {
  FilterBar,
  useUiFilter,
} from "@/features/schietsport/filters/FilterBar";
import type { ScoreScale } from "@/features/schietsport/domain/rules";
import {
  filterSessions,
  splitByScale,
  summarize,
} from "@/features/schietsport/domain/stats";
import type { GroupRow } from "@/features/schietsport/domain/insights";
import {
  useCompetitionMembership,
  useSessions,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import { formatMean } from "@/features/schietsport/lib/format";

const NONE: never[] = [];
const SERIES = [1, 2, 3, 4, 5, 6].map((n) => `var(--ss-series-${n})`);
const FALLBACK = "oklch(0.7 0.01 85)";

// Twee of meer wapens naast elkaar, bij voorkeur met dezelfde afstand,
// discipline en hetzelfde type (filters). Kleur volgt het wapen (vaste
// positie in je wapenlijst), niet de selectie.
export default function SchietsportWapensVergelijken() {
  const allWeapons = useWeapons({ includeArchived: true });
  const sessions = useSessions() ?? NONE;
  const entries = useCompetitionMembership() ?? NONE;
  const { filter, setFilter, sessionFilter } = useUiFilter();
  const [params, setParams] = useSearchParams();
  const [scale, setScale] = useState<ScoreScale>(300);

  const ordered = useMemo(
    () =>
      [...(allWeapons ?? NONE)].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
    [allWeapons],
  );
  const colorOf = (weaponId: string) => {
    const index = ordered.findIndex((w) => w.id === weaponId);
    return index >= 0 && index < SERIES.length ? SERIES[index] : FALLBACK;
  };

  const requested = (params.get("wapens") ?? "").split(",").filter(Boolean);
  const active = ordered.filter((w) => !w.archivedAt);
  const selected =
    requested.length > 0
      ? requested.filter((id) => ordered.some((w) => w.id === id))
      : active.slice(0, 2).map((w) => w.id);
  const setSelected = (ids: string[]) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (ids.length > 0) next.set("wapens", ids.join(","));
        else next.delete("wapens");
        return next;
      },
      { replace: true },
    );

  const filtered = splitByScale(
    filterSessions(
      sessions,
      { ...sessionFilter, weaponIds: selected },
      entries,
    ),
  )[scale];
  const rows: GroupRow[] = selected
    .map((id) => {
      const summary = summarize(filtered.filter((s) => s.weaponId === id));
      const weapon = ordered.find((w) => w.id === id);
      return summary && weapon
        ? { key: id, label: weapon.name, summary }
        : null;
    })
    .filter((row): row is GroupRow => row !== null);

  return (
    <div className="space-y-5">
      <SchietsportPageHeader
        icon={GitCompareArrows}
        title="Wapens vergelijken"
        description="Kies twee of meer wapens en vergelijk onder dezelfde omstandigheden."
      />

      <div className="flex flex-wrap gap-2">
        {ordered
          .filter((w) => !w.archivedAt || selected.includes(w.id))
          .map((weapon) => {
            const on = selected.includes(weapon.id);
            return (
              <button
                key={weapon.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSelected(
                    on
                      ? selected.filter((id) => id !== weapon.id)
                      : [...selected, weapon.id],
                  )
                }
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                  on
                    ? "border-white/25 bg-white/10 text-foreground"
                    : "border-white/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: colorOf(weapon.id) }}
                />
                {weapon.name}
                {on && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
      </div>

      <FilterBar filter={filter} onChange={setFilter} showWeapons={false} />
      <Segmented
        ariaLabel="Schaal"
        value={scale}
        onChange={setScale}
        options={[
          { value: 300, label: "Wedstrijden", detail: "schaal 300" },
          { value: 50, label: "Vrije kaarten", detail: "schaal 50" },
        ]}
      />

      {selected.length < 2 ? (
        <Panel title="Kies wapens">
          <PanelEmpty
            icon={GitCompareArrows}
            text="Selecteer minstens twee wapens hierboven."
          />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel title="Geen gegevens">
          <PanelEmpty
            icon={GitCompareArrows}
            text="Geen schietbeurten met deze wapens en filters."
          />
        </Panel>
      ) : (
        <>
          <Panel title="Bandbreedte en gemiddelde">
            <RangeRows rows={rows} scale={scale} colorOf={colorOf} />
          </Panel>
          <Panel title="Tabel">
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-left text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Wapen</th>
                    {[
                      "n",
                      "Gem.",
                      "Mediaan",
                      "Hoogste",
                      "Laagste",
                      "Spreiding",
                    ].map((h) => (
                      <th key={h} className="px-2 py-2 text-right font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td className="px-2 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: colorOf(row.key) }}
                          />
                          {row.label}
                        </span>
                      </td>
                      <td className="ss-number px-2 text-right">
                        {row.summary.count}
                      </td>
                      <td className="ss-number px-2 text-right font-semibold">
                        {formatMean(row.summary.mean)}
                      </td>
                      <td className="ss-number px-2 text-right">
                        {formatMean(row.summary.median)}
                      </td>
                      <td className="ss-number px-2 text-right">
                        {row.summary.max}
                      </td>
                      <td className="ss-number px-2 text-right">
                        {row.summary.min}
                      </td>
                      <td className="ss-number px-2 text-right">
                        {formatMean(row.summary.stdDev)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Eerlijk vergelijken: zet afstand, discipline en type vast met de
            filters. Zonder filters kunnen verschillen ook door de
            omstandigheden komen.
          </p>
        </>
      )}
    </div>
  );
}
