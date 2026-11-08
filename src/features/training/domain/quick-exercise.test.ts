import { describe, expect, it } from "vitest";
import { isAvailable } from "./exercises";
import { quickExercise } from "./quick-exercise";
import { MUSCLE_GROUPS } from "./types";

describe("quickExercise", () => {
  it("machine of kabel: kg × herhalingen zonder schijven en zonder apparatuureis", () => {
    const e = quickExercise({
      name: "  Leg press ",
      kind: "machine",
      primary: [MUSCLE_GROUPS[0]],
    });
    expect(e).toMatchObject({
      name: "Leg press",
      tracking: "weight_reps",
      loadMode: "none",
      equipment: [],
      custom: true,
    });
    expect(isAvailable(e, new Set())).toBe(true);
  });

  it("lange stang en dumbbells rekenen met de schijven", () => {
    expect(
      quickExercise({ name: "x", kind: "barbell", primary: [] }),
    ).toMatchObject({ loadMode: "barbell", equipment: ["barbell"] });
    expect(
      quickExercise({ name: "x", kind: "dumbbell_pair", primary: [] }),
    ).toMatchObject({ loadMode: "dumbbell_pair", equipment: ["dumbbell"] });
    expect(
      quickExercise({ name: "x", kind: "dumbbell_single", primary: [] }),
    ).toMatchObject({ loadMode: "dumbbell_single" });
  });

  it("lichaamsgewicht en tijd", () => {
    expect(
      quickExercise({ name: "x", kind: "bodyweight", primary: [] }),
    ).toMatchObject({ tracking: "bodyweight_reps", loadMode: "none" });
    expect(
      quickExercise({ name: "x", kind: "duration", primary: [] }),
    ).toMatchObject({ tracking: "duration", loadMode: "none" });
  });
});
