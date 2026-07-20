import {
  supabase,
  type Plant,
  type PlantHarvestLog,
  type PlantPruningLog,
  type PlantRepotLog,
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
