import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LogEntry } from "../types";

const QUERY_KEY = ["growth_log_entries"];

type GrowthLogRow = {
  id: string;
  plant_id: string | null;
  plant_name: string;
  plant_instance_id: string | null;
  growing_season_id: string | null;
  entry_date: string;
  height_cm: number | null;
  flower_count: number | null;
  fruit_count: number | null;
  fruit_length_cm: number | null;
  fruit_width_cm: number | null;
  notes: string | null;
  watered: boolean;
  fertilized: boolean;
  photo_url: string | null;
  created_at: string;
};

function rowToEntry(row: GrowthLogRow): LogEntry {
  return {
    id: row.id,
    plant_id: row.plant_id,
    plant_name: row.plant_name,
    plant_instance_id: row.plant_instance_id ?? null,
    growing_season_id: row.growing_season_id ?? null,
    date: row.entry_date,
    height_cm: row.height_cm,
    flower_count: row.flower_count,
    fruit_count: row.fruit_count,
    fruit_length_cm: row.fruit_length_cm ?? null,
    fruit_width_cm: row.fruit_width_cm ?? null,
    notes: row.notes ?? "",
    watered: row.watered,
    fertilized: row.fertilized,
    photo_url: row.photo_url ?? "",
    created_at: row.created_at,
  };
}

async function fetchEntries(): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from("growth_log_entries")
    .select("*")
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}

export function useGrowthLog() {
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchEntries,
  });

  const addMutation = useMutation({
    mutationFn: async (entry: Omit<LogEntry, "id" | "created_at">) => {
      const { error } = await supabase.from("growth_log_entries").insert({
        plant_id: entry.plant_id,
        plant_name: entry.plant_name,
        plant_instance_id: entry.plant_instance_id,
        growing_season_id: entry.growing_season_id,
        entry_date: entry.date,
        height_cm: entry.height_cm,
        flower_count: entry.flower_count,
        fruit_count: entry.fruit_count,
        fruit_length_cm: entry.fruit_length_cm,
        fruit_width_cm: entry.fruit_width_cm,
        notes: entry.notes || null,
        watered: entry.watered,
        fertilized: entry.fertilized,
        photo_url: entry.photo_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LogEntry> }) => {
      const row: Record<string, unknown> = {};
      if (patch.notes !== undefined) row.notes = patch.notes || null;
      if (patch.height_cm !== undefined) row.height_cm = patch.height_cm;
      if (patch.flower_count !== undefined) row.flower_count = patch.flower_count;
      if (patch.fruit_count !== undefined) row.fruit_count = patch.fruit_count;
      if (patch.fruit_length_cm !== undefined) row.fruit_length_cm = patch.fruit_length_cm;
      if (patch.fruit_width_cm !== undefined) row.fruit_width_cm = patch.fruit_width_cm;
      if (patch.plant_instance_id !== undefined) row.plant_instance_id = patch.plant_instance_id;
      if (patch.growing_season_id !== undefined) row.growing_season_id = patch.growing_season_id;
      if (patch.watered !== undefined) row.watered = patch.watered;
      if (patch.fertilized !== undefined) row.fertilized = patch.fertilized;
      if (patch.photo_url !== undefined) row.photo_url = patch.photo_url || null;
      if (patch.date !== undefined) row.entry_date = patch.date;
      const { error } = await supabase.from("growth_log_entries").update(row).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("growth_log_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const addEntry = useCallback(
    (entry: Omit<LogEntry, "id" | "created_at">) => addMutation.mutate(entry),
    [addMutation],
  );

  const addEntryAsync = useCallback(
    (entry: Omit<LogEntry, "id" | "created_at">) => addMutation.mutateAsync(entry),
    [addMutation],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<LogEntry>) => updateMutation.mutate({ id, patch }),
    [updateMutation],
  );

  const deleteEntry = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);

  // Legacy fallback for pre-instance growth entries only — matches purely
  // by name, so it can merge two same-named plants' history. Prefer
  // getEntriesForPlantInstance for anything recorded through a concrete
  // plant instance.
  const getEntriesForPlant = useCallback(
    (plantName: string) =>
      entries
        .filter((e) => e.plant_name === plantName)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries],
  );

  const getEntriesForPlantInstance = useCallback(
    (plantInstanceId: string) =>
      entries
        .filter((e) => e.plant_instance_id === plantInstanceId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries],
  );

  const getEntriesForGrowingSeason = useCallback(
    (growingSeasonId: string) =>
      entries
        .filter((e) => e.growing_season_id === growingSeasonId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries],
  );

  return {
    entries,
    addEntry,
    addEntryAsync,
    updateEntry,
    deleteEntry,
    getEntriesForPlant,
    getEntriesForPlantInstance,
    getEntriesForGrowingSeason,
    isAdding: addMutation.isPending,
    addError: addMutation.error as Error | null,
  };
}
