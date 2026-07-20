import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type Plant } from "@/lib/supabase";
import { useGrowthLog } from "./useGrowthLog";

// Single source of truth for "water/feeding given": always writes a growth
// log entry AND the plant's last_watered_at/last_fed_at in one place, so
// every entry point (plant tile, popup, Mijn Tuin widget, ...) stays in sync
// with the central logboek/timeline. Pass `patchPlant` when the caller
// already has its own plants-update mutation (e.g. Tuinieren's popup, which
// also syncs the currently open plant into local state) — otherwise a
// minimal internal mutation is used.
export function useRecordPlantCare(options?: {
  patchPlant?: (args: { id: string; patch: Record<string, unknown> }) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const { addEntryAsync } = useGrowthLog();
  const [recordingWaterId, setRecordingWaterId] = useState<string | null>(null);
  const [recordingFeedId, setRecordingFeedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultPatch = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("plants").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plants"] }),
  });

  const patchPlant = options?.patchPlant ?? ((args: { id: string; patch: Record<string, unknown> }) => defaultPatch.mutateAsync(args));

  async function recordWatering(plant: Plant, note?: string) {
    if (recordingWaterId === plant.id) return;
    setRecordingWaterId(plant.id);
    setError(null);
    try {
      await addEntryAsync({
        plant_id: plant.id,
        plant_name: plant.name,
        date: new Date().toISOString().slice(0, 10),
        notes: note?.trim() || "Water gegeven",
        height_cm: null,
        flower_count: null,
        fruit_count: null,
        fruit_length_cm: null,
        fruit_width_cm: null,
        watered: true,
        fertilized: false,
        photo_url: "",
      });
      await patchPlant({
        id: plant.id,
        patch: {
          last_watered_at: new Date().toISOString(),
          last_water_reminder_sent_at: null,
          water_skip_until: null,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Waterregistratie mislukt.");
    } finally {
      setRecordingWaterId(null);
    }
  }

  async function recordFeeding(plant: Plant, note?: string) {
    if (recordingFeedId === plant.id) return;
    setRecordingFeedId(plant.id);
    setError(null);
    try {
      await addEntryAsync({
        plant_id: plant.id,
        plant_name: plant.name,
        date: new Date().toISOString().slice(0, 10),
        notes: note?.trim() || "Voeding gegeven",
        height_cm: null,
        flower_count: null,
        fruit_count: null,
        fruit_length_cm: null,
        fruit_width_cm: null,
        watered: false,
        fertilized: true,
        photo_url: "",
      });
      await patchPlant({
        id: plant.id,
        patch: {
          last_fed_at: new Date().toISOString(),
          last_feeding_reminder_sent_at: null,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voedingsregistratie mislukt.");
    } finally {
      setRecordingFeedId(null);
    }
  }

  return { recordWatering, recordFeeding, recordingWaterId, recordingFeedId, error };
}
