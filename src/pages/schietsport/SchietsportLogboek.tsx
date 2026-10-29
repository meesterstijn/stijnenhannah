import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { NotebookText, Plus, Search } from "lucide-react";
import {
  Panel,
  PanelEmpty,
  SchietsportPageHeader,
} from "@/features/schietsport/components/SchietsportSurface";
import {
  NativeSelect,
  inputClass,
} from "@/features/schietsport/components/form";
import { SessionRow } from "@/features/schietsport/components/SessionRow";
import { ExportMenu } from "@/features/schietsport/components/ExportMenu";
import {
  FilterBar,
  useUiFilter,
} from "@/features/schietsport/filters/FilterBar";
import { SESSION_TYPE_LABELS } from "@/features/schietsport/domain/rules";
import { filterSessions } from "@/features/schietsport/domain/stats";
import {
  useCompetitionEntries,
  useDisciplines,
  useSessions,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import { formatMonth } from "@/features/schietsport/lib/format";
import { SCHIETSPORT_NEW_PATH } from "@/features/schietsport/nav";

type Sort = "date_desc" | "date_asc" | "score_desc" | "score_asc";

// Stabiele lege lijsten tijdens het laden (anders rekent useMemo elke render).
const NONE: never[] = [];

export default function SchietsportLogboek() {
  const sessions = useSessions();
  const weapons = useWeapons({ includeArchived: true }) ?? NONE;
  const disciplines = useDisciplines({ includeArchived: true }) ?? NONE;
  const entries = useCompetitionEntries() ?? NONE;
  const { filter, setFilter, sessionFilter } = useUiFilter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("date_desc");

  const visible = useMemo(() => {
    if (!sessions) return [];
    const q = query.trim().toLowerCase();
    const filtered = filterSessions(sessions, sessionFilter, entries).filter(
      (session) => {
        if (!q) return true;
        const haystack = [
          session.notes,
          weapons.find((w) => w.id === session.weaponId)?.name,
          disciplines.find((d) => d.id === session.disciplineId)?.name,
          SESSION_TYPE_LABELS[session.type],
          String(session.totalScore),
          `${session.distance} m`,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      },
    );
    const percent = (s: (typeof filtered)[number]) => s.totalScore / s.maxScore;
    const byDate = (
      a: (typeof filtered)[number],
      b: (typeof filtered)[number],
    ) =>
      a.sessionDate.localeCompare(b.sessionDate) ||
      a.createdAt.localeCompare(b.createdAt);
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return byDate(a, b);
        case "score_desc":
          return percent(b) - percent(a) || b.totalScore - a.totalScore;
        case "score_asc":
          return percent(a) - percent(b) || a.totalScore - b.totalScore;
        default:
          return byDate(b, a);
      }
    });
  }, [sessions, sessionFilter, entries, query, sort, weapons, disciplines]);

  // Op datum gesorteerd: groeperen per maand.
  const groups = useMemo(() => {
    if (sort !== "date_desc" && sort !== "date_asc") {
      return [{ key: "all", label: null as string | null, items: visible }];
    }
    const map = new Map<string, typeof visible>();
    for (const session of visible) {
      const key = session.sessionDate.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), session]);
    }
    return [...map].map(([key, items]) => ({
      key,
      label: formatMonth(key),
      items,
    }));
  }, [visible, sort]);

  return (
    <div className="space-y-5">
      <SchietsportPageHeader
        icon={NotebookText}
        title="Logboek"
        description="Al je schietbeurten op een rij."
        actions={<ExportMenu sessions={visible} />}
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${inputClass} pl-10`}
              placeholder="Zoeken in notities, wapens, disciplines…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
            />
          </div>
          <NativeSelect
            className="sm:w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sorteren"
          >
            <option value="date_desc">Nieuwste eerst</option>
            <option value="date_asc">Oudste eerst</option>
            <option value="score_desc">Hoogste score</option>
            <option value="score_asc">Laagste score</option>
          </NativeSelect>
        </div>
        <FilterBar filter={filter} onChange={setFilter} showCompetition />
      </div>

      {sessions && sessions.length === 0 ? (
        <Panel title="Nog geen schietbeurten">
          <PanelEmpty
            icon={NotebookText}
            text="Je logboek is nog leeg. Leg je eerste wedstrijd of vrije kaart vast."
            action={{ to: SCHIETSPORT_NEW_PATH, label: "Nieuwe schietbeurt" }}
          />
        </Panel>
      ) : visible.length === 0 && sessions ? (
        <Panel title="Geen resultaten">
          <PanelEmpty
            icon={Search}
            text="Geen schietbeurten met deze filters."
          />
        </Panel>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {visible.length}{" "}
            {visible.length === 1 ? "schietbeurt" : "schietbeurten"}
          </p>
          {groups.map((group) => (
            <section key={group.key} className="ss-card p-2 sm:p-3">
              {group.label && (
                <p className="ss-eyebrow px-2.5 pb-1 pt-2 capitalize">
                  {group.label}
                </p>
              )}
              <div className="divide-y divide-white/5">
                {group.items.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    weapons={weapons}
                    disciplines={disciplines}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <Link
        to={SCHIETSPORT_NEW_PATH}
        className="hidden items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:inline-flex"
      >
        <Plus className="h-4 w-4" /> Nieuwe schietbeurt
      </Link>
    </div>
  );
}
