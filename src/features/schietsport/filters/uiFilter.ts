import {
  DISTANCES,
  isDistance,
  isSessionType,
  type Distance,
  type SessionType,
} from "@/features/schietsport/domain/rules";
import {
  PERIOD_PRESETS,
  resolvePeriod,
  type PeriodPreset,
  type SessionFilter,
} from "@/features/schietsport/domain/stats";

// Filterstaat zoals de gebruiker 'm kiest, opgeslagen in de URL
// (?w=..&d=..&disc=..&t=..&p=..&from=..&to=..&c=..), zodat filters bewaard
// blijven bij terugnavigeren en een weergave deelbaar/te bookmarken is.

export const UNKNOWN_WEAPON = "onbekend";

export type UiFilter = {
  weaponIds: string[]; // UNKNOWN_WEAPON = onbekend wapen
  distances: Distance[];
  disciplineIds: string[];
  types: SessionType[];
  period: PeriodPreset | "custom";
  from: string | null; // alleen bij "custom"
  to: string | null;
  competitionId: string | null;
};

export const DEFAULT_UI_FILTER: UiFilter = {
  weaponIds: [],
  distances: [],
  disciplineIds: [],
  types: [],
  period: "all",
  from: null,
  to: null,
  competitionId: null,
};

const list = (value: string | null) =>
  value ? value.split(",").filter(Boolean) : [];
const isYmd = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function parseUiFilter(params: URLSearchParams): UiFilter {
  const period = params.get("p");
  const from = params.get("from");
  const to = params.get("to");
  return {
    weaponIds: list(params.get("w")),
    distances: list(params.get("d")).map(Number).filter(isDistance),
    disciplineIds: list(params.get("disc")),
    types: list(params.get("t")).filter(isSessionType),
    period:
      period === "custom" || PERIOD_PRESETS.includes(period as PeriodPreset)
        ? (period as UiFilter["period"])
        : "all",
    from: isYmd(from) ? from : null,
    to: isYmd(to) ? to : null,
    competitionId: params.get("c") || null,
  };
}

// Schrijft de filter in bestaande params (andere parameters blijven staan).
export function writeUiFilter(
  filter: UiFilter,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(base);
  const set = (key: string, value: string | null) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };
  set("w", filter.weaponIds.join(","));
  set("d", DISTANCES.filter((d) => filter.distances.includes(d)).join(","));
  set("disc", filter.disciplineIds.join(","));
  set("t", filter.types.join(","));
  set("p", filter.period === "all" ? null : filter.period);
  set("from", filter.period === "custom" ? filter.from : null);
  set("to", filter.period === "custom" ? filter.to : null);
  set("c", filter.competitionId);
  return params;
}

export function toSessionFilter(filter: UiFilter, today: Date): SessionFilter {
  const period =
    filter.period === "custom"
      ? { from: filter.from, to: filter.to }
      : resolvePeriod(filter.period, today);
  return {
    weaponIds: filter.weaponIds.map((id) =>
      id === UNKNOWN_WEAPON ? null : id,
    ),
    distances: filter.distances,
    disciplineIds: filter.disciplineIds,
    types: filter.types,
    from: period.from,
    to: period.to,
    competitionId: filter.competitionId,
  };
}

export function activeFilterCount(filter: UiFilter): number {
  return (
    (filter.weaponIds.length > 0 ? 1 : 0) +
    (filter.distances.length > 0 ? 1 : 0) +
    (filter.disciplineIds.length > 0 ? 1 : 0) +
    (filter.types.length > 0 ? 1 : 0) +
    (filter.period !== "all" ? 1 : 0) +
    (filter.competitionId ? 1 : 0)
  );
}
