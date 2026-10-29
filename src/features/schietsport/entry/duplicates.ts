import type { ShootingSession } from "@/features/schietsport/domain/model";

const WINDOW_MS = 15 * 60 * 1000;

// Waarschuwt voor een onbedoelde dubbele registratie: dezelfde datum, type,
// discipline, afstand, wapen en score, kort geleden al opgeslagen. Twee
// keer dezelfde score op één dag is best mogelijk, dus het is een vraag,
// geen blokkade.
export function findPossibleDuplicate(
  sessions: readonly ShootingSession[],
  candidate: Pick<
    ShootingSession,
    | "sessionDate"
    | "type"
    | "disciplineId"
    | "distance"
    | "weaponId"
    | "totalScore"
  > & { id?: string },
  now: Date = new Date(),
): ShootingSession | null {
  return (
    sessions.find(
      (s) =>
        s.deletedAt === null &&
        s.id !== candidate.id &&
        s.sessionDate === candidate.sessionDate &&
        s.type === candidate.type &&
        s.disciplineId === candidate.disciplineId &&
        s.distance === candidate.distance &&
        s.weaponId === candidate.weaponId &&
        s.totalScore === candidate.totalScore &&
        now.getTime() - Date.parse(s.createdAt) < WINDOW_MS,
    ) ?? null
  );
}
