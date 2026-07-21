import { supabase, type PlantInstance, type GrowingSeason, type Plant } from "@/lib/supabase";

// Fetchers for the species/instance/season split — mirrors the fetch-only
// pattern already used in plantLogs.ts (plain async functions, consumed via
// useQuery in components, no wrapper hook needed for reads).

export async function fetchPlantInstances(): Promise<PlantInstance[]> {
  const { data, error } = await supabase
    .from("plant_instances")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActivePlantInstances(): Promise<PlantInstance[]> {
  const { data, error } = await supabase
    .from("plant_instances")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlantInstance(id: string): Promise<PlantInstance | null> {
  const { data, error } = await supabase.from("plant_instances").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchGrowingSeasons(plantInstanceId: string): Promise<GrowingSeason[]> {
  const { data, error } = await supabase
    .from("growing_seasons")
    .select("*")
    .eq("plant_instance_id", plantInstanceId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveGrowingSeason(plantInstanceId: string): Promise<GrowingSeason | null> {
  const { data, error } = await supabase
    .from("growing_seasons")
    .select("*")
    .eq("plant_instance_id", plantInstanceId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAllGrowingSeasons(): Promise<GrowingSeason[]> {
  const { data, error } = await supabase.from("growing_seasons").select("*").order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Preferred display name for an instance: custom name first, else the species name. */
export function plantInstanceDisplayName(instance: PlantInstance, species: Plant | undefined): string {
  if (instance.custom_name && instance.custom_name.trim()) return instance.custom_name.trim();
  return species?.name ?? "Naamloos exemplaar";
}

/** Suggested name for a brand-new instance, e.g. "Cherrytomaat 'Koralik' #2".
 * Count ALL instances of the species (active + historical), never just
 * active ones, so a number is never reused after an instance is archived. */
export function suggestInstanceName(speciesName: string, existingInstanceCountForSpecies: number): string {
  return `${speciesName} #${existingInstanceCountForSpecies + 1}`;
}

/** All active instances of one species. Source of truth for "does the user
 * have this species in the garden" — replaces the old `plants.planted`
 * boolean (phase 4). A species itself is never planted or not; only a
 * concrete plant_instances row can be. */
export function getActiveInstancesForSpecies(speciesId: string, instances: PlantInstance[]): PlantInstance[] {
  return instances.filter((i) => i.species_id === speciesId && i.status === "active");
}

/** True if the species has at least one active instance. */
export function hasActiveInstancesForSpecies(speciesId: string, instances: PlantInstance[]): boolean {
  return instances.some((i) => i.species_id === speciesId && i.status === "active");
}
