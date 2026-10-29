import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo } from "react";
import { normalizeProfile, defaultProfile } from "@/features/training/domain/defaults";
import { SYSTEM_EXERCISES, systemExercise, unknownExercise } from "@/features/training/domain/exercises";
import { buildHistoryIndex } from "@/features/training/domain/performance";
import { toLocalDate } from "@/features/training/domain/schedule";
import type {
  BodyMetric,
  CustomExerciseRecord,
  Exercise,
  Profile,
  Program,
  TrainingSession,
  TrainingSet,
} from "@/features/training/domain/types";
import { updateProfile } from "@/features/training/db/repository";
import { useTraining } from "./TrainingProvider";

// Leeshooks op de lokale database. useLiveQuery werkt automatisch bij na
// elke lokale schrijfactie of binnengekomen sync.

const EMPTY: never[] = [];

export function useProfile(): Profile {
  const { db, userId } = useTraining();
  const stored = useLiveQuery(() => db.profiles.get(userId), [db, userId]);
  return useMemo(
    () => normalizeProfile(stored ?? defaultProfile(userId, new Date(0).toISOString())),
    [stored, userId],
  );
}

export function usePrograms(): Program[] | undefined {
  const { db } = useTraining();
  return useLiveQuery(
    async () =>
      (await db.programs.toArray())
        .filter((p) => !p.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name, "nl")),
    [db],
  );
}

export function useProgram(id: string | null | undefined): Program | null | undefined {
  const { db } = useTraining();
  return useLiveQuery(async () => (id ? ((await db.programs.get(id)) ?? null) : null), [db, id]);
}

export function useActiveProgram(): Program | null | undefined {
  const profile = useProfile();
  const program = useProgram(profile.settings.activeProgramId);
  return program && !program.deletedAt && !program.archivedAt ? program : program === undefined ? undefined : null;
}

export function useSessions(): TrainingSession[] | undefined {
  const { db } = useTraining();
  return useLiveQuery(
    async () =>
      (await db.sessions.toArray())
        .filter((s) => !s.deletedAt)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [db],
  );
}

export function useSets(): TrainingSet[] | undefined {
  const { db } = useTraining();
  return useLiveQuery(() => db.sets.toArray(), [db]);
}

export function useSessionSets(sessionId: string | null | undefined): TrainingSet[] | undefined {
  const { db } = useTraining();
  return useLiveQuery(
    async () => (sessionId ? (await db.sets.where("sessionId").equals(sessionId).toArray()).filter((s) => !s.deletedAt) : []),
    [db, sessionId],
  );
}

// Lopende of onderbroken training (de nieuwste als er meerdere zijn).
export function useOpenSession(): TrainingSession | null | undefined {
  const { db } = useTraining();
  return useLiveQuery(async () => {
    const open = (await db.sessions.where("status").anyOf("active", "paused").toArray()).filter((s) => !s.deletedAt);
    open.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return open[0] ?? null;
  }, [db]);
}

export function useBodyMetrics(): BodyMetric[] | undefined {
  const { db } = useTraining();
  return useLiveQuery(
    async () =>
      (await db.bodyMetrics.toArray())
        .filter((m) => !m.deletedAt)
        .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)),
    [db],
  );
}

export function useCustomExercises(): CustomExerciseRecord[] | undefined {
  const { db } = useTraining();
  return useLiveQuery(async () => (await db.exercises.toArray()).filter((e) => !e.deletedAt), [db]);
}

export const customToExercise = (r: CustomExerciseRecord): Exercise => ({
  ...r.data,
  id: r.id,
  name: r.name,
  custom: true,
  archived: !!r.archivedAt,
});

// Alle oefeningen (systeem + eigen) en een opzoekfunctie die nooit faalt.
export function useExercises() {
  const custom = useCustomExercises();
  return useMemo(() => {
    const own = (custom ?? EMPTY).map(customToExercise);
    const byId = new Map<string, Exercise>([...SYSTEM_EXERCISES, ...own].map((e) => [e.id, e]));
    const lookup = (id: string) => byId.get(id) ?? systemExercise(id);
    const get = (id: string, fallbackName?: string) => lookup(id) ?? unknownExercise(id, fallbackName);
    return { all: [...SYSTEM_EXERCISES, ...own], lookup, get, loaded: custom !== undefined };
  }, [custom]);
}

export function useHistoryIndex() {
  const sessions = useSessions();
  const sets = useSets();
  return useMemo(
    () => (sessions && sets ? buildHistoryIndex(sessions, sets) : undefined),
    [sessions, sets],
  );
}

export function useConflictCount(): number {
  const { db } = useTraining();
  return useLiveQuery(() => db.conflicts.count(), [db]) ?? 0;
}

export function usePendingCount(): number {
  const { db } = useTraining();
  return useLiveQuery(() => db.outbox.count(), [db]) ?? 0;
}

export function useToday() {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const today = toLocalDate(new Date(), timeZone);
  return { today, timeZone };
}

export function useUpdateProfile() {
  const { db, userId } = useTraining();
  return useCallback(
    (change: (p: Profile) => Profile) => updateProfile(db, userId, change),
    [db, userId],
  );
}
