import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/with-timeout";
import type { Exercise } from "@/features/training/domain/types";

// Door de owner goedgekeurde eigen oefeningen van anderen
// (training_shared_exercises, zie de migratie 20261108010000). Niet via de
// sync-engine: het is een kleine, alleen-lezen catalogus voor iedereen.
// Laatste versie staat in localStorage, zodat ze offline beschikbaar blijven.

export type SharedExerciseRow = {
  id: string;
  name: string;
  data: Record<string, unknown>;
};

const CACHE_KEY = "training:shared-exercises";
const REFRESH_MS = 5 * 60_000;
const EMPTY: SharedExerciseRow[] = [];

function readCache(): SharedExerciseRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

let rows: SharedExerciseRow[] | null = null;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function current(): SharedExerciseRow[] {
  if (rows === null) rows = readCache();
  return rows;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Haalt de goedgekeurde oefeningen op; `force` na een beoordeling. */
export function refreshSharedExercises(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - fetchedAt < REFRESH_MS) return Promise.resolve();
  inflight = (async () => {
    const response = await withTimeout(
      supabase
        .from("training_shared_exercises")
        .select("id, name, data")
        .eq("status", "approved")
        .order("name"),
    );
    if (!response || response.error || !response.data) return;
    fetchedAt = Date.now();
    rows = response.data as SharedExerciseRow[];
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
    } catch {
      // Geen opslag: dan alleen in het geheugen.
    }
    listeners.forEach((l) => l());
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function useSharedExercises(): SharedExerciseRow[] {
  const list = useSyncExternalStore(subscribe, current, () => EMPTY);
  useEffect(() => {
    void refreshSharedExercises();
    const onOnline = () => void refreshSharedExercises(true);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return list;
}

const asArray = <T>(value: unknown, fallback: T[] = []): T[] =>
  Array.isArray(value) ? (value as T[]) : fallback;

// Gegevens komen van een ander account: ontbrekende of rare velden mogen de
// app niet laten vastlopen, dus alles met standaardwaarden.
export function sharedToExercise(row: SharedExerciseRow): Exercise {
  const d = row.data ?? {};
  const str = (v: unknown, fallback: string) =>
    typeof v === "string" ? v : fallback;
  return {
    id: row.id,
    name: row.name,
    primary: asArray(d.primary),
    secondary: asArray(d.secondary),
    type: str(d.type, "isolation") as Exercise["type"],
    equipment: asArray(d.equipment),
    tracking: str(d.tracking, "weight_reps") as Exercise["tracking"],
    loadMode: str(d.loadMode, "none") as Exercise["loadMode"],
    perSide: d.perSide === true,
    summary: str(d.summary, ""),
    steps: asArray(d.steps),
    mistakes: asArray(d.mistakes),
    safety: asArray(d.safety),
    homeNote: typeof d.homeNote === "string" ? d.homeNote : undefined,
    defaultRestSec:
      typeof d.defaultRestSec === "number" && d.defaultRestSec > 0
        ? d.defaultRestSec
        : 90,
    alternatives: asArray(d.alternatives),
    link: typeof d.link === "string" ? d.link : undefined,
    shared: true,
  };
}
