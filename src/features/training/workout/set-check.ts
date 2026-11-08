import type { Tracking } from "@/features/training/domain/types";

// Na het opslaan van een set: in één tik het echte aantal herhalingen
// kiezen. Een rij rond het doel: 4 lager tot 2 hoger, nooit onder 1.
export const BELOW = 4;
export const ABOVE = 2;

export function repChoices(target: number | null): number[] {
  if (target === null || target < 1) return [];
  const from = Math.max(1, target - BELOW);
  return Array.from({ length: target + ABOVE - from + 1 }, (_, i) => from + i);
}

/** Alleen bij herhalingen: tijd of touwspringen pas je aan via "Anders…". */
export const countsReps = (tracking: Tracking) =>
  tracking === "weight_reps" || tracking === "bodyweight_reps";
