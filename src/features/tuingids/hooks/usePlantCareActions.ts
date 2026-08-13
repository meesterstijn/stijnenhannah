import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type PlantInstance } from "@/lib/supabase";
import { useGrowthLog } from "./useGrowthLog";

// Single source of truth for "water/feeding given" on a concrete plant
// instance: always writes a growth log entry (stamped with
// plant_instance_id/growing_season_id so two instances of the same species
// never share history) AND the instance's last_watered_at/last_fed_at, in
// one place, so every entry point stays in sync with the central
// logboek/timeline. Pass `patchInstance` when the caller already has its
// own plant_instances-update mutation — otherwise a minimal internal
// mutation is used.
//
// A parallel species-level `useRecordPlantCare` existed through phase 2 for
// the (now removed) species-facing water/feeding buttons; once "Alle
// plantsoorten" stopped exposing care actions (phase 3) it had no remaining
// call sites and was deleted outright rather than kept as dead code.
export function useRecordInstanceCare(options?: {
  patchInstance?: (args: { id: string; patch: Record<string, unknown> }) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const { addEntryAsync } = useGrowthLog();
  const [recordingWaterId, setRecordingWaterId] = useState<string | null>(null);
  const [recordingFeedId, setRecordingFeedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Synchronous double-submit guards, keyed by instance id — `recordingWaterId`/
  // `recordingFeedId` (React state) only flip after the next render, so two
  // clicks fired in the same tick can both pass an `=== instance.id` check
  // before either state update commits. Refs close that race window.
  //
  // Releasing the guard is deliberately delayed by a short cooldown after a
  // *successful* write (not just for the in-flight request itself): three
  // fast clicks measured live against the real network round-trip landed
  // ~250-300ms apart — long enough for the first request to fully resolve
  // and release a guard that only covered "currently in flight", letting a
  // third click slip through as a seemingly-legitimate new action and
  // create a second row. Watering/feeding the same instance twice within a
  // couple of seconds is never a real, distinct user intention, so holding
  // the guard a little past completion is the correct fix, not a hack.
  // On failure the guard releases immediately so a genuine retry isn't
  // blocked by a cooldown for an action that never actually wrote anything.
  const DUPLICATE_GUARD_COOLDOWN_MS = 2000;
  const wateringInFlight = useRef<Set<string>>(new Set());
  const feedingInFlight = useRef<Set<string>>(new Set());

  const defaultPatch = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("plant_instances").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plant_instances"] }),
  });

  const patchInstance =
    options?.patchInstance ?? ((args: { id: string; patch: Record<string, unknown> }) => defaultPatch.mutateAsync(args));

  // Returns whether this call actually wrote a new entry, so a batch caller
  // (e.g. the "water geven" bulk dialog) can report an accurate count without
  // any second storage path — it just calls this same function once per
  // instance and tallies the booleans. Existing call sites all ignore the
  // return value, so this is additive and doesn't change their behavior.
  async function recordWatering(instance: PlantInstance, plantName: string, growingSeasonId: string | null, note?: string): Promise<boolean> {
    if (wateringInFlight.current.has(instance.id)) return false;
    wateringInFlight.current.add(instance.id);
    setRecordingWaterId(instance.id);
    setError(null);
    try {
      await addEntryAsync({
        plant_id: instance.species_id,
        plant_name: plantName,
        plant_instance_id: instance.id,
        growing_season_id: growingSeasonId,
        date: new Date().toISOString().slice(0, 10),
        notes: note?.trim() || "Water gegeven",
        height_cm: null,
        flower_count: null,
        fruit_count: null,
        fruit_length_cm: null,
        fruit_width_cm: null,
        quantity: null,
        watered: true,
        fertilized: false,
        photo_url: "",
      });
      await patchInstance({
        id: instance.id,
        patch: {
          last_watered_at: new Date().toISOString(),
          last_water_reminder_sent_at: null,
          water_skip_until: null,
        },
      });
      setTimeout(() => wateringInFlight.current.delete(instance.id), DUPLICATE_GUARD_COOLDOWN_MS);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Waterregistratie mislukt.");
      wateringInFlight.current.delete(instance.id);
      return false;
    } finally {
      setRecordingWaterId(null);
    }
  }

  async function recordFeeding(instance: PlantInstance, plantName: string, growingSeasonId: string | null, note?: string) {
    if (feedingInFlight.current.has(instance.id)) return;
    feedingInFlight.current.add(instance.id);
    setRecordingFeedId(instance.id);
    setError(null);
    try {
      await addEntryAsync({
        plant_id: instance.species_id,
        plant_name: plantName,
        plant_instance_id: instance.id,
        growing_season_id: growingSeasonId,
        date: new Date().toISOString().slice(0, 10),
        notes: note?.trim() || "Voeding gegeven",
        height_cm: null,
        flower_count: null,
        fruit_count: null,
        fruit_length_cm: null,
        fruit_width_cm: null,
        quantity: null,
        watered: false,
        fertilized: true,
        photo_url: "",
      });
      await patchInstance({
        id: instance.id,
        patch: {
          last_fed_at: new Date().toISOString(),
          last_feeding_reminder_sent_at: null,
        },
      });
      setTimeout(() => feedingInFlight.current.delete(instance.id), DUPLICATE_GUARD_COOLDOWN_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voedingsregistratie mislukt.");
      feedingInFlight.current.delete(instance.id);
    } finally {
      setRecordingFeedId(null);
    }
  }

  return { recordWatering, recordFeeding, recordingWaterId, recordingFeedId, error };
}
