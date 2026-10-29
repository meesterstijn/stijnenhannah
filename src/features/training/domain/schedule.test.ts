import { describe, expect, it } from "vitest";
import {
  addDays,
  planToday,
  toLocalDate,
  weekOverview,
  weekStart,
  weekdayOf,
} from "./schedule";
import { day, program, session } from "./test-fixtures";

// 2026-10-26 is een maandag.
const MON = "2026-10-26";
const WED = "2026-10-28";
const THU = "2026-10-29";

const fullBody = program([
  day("a", [0], "A"),
  day("b", [2], "B"),
  day("c", [4], "C"),
]);
const done = (date: string, dayId: string, extra = {}) =>
  session(date, [], { dayId, programId: "p-1", ...extra });

describe("datums", () => {
  it("weekdag 0 = maandag, ook rond tijdzones", () => {
    expect(weekdayOf(MON)).toBe(0);
    expect(weekdayOf("2026-11-01")).toBe(6);
    expect(weekStart(THU)).toBe(MON);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    // 23:30 UTC op 31 okt is in Amsterdam al 1 nov (wintertijd: +1).
    expect(
      toLocalDate(new Date("2026-10-31T23:30:00Z"), "Europe/Amsterdam"),
    ).toBe("2026-11-01");
  });
});

describe("vaste weekplanning", () => {
  it("toont de training van vandaag", () => {
    const plan = planToday(fullBody, [], MON);
    expect(plan.day?.id).toBe("a");
    expect(plan.restDay).toBe(false);
  });

  it("een gemiste training schuift niet door maar staat klaar om in te halen", () => {
    // Woensdag: A (maandag) niet gedaan.
    const plan = planToday(fullBody, [], WED);
    expect(plan.day?.id).toBe("b"); // vandaag blijft B
    expect(plan.missed.map((d) => d.id)).toEqual(["a"]);
  });

  it("rustdag met de volgende training", () => {
    const plan = planToday(fullBody, [done(MON, "a"), done(WED, "b")], THU);
    expect(plan.restDay).toBe(true);
    expect(plan.day).toBeNull();
    expect(plan.upcoming).toEqual({
      day: fullBody.content.days[2],
      date: "2026-10-30",
    });
  });

  it("vandaag voltooid", () => {
    const plan = planToday(fullBody, [done(MON, "a")], MON);
    expect(plan.doneToday).toBe(true);
    expect(plan.day).toBeNull();
    expect(plan.upcoming?.day.id).toBe("b");
  });

  it("overslaan telt als gedaan voor de planning", () => {
    const plan = planToday(
      fullBody,
      [done(MON, "a", { status: "skipped" })],
      WED,
    );
    expect(plan.missed).toEqual([]);
  });

  it("een geannuleerde training telt niet", () => {
    const plan = planToday(
      fullBody,
      [done(MON, "a", { status: "cancelled" })],
      WED,
    );
    expect(plan.missed.map((d) => d.id)).toEqual(["a"]);
  });
});

describe("doorlopende volgorde", () => {
  const seq = program(fullBody.content.days, {
    content: { scheduleMode: "sequence", days: fullBody.content.days },
  });

  it("begint bij A en volgt daarna de volgorde, ongeacht de dag", () => {
    expect(planToday(seq, [], THU).day?.id).toBe("a");
    expect(planToday(seq, [done(MON, "a")], THU).day?.id).toBe("b");
    expect(planToday(seq, [done(MON, "a"), done(WED, "b")], THU).day?.id).toBe(
      "c",
    );
    expect(
      planToday(seq, [done(MON, "a"), done(WED, "b"), done(THU, "c")], THU).day
        ?.id,
    ).toBe("a");
  });

  it("negeert trainingen van een ander schema", () => {
    expect(
      planToday(seq, [done(MON, "a", { programId: "p-2" })], THU).day?.id,
    ).toBe("a");
  });
});

describe("weekoverzicht", () => {
  it("telt geplande en voltooide trainingen", () => {
    const week = weekOverview(
      fullBody,
      [done(MON, "a"), done("2026-10-19", "c")],
      THU,
    );
    expect(week.plannedCount).toBe(3);
    expect(week.completedCount).toBe(1);
    expect(week.days[0].planned[0].id).toBe("a");
    expect(week.days[3].isToday).toBe(true);
  });
});
