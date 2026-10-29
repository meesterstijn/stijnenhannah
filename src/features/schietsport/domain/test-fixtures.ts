import type { ShootingSession } from "@/features/schietsport/domain/model";
import { maxScoreFor } from "@/features/schietsport/domain/rules";

// Alleen voor tests: compacte fabriek voor schietbeurten.
let counter = 0;

export function makeSession(
  overrides: Partial<ShootingSession> = {},
): ShootingSession {
  counter += 1;
  const type = overrides.type ?? "match";
  return {
    id: `s${counter}`,
    userId: "u1",
    createdAt: `2026-01-01T00:00:${String(counter % 60).padStart(2, "0")}Z`,
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: null,
    version: 0,
    sessionDate: "2026-03-01",
    weaponId: "w1",
    disciplineId: "d1",
    distance: 25,
    totalScore: 280,
    notes: null,
    cards: [],
    ...overrides,
    type,
    maxScore: maxScoreFor(type),
  };
}
