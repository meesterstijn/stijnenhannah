import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_FILTER,
  UNKNOWN_WEAPON,
  activeFilterCount,
  parseUiFilter,
  toSessionFilter,
  writeUiFilter,
  type UiFilter,
} from "@/features/schietsport/filters/uiFilter";

describe("filters in de URL", () => {
  it("heen en terug zonder verlies", () => {
    const filter: UiFilter = {
      weaponIds: ["w1", UNKNOWN_WEAPON],
      distances: [25, 12],
      disciplineIds: ["d1"],
      types: ["match", "practice_match"],
      period: "custom",
      from: "2026-01-01",
      to: "2026-06-30",
      competitionId: "c1",
    };
    const parsed = parseUiFilter(writeUiFilter(filter));
    expect(parsed).toEqual({ ...filter, distances: [12, 25] });
  });

  it("ongeldige waarden worden genegeerd", () => {
    const parsed = parseUiFilter(
      new URLSearchParams("d=15,10&t=match,raar&p=ooit&from=gisteren"),
    );
    expect(parsed).toMatchObject({
      distances: [10],
      types: ["match"],
      period: "all",
      from: null,
    });
  });

  it("andere parameters blijven staan; standaardfilter schrijft niets", () => {
    const params = writeUiFilter(
      DEFAULT_UI_FILTER,
      new URLSearchParams("tab=x"),
    );
    expect(params.toString()).toBe("tab=x");
    expect(activeFilterCount(DEFAULT_UI_FILTER)).toBe(0);
  });

  it("omzetten naar een domeinfilter, incl. onbekend wapen en periode", () => {
    const result = toSessionFilter(
      {
        ...DEFAULT_UI_FILTER,
        weaponIds: [UNKNOWN_WEAPON, "w1"],
        period: "30d",
      },
      new Date(2026, 9, 29),
    );
    expect(result).toMatchObject({
      weaponIds: [null, "w1"],
      from: "2026-09-30",
      to: "2026-10-29",
    });
  });
});
