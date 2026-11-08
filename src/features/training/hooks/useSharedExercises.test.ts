import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { sharedToExercise } = await import("./useSharedExercises");

describe("sharedToExercise", () => {
  it("neemt de gegevens over en markeert als gedeeld", () => {
    const e = sharedToExercise({
      id: "x",
      name: "Leg press",
      data: {
        primary: ["quads"],
        tracking: "weight_reps",
        loadMode: "none",
        defaultRestSec: 120,
        steps: ["Duw"],
      },
    });
    expect(e).toMatchObject({
      id: "x",
      name: "Leg press",
      primary: ["quads"],
      defaultRestSec: 120,
      steps: ["Duw"],
      shared: true,
    });
    expect(e.custom).toBeUndefined();
  });

  it("ontbrekende of verkeerde velden krijgen veilige standaardwaarden", () => {
    const e = sharedToExercise({
      id: "y",
      name: "Raar",
      data: { primary: "borst", steps: null, defaultRestSec: -5, link: 3 },
    });
    expect(e).toMatchObject({
      primary: [],
      secondary: [],
      steps: [],
      equipment: [],
      tracking: "weight_reps",
      loadMode: "none",
      defaultRestSec: 90,
      link: undefined,
    });
    expect(
      sharedToExercise({ id: "z", name: "Leeg", data: null as never })
        .alternatives,
    ).toEqual([]);
  });
});
