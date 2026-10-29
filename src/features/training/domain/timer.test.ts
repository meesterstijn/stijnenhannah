import { describe, expect, it } from "vitest";
import {
  IDLE,
  adjustTimer,
  isFinished,
  parseTimerState,
  pauseTimer,
  progress,
  remainingMs,
  resumeTimer,
  startTimer,
} from "./timer";

const T0 = 1_000_000;

describe("rusttimer (deadline)", () => {
  it("rekent de resterende tijd uit de klok, niet uit tikken", () => {
    const t = startTimer(120_000, T0);
    expect(remainingMs(t, T0)).toBe(120_000);
    // Tabblad 90 s in de achtergrond zonder één interval: klopt toch.
    expect(remainingMs(t, T0 + 90_000)).toBe(30_000);
    expect(isFinished(t, T0 + 119_999)).toBe(false);
    expect(isFinished(t, T0 + 120_000)).toBe(true);
    expect(remainingMs(t, T0 + 500_000)).toBe(0);
  });

  it("pauzeren en hervatten bewaart de resterende tijd", () => {
    const paused = pauseTimer(startTimer(60_000, T0), T0 + 20_000);
    expect(remainingMs(paused, T0 + 999_000)).toBe(40_000);
    const resumed = resumeTimer(paused, T0 + 100_000);
    expect(remainingMs(resumed, T0 + 110_000)).toBe(30_000);
  });

  it("+15 en −15 seconden, nooit onder nul", () => {
    let t = startTimer(60_000, T0);
    t = adjustTimer(t, 15_000, T0);
    expect(remainingMs(t, T0)).toBe(75_000);
    t = adjustTimer(t, -15_000, T0);
    t = adjustTimer(t, -15_000, T0);
    expect(remainingMs(t, T0)).toBe(45_000);
    t = adjustTimer(t, -100_000, T0);
    expect(remainingMs(t, T0)).toBe(0);
    expect(isFinished(t, T0)).toBe(true);
  });

  it("voortgang loopt van 0 naar 1", () => {
    const t = startTimer(100_000, T0);
    expect(progress(t, T0)).toBe(0);
    expect(progress(t, T0 + 50_000)).toBeCloseTo(0.5);
    expect(progress(t, T0 + 200_000)).toBe(1);
    expect(progress(IDLE, T0)).toBe(0);
  });

  it("herstelt na opnieuw openen uit opslag", () => {
    const stored = JSON.parse(
      JSON.stringify(startTimer(90_000, T0, "Bankdrukken", 2)),
    );
    const restored = parseTimerState(stored);
    expect(remainingMs(restored, T0 + 30_000)).toBe(60_000);
    expect(restored.status === "running" && restored.slot).toBe(2);
    expect(parseTimerState({ status: "running" })).toEqual(IDLE);
    expect(parseTimerState("rommel")).toEqual(IDLE);
  });
});
