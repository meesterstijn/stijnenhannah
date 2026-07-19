import { useState, useCallback } from "react";
import type { LogEntry } from "../types";

const STORAGE_KEY = "tuingids_growth_log";

function loadEntries(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: LogEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function useGrowthLog() {
  const [entries, setEntries] = useState<LogEntry[]>(loadEntries);

  const addEntry = useCallback((entry: Omit<LogEntry, "id" | "created_at">) => {
    const newEntry: LogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    setEntries((prev) => {
      const updated = [newEntry, ...prev];
      saveEntries(updated);
      return updated;
    });
    return newEntry;
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<LogEntry>) => {
    setEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...patch } : e));
      saveEntries(updated);
      return updated;
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      saveEntries(updated);
      return updated;
    });
  }, []);

  const getEntriesForPlant = useCallback(
    (plantName: string) =>
      entries
        .filter((e) => e.plant_name === plantName)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries],
  );

  return { entries, addEntry, updateEntry, deleteEntry, getEntriesForPlant };
}
