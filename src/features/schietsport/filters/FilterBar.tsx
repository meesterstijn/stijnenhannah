import { useCallback, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DISTANCES,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
} from "@/features/schietsport/domain/rules";
import {
  PERIOD_LABELS,
  PERIOD_PRESETS,
  type SessionFilter,
} from "@/features/schietsport/domain/stats";
import {
  DEFAULT_UI_FILTER,
  UNKNOWN_WEAPON,
  activeFilterCount,
  parseUiFilter,
  toSessionFilter,
  writeUiFilter,
  type UiFilter,
} from "@/features/schietsport/filters/uiFilter";
import {
  useCompetitions,
  useDisciplines,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import { inputClass } from "@/features/schietsport/components/form";
import { formatDateShort } from "@/features/schietsport/lib/format";

// Filterstaat in de URL; `sessionFilter` is direct bruikbaar voor de
// domeinfuncties (filterSessions e.d.).
export function useUiFilter(initial: Partial<UiFilter> = {}) {
  const [params, setParams] = useSearchParams();
  const hasAny = [...params.keys()].length > 0;
  const filter = useMemo(
    () =>
      hasAny ? parseUiFilter(params) : { ...DEFAULT_UI_FILTER, ...initial },
    // initial is bedoeld als constante per scherm
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, hasAny],
  );
  const setFilter = useCallback(
    (next: UiFilter) =>
      setParams((current) => writeUiFilter(next, current), { replace: true }),
    [setParams],
  );
  const sessionFilter: SessionFilter = useMemo(
    () => toSessionFilter(filter, new Date()),
    [filter],
  );
  return { filter, setFilter, sessionFilter };
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function Chip({
  label,
  summary,
  active,
  children,
}: {
  label: string;
  summary: string | null;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${
            active
              ? "border-[oklch(0.7_0.115_58/0.6)] bg-[oklch(0.7_0.115_58/0.14)] text-foreground"
              : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{label}</span>
          {summary && (
            <span className="max-w-[9rem] truncate font-medium text-foreground">
              {summary}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="schietsport-theme w-64 rounded-2xl border-white/10 p-2"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function Option({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitemcheckbox"
      aria-checked={checked}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/5"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked
            ? "border-[var(--ss-copper)] bg-[var(--ss-copper)] text-[var(--primary-foreground)]"
            : "border-white/20"
        }`}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

const summarize = (names: string[]) =>
  names.length === 0 ? null : names.length === 1 ? names[0] : `${names.length}`;

export function FilterBar({
  filter,
  onChange,
  showCompetition = false,
  showTypes = true,
}: {
  filter: UiFilter;
  onChange: (filter: UiFilter) => void;
  showCompetition?: boolean;
  showTypes?: boolean;
}) {
  const weapons = useWeapons({ includeArchived: true }) ?? [];
  const disciplines = useDisciplines({ includeArchived: true }) ?? [];
  const competitions = useCompetitions({ includeArchived: true }) ?? [];
  const set = (patch: Partial<UiFilter>) => onChange({ ...filter, ...patch });

  const weaponName = (id: string) =>
    id === UNKNOWN_WEAPON
      ? "Onbekend"
      : (weapons.find((w) => w.id === id)?.name ?? "?");
  const periodSummary =
    filter.period === "all"
      ? null
      : filter.period === "custom"
        ? [filter.from, filter.to]
            .map((d) => (d ? formatDateShort(d) : "…"))
            .join(" – ")
        : PERIOD_LABELS[filter.period];

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <Chip
        label="Wapen"
        summary={summarize(filter.weaponIds.map(weaponName))}
        active={filter.weaponIds.length > 0}
      >
        {weapons.map((weapon) => (
          <Option
            key={weapon.id}
            checked={filter.weaponIds.includes(weapon.id)}
            onClick={() =>
              set({ weaponIds: toggle(filter.weaponIds, weapon.id) })
            }
          >
            {weapon.name}
            {weapon.archivedAt && (
              <span className="text-muted-foreground"> · archief</span>
            )}
          </Option>
        ))}
        <Option
          checked={filter.weaponIds.includes(UNKNOWN_WEAPON)}
          onClick={() =>
            set({ weaponIds: toggle(filter.weaponIds, UNKNOWN_WEAPON) })
          }
        >
          Onbekend / geleend zonder profiel
        </Option>
      </Chip>

      <Chip
        label="Afstand"
        summary={summarize(
          DISTANCES.filter((d) => filter.distances.includes(d)).map(
            (d) => `${d} m`,
          ),
        )}
        active={filter.distances.length > 0}
      >
        {DISTANCES.map((distance) => (
          <Option
            key={distance}
            checked={filter.distances.includes(distance)}
            onClick={() =>
              set({ distances: toggle(filter.distances, distance) })
            }
          >
            {distance} meter
          </Option>
        ))}
      </Chip>

      <Chip
        label="Discipline"
        summary={summarize(
          filter.disciplineIds.map(
            (id) => disciplines.find((d) => d.id === id)?.name ?? "?",
          ),
        )}
        active={filter.disciplineIds.length > 0}
      >
        <div className="max-h-72 overflow-y-auto">
          {disciplines.map((discipline) => (
            <Option
              key={discipline.id}
              checked={filter.disciplineIds.includes(discipline.id)}
              onClick={() =>
                set({
                  disciplineIds: toggle(filter.disciplineIds, discipline.id),
                })
              }
            >
              {discipline.name}
            </Option>
          ))}
        </div>
      </Chip>

      {showTypes && (
        <Chip
          label="Type"
          summary={summarize(filter.types.map((t) => SESSION_TYPE_LABELS[t]))}
          active={filter.types.length > 0}
        >
          {SESSION_TYPES.map((type) => (
            <Option
              key={type}
              checked={filter.types.includes(type)}
              onClick={() => set({ types: toggle(filter.types, type) })}
            >
              {SESSION_TYPE_LABELS[type]}
            </Option>
          ))}
        </Chip>
      )}

      <Chip
        label="Periode"
        summary={periodSummary}
        active={filter.period !== "all"}
      >
        {PERIOD_PRESETS.map((preset) => (
          <Option
            key={preset}
            checked={filter.period === preset}
            onClick={() => set({ period: preset, from: null, to: null })}
          >
            {PERIOD_LABELS[preset]}
          </Option>
        ))}
        <Option
          checked={filter.period === "custom"}
          onClick={() => set({ period: "custom" })}
        >
          Zelf kiezen
        </Option>
        {filter.period === "custom" && (
          <div className="grid gap-2 p-2">
            <input
              type="date"
              aria-label="Vanaf"
              className={inputClass}
              value={filter.from ?? ""}
              onChange={(e) => set({ from: e.target.value || null })}
            />
            <input
              type="date"
              aria-label="Tot en met"
              className={inputClass}
              value={filter.to ?? ""}
              onChange={(e) => set({ to: e.target.value || null })}
            />
          </div>
        )}
      </Chip>

      {showCompetition && competitions.length > 0 && (
        <Chip
          label="Competitie"
          summary={
            competitions.find((c) => c.id === filter.competitionId)?.name ??
            null
          }
          active={!!filter.competitionId}
        >
          {competitions.map((competition) => (
            <Option
              key={competition.id}
              checked={filter.competitionId === competition.id}
              onClick={() =>
                set({
                  competitionId:
                    filter.competitionId === competition.id
                      ? null
                      : competition.id,
                })
              }
            >
              {competition.name}
            </Option>
          ))}
        </Chip>
      )}

      {activeFilterCount(filter) > 0 && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_UI_FILTER)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Wis filters
        </button>
      )}
    </div>
  );
}
