import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { startSession, updateProfile } from "@/features/training/db/repository";
import { buildHistoryIndex } from "@/features/training/domain/performance";
import { toLocalDate } from "@/features/training/domain/schedule";
import type { Program, ProgramDay, SessionSnapshot, TrainingSession } from "@/features/training/domain/types";
import { buildSnapshot } from "@/features/training/domain/workout";
import { useTraining } from "./TrainingProvider";
import { useExercises, useProfile } from "./useTrainingData";

// Acties om een training te starten of over te slaan, gedeeld door
// dashboard, schema's en historie.
export function useWorkoutActions() {
  const { db, userId } = useTraining();
  const profile = useProfile();
  const { lookup } = useExercises();
  const navigate = useNavigate();

  const context = useCallback(async () => {
    // Altijd vers uit de database: de opdracht moet uit de laatst
    // opgeslagen, voltooide sessies komen.
    const [sessions, sets] = await Promise.all([db.sessions.toArray(), db.sets.toArray()]);
    return {
      lookup,
      index: buildHistoryIndex(sessions, sets),
      scope: profile.settings.historyScope,
      prefs: profile.exercisePrefs,
    };
  }, [db, lookup, profile]);

  const openSession = useCallback(async () => {
    const open = await db.sessions.where("status").anyOf("active", "paused").toArray();
    return open.find((s) => !s.deletedAt) ?? null;
  }, [db]);

  const begin = useCallback(
    async (input: { program: Program | null; day: ProgramDay; snapshot?: SessionSnapshot }) => {
      const existing = await openSession();
      if (existing) {
        navigate("/training/workout");
        return existing;
      }
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const snapshot = input.snapshot ?? buildSnapshot(input.program, input.day, await context());
      const session = await startSession(db, userId, {
        programId: input.program?.id ?? null,
        programRevision: input.program?.revision ?? null,
        dayId: input.day.id,
        name: input.day.name,
        snapshot,
        localDate: toLocalDate(new Date(), timeZone),
        timeZone,
      });
      navigate("/training/workout");
      return session;
    },
    [context, db, navigate, openSession, userId],
  );

  const skip = useCallback(
    async (program: Program, day: ProgramDay) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return startSession(db, userId, {
        programId: program.id,
        programRevision: program.revision,
        dayId: day.id,
        name: day.name,
        snapshot: { programName: program.name, dayName: day.name, exercises: [] },
        localDate: toLocalDate(new Date(), timeZone),
        timeZone,
        status: "skipped",
      });
    },
    [db, userId],
  );

  // Oude training opnieuw doen: dezelfde oefeningen en sets, met de
  // actuele vorige prestaties als opdracht.
  const repeat = useCallback(
    async (old: TrainingSession) => {
      const day: ProgramDay = {
        id: old.dayId ?? "herhaling",
        name: old.name,
        weekdays: [],
        exercises: old.snapshot.exercises
          .filter((e) => !e.removed)
          .map((e, i) => ({
            id: `herhaal-${i + 1}`,
            exerciseId: e.exerciseId,
            sets: e.work.length || e.plannedSets,
            warmupSets: e.warmup.length,
            repMin: e.repMin,
            repMax: e.repMax,
            durationSec: e.durationSec,
            restSec: e.restSec,
            startWeightKg: null,
          })),
      };
      const program = old.programId ? ((await db.programs.get(old.programId)) ?? null) : null;
      return begin({ program, day });
    },
    [begin, db],
  );

  const activate = useCallback(
    (programId: string | null) =>
      updateProfile(db, userId, (p) => ({ ...p, settings: { ...p.settings, activeProgramId: programId } })),
    [db, userId],
  );

  return { begin, skip, repeat, activate, context };
}
