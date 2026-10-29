import { describe, expect, it } from "vitest";
import { DEFAULT_EQUIPMENT } from "./defaults";
import { SYSTEM_EXERCISES, isAvailable, systemExercise } from "./exercises";
import {
  dayGoal,
  estimateMinutes,
  generateProgram,
  type GeneratorPrefs,
} from "./generator";
import { PROGRAM_TEMPLATES, programTemplate } from "./templates";

const owned = new Set(DEFAULT_EQUIPMENT.owned);
const prefs = (extra: Partial<GeneratorPrefs> = {}): GeneratorPrefs => ({
  level: "intermediate",
  goal: "combined",
  sessionMinutes: 90,
  owned,
  scheduleMode: "weekly",
  ...extra,
});

describe("oefeningenbibliotheek", () => {
  it("heeft unieke ids en geldige alternatieven", () => {
    const ids = SYSTEM_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of SYSTEM_EXERCISES) {
      for (const alt of e.alternatives)
        expect(ids, `${e.id} → ${alt}`).toContain(alt);
      expect(e.primary.length, e.id).toBeGreaterThan(0);
      expect(e.steps.length, e.id).toBeGreaterThan(0);
    }
  });

  it("geen back squat of machines; step-up vraagt een stabiele verhoging", () => {
    expect(systemExercise("back-squat")).toBeUndefined();
    expect(isAvailable(systemExercise("step-up")!, owned)).toBe(false);
  });

  it("touwspringen is de enige standaard conditieoefening", () => {
    expect(
      SYSTEM_EXERCISES.filter((e) => e.type === "conditioning").map(
        (e) => e.id,
      ),
    ).toEqual(["jump-rope"]);
    expect(systemExercise("sit-up")?.type).toBe("core");
  });
});

describe("standaardschema's", () => {
  it("alle sjablonen gebruiken bestaande oefeningen die met de thuisapparatuur kunnen", () => {
    for (const t of PROGRAM_TEMPLATES) {
      for (const d of t.days) {
        for (const e of d.exercises) {
          const exercise = systemExercise(e.exerciseId);
          expect(exercise, `${t.id}/${d.key}/${e.exerciseId}`).toBeDefined();
          expect(isAvailable(exercise!, owned), e.exerciseId).toBe(true);
        }
      }
    }
  });

  it("programma A, B en C hebben 3, 5 en 6 trainingsdagen", () => {
    expect(programTemplate("fullbody-3")?.days).toHaveLength(3);
    expect(programTemplate("split-5")?.days.map((d) => d.name)).toEqual([
      "Upper Body",
      "Lower Body",
      "Push",
      "Pull",
      "Legs",
    ]);
    expect(programTemplate("ppl-6")?.days.flatMap((d) => d.weekdays)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it("beginners krijgen minder volume dan gevorderden", () => {
    const t = programTemplate("fullbody-3")!;
    const sets = (level: GeneratorPrefs["level"]) =>
      generateProgram(
        t,
        prefs({ level }),
        systemExercise,
      ).content.days[0].exercises.reduce((n, e) => n + e.sets, 0);
    expect(sets("beginner")).toBeLessThan(sets("intermediate"));
    expect(sets("intermediate")).toBeLessThan(sets("advanced"));
  });

  it("doel bepaalt herhalingen en rust van de basisoefeningen", () => {
    const t = programTemplate("fullbody-3")!;
    const bench = (goal: GeneratorPrefs["goal"]) =>
      generateProgram(
        t,
        prefs({ goal }),
        systemExercise,
      ).content.days[0].exercises.find((e) => e.exerciseId === "bench-press")!;
    expect(bench("strength")).toMatchObject({
      repMin: 5,
      repMax: 8,
      restSec: 180,
    });
    expect(bench("hypertrophy")).toMatchObject({ repMin: 8, repMax: 12 });
  });

  it("A-dagen kracht, B-dagen spiermassa bij PPL", () => {
    expect(dayGoal("combined", "strength")).toBe("strength");
    expect(dayGoal("combined", "hypertrophy")).toBe("hypertrophy");
    expect(dayGoal("strength", "hypertrophy")).toBe("combined");
  });

  it("korte trainingsduur haalt optionele oefeningen weg, nooit de kern", () => {
    const t = programTemplate("fullbody-3")!;
    const long = generateProgram(
      t,
      prefs({ sessionMinutes: 120 }),
      systemExercise,
    ).content.days[2];
    const short = generateProgram(
      t,
      prefs({ sessionMinutes: 40 }),
      systemExercise,
    );
    const shortDay = short.content.days[2];
    expect(shortDay.exercises.length).toBeLessThan(long.exercises.length);
    expect(
      shortDay.exercises.some((e) => e.exerciseId === "db-bench-press"),
    ).toBe(true);
    expect(short.notes.some((n) => n.includes("weggelaten"))).toBe(true);
    expect(estimateMinutes(shortDay.exercises)).toBeLessThan(
      estimateMinutes(long.exercises),
    );
  });

  it("vervangt een oefening als apparatuur ontbreekt", () => {
    const noBarbell = new Set([...owned].filter((k) => k !== "barbell"));
    const result = generateProgram(
      programTemplate("fullbody-3")!,
      prefs({ owned: noBarbell }),
      systemExercise,
    );
    const ids = result.content.days.flatMap((d) =>
      d.exercises.map((e) => e.exerciseId),
    );
    expect(ids).not.toContain("bench-press");
    expect(ids).toContain("db-bench-press");
    expect(result.notes.some((n) => n.includes("vervangen"))).toBe(true);
  });
});
