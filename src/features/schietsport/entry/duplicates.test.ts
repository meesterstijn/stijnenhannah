import { describe, expect, it } from "vitest";
import { makeSession } from "@/features/schietsport/domain/test-fixtures";
import { findPossibleDuplicate } from "@/features/schietsport/entry/duplicates";

const now = new Date("2026-10-29T12:00:00Z");
const base = {
  sessionDate: "2026-10-29",
  type: "match" as const,
  disciplineId: "d1",
  distance: 25 as const,
  weaponId: "w1",
  totalScore: 287,
};

describe("dubbele registratie", () => {
  it("herkent dezelfde beurt die net is opgeslagen", () => {
    const recent = makeSession({ ...base, createdAt: "2026-10-29T11:55:00Z" });
    expect(findPossibleDuplicate([recent], base, now)?.id).toBe(recent.id);
  });

  it("niet bij andere score, ouder dan 15 minuten, verwijderd of bij bewerken van zichzelf", () => {
    const other = makeSession({
      ...base,
      totalScore: 288,
      createdAt: "2026-10-29T11:55:00Z",
    });
    const old = makeSession({ ...base, createdAt: "2026-10-29T11:00:00Z" });
    const deleted = makeSession({
      ...base,
      createdAt: "2026-10-29T11:55:00Z",
      deletedAt: "2026-10-29T11:56:00Z",
    });
    const self = makeSession({ ...base, createdAt: "2026-10-29T11:55:00Z" });
    expect(findPossibleDuplicate([other, old, deleted], base, now)).toBeNull();
    expect(
      findPossibleDuplicate([self], { ...base, id: self.id }, now),
    ).toBeNull();
  });
});
