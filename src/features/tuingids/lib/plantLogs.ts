import {
  supabase,
  type Plant,
  type PlantHarvestLog,
  type PlantPruningLog,
  type PlantRepotLog,
  type PlantInspectionLog,
  type PlantPhoto,
} from "@/lib/supabase";

// Shared fetchers for plants and their harvest/pruning/repot logs, used both
// by the Tuinieren plant popup (scoped to one plant) and the Tuingids logboek
// page (all plants, for the combined timeline). Keeping these in one place
// avoids duplicating the same Supabase queries in both files.

export async function fetchPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from("plants")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchHarvestLogs(plantId: string): Promise<PlantHarvestLog[]> {
  const { data, error } = await supabase
    .from("plant_harvest_logs")
    .select("*")
    .eq("plant_id", plantId)
    .order("harvested_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllHarvestLogs(): Promise<PlantHarvestLog[]> {
  const { data, error } = await supabase
    .from("plant_harvest_logs")
    .select("*")
    .order("harvested_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPruningLogs(plantId: string): Promise<PlantPruningLog[]> {
  const { data, error } = await supabase
    .from("plant_pruning_logs")
    .select("*")
    .eq("plant_id", plantId)
    .order("pruned_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllPruningLogs(): Promise<PlantPruningLog[]> {
  const { data, error } = await supabase
    .from("plant_pruning_logs")
    .select("*")
    .order("pruned_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchRepotLogs(plantId: string): Promise<PlantRepotLog[]> {
  const { data, error } = await supabase
    .from("plant_repot_logs")
    .select("*")
    .eq("plant_id", plantId)
    .order("repotted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllRepotLogs(): Promise<PlantRepotLog[]> {
  const { data, error } = await supabase
    .from("plant_repot_logs")
    .select("*")
    .order("repotted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Instance-scoped variants, used by the plant-instance detail view.
export async function fetchHarvestLogsForInstance(plantInstanceId: string): Promise<PlantHarvestLog[]> {
  const { data, error } = await supabase
    .from("plant_harvest_logs")
    .select("*")
    .eq("plant_instance_id", plantInstanceId)
    .order("harvested_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPruningLogsForInstance(plantInstanceId: string): Promise<PlantPruningLog[]> {
  const { data, error } = await supabase
    .from("plant_pruning_logs")
    .select("*")
    .eq("plant_instance_id", plantInstanceId)
    .order("pruned_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchRepotLogsForInstance(plantInstanceId: string): Promise<PlantRepotLog[]> {
  const { data, error } = await supabase
    .from("plant_repot_logs")
    .select("*")
    .eq("plant_instance_id", plantInstanceId)
    .order("repotted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Inspection logs only ever exist at the instance level — there is no
// legacy species-scoped equivalent (the old `plants.last_checked_at`
// single-timestamp field is kept as-is for the quick-check button).
export async function fetchInspectionLogsForInstance(plantInstanceId: string): Promise<PlantInspectionLog[]> {
  const { data, error } = await supabase
    .from("plant_inspection_logs")
    .select("*")
    .eq("plant_instance_id", plantInstanceId)
    .order("checked_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllInspectionLogs(): Promise<PlantInspectionLog[]> {
  const { data, error } = await supabase
    .from("plant_inspection_logs")
    .select("*")
    .order("checked_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Species-level photos (plant_photos has no plant_instance_id column) — used
// by the combined Tuingids logboek timeline; the per-species variant lives
// as a local fetcher in Tuinieren.tsx's species popup.
export async function fetchAllPhotos(): Promise<PlantPhoto[]> {
  const { data, error } = await supabase
    .from("plant_photos")
    .select("*")
    .order("taken_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
