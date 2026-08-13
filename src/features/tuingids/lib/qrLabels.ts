import { supabase, type QrLabel, type PlantInstanceQrAssignment } from "@/lib/supabase";

// Fetchers voor QR-labels — zelfde fetch-only patroon als plantInstances.ts.
// Beide tabellen worden ongefilterd opgehaald (zoals growth_log_photos/
// growth_log_entries) en client-side gefilterd via useQrLabels' afgeleide
// helpers, zodat "is dit label vrij" altijd uit dezelfde in-memory dataset
// wordt afgeleid als de rest van de app gebruikt.

export async function fetchQrLabels(): Promise<QrLabel[]> {
  const { data, error } = await supabase
    .from("qr_labels")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchQrAssignments(): Promise<PlantInstanceQrAssignment[]> {
  const { data, error } = await supabase
    .from("plant_instance_qr_assignments")
    .select("*")
    .order("assigned_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
