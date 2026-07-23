import type { LucideIcon } from "lucide-react";
import { Droplet, Leaf, Ruler, Apple, Scissors, Boxes, Flower2, Cherry, ClipboardCheck, Image as ImageIcon, PlayCircle, StopCircle } from "lucide-react";
import type { Plant, PlantInstance, GrowingSeason, PlantHarvestLog, PlantPruningLog, PlantRepotLog, PlantInspectionLog, PlantPhoto } from "@/lib/supabase";
import type { LogEntry } from "../types";
import { formatMeasurement, formatFruitSize } from "./growthStats";
import { plantInstanceDisplayName } from "./plantInstances";

// Generic logboek/timeline event system. Every event type is derived purely
// from data that already exists (growth log entries, harvest/pruning/repot
// logs, plant fields) — nothing here introduces new storage. Adding a new
// event type later means: add a slot to EVENT_META, write one buildXEvents
// function, and add it to buildAllLogboekEvents — no other logic changes.
//
// Instance-awareness (phase 4): every event carries `instanceId` and
// `growingSeasonId` (both nullable) alongside the legacy `plantId` (species
// id). `plantName` is the display string only — grouping/filtering by
// identity must use `instanceId` (falling back to `plantId`) never
// `plantName`, since two differently-named-in-display instances can share
// a species and two unnamed instances can share a display name.

export type EventType =
  | "water"
  | "feeding"
  | "growth"
  | "harvest"
  | "pruning"
  | "repot"
  | "inspection"
  | "photo"
  | "season_started"
  | "season_ended"
  | "first_flower"
  | "first_fruit";

export type LogboekEvent = {
  id: string;
  type: EventType;
  date: string;
  /** Species id, when known — never used alone to distinguish instances. */
  plantId: string | null;
  /** plant_instances id, when known. The real identity key for filtering. */
  instanceId: string | null;
  growingSeasonId: string | null;
  plantName: string;
  label: string;
  detail?: string;
};

export const EVENT_TYPE_ORDER: EventType[] = [
  "water",
  "feeding",
  "growth",
  "harvest",
  "pruning",
  "repot",
  "inspection",
  "season_started",
  "season_ended",
  "first_flower",
  "first_fruit",
];

export const EVENT_META: Record<EventType, { label: string; emoji: string; icon: LucideIcon }> = {
  water: { label: "Water", emoji: "💧", icon: Droplet },
  feeding: { label: "Voeding", emoji: "🌿", icon: Leaf },
  growth: { label: "Groei", emoji: "📏", icon: Ruler },
  harvest: { label: "Oogst", emoji: "🍅", icon: Apple },
  pruning: { label: "Snoeien", emoji: "✂️", icon: Scissors },
  repot: { label: "Verpotten", emoji: "🪴", icon: Boxes },
  inspection: { label: "Inspectie", emoji: "🔍", icon: ClipboardCheck },
  photo: { label: "Foto", emoji: "📷", icon: ImageIcon },
  season_started: { label: "Seizoen gestart", emoji: "▶️", icon: PlayCircle },
  season_ended: { label: "Seizoen afgerond", emoji: "⏹️", icon: StopCircle },
  first_flower: { label: "Eerste bloem", emoji: "🌸", icon: Flower2 },
  first_fruit: { label: "Eerste vrucht", emoji: "🍅", icon: Cherry },
};

/** Combines a plant name with an event's label into the sentence used in the
 * central logboek, e.g. "Citroen" + "Water gegeven" -> "Citroen water gegeven". */
export function eventSentence(event: LogboekEvent): string {
  const lower = event.label.charAt(0).toLowerCase() + event.label.slice(1);
  return `${event.plantName} ${lower}`;
}

export function buildWaterEvents(entries: LogEntry[]): LogboekEvent[] {
  return entries
    .filter((e) => e.watered)
    .map((e) => ({
      id: `water-${e.id}`,
      type: "water" as const,
      date: e.date,
      plantId: e.plant_id,
      instanceId: e.plant_instance_id,
      growingSeasonId: e.growing_season_id,
      plantName: e.plant_name,
      label: "Water gegeven",
      detail: e.notes && e.notes !== "Water gegeven" ? e.notes : undefined,
    }));
}

export function buildFeedingEvents(entries: LogEntry[]): LogboekEvent[] {
  return entries
    .filter((e) => e.fertilized)
    .map((e) => ({
      id: `feeding-${e.id}`,
      type: "feeding" as const,
      date: e.date,
      plantId: e.plant_id,
      instanceId: e.plant_instance_id,
      growingSeasonId: e.growing_season_id,
      plantName: e.plant_name,
      label: "Voeding gegeven",
      detail: e.notes && e.notes !== "Voeding gegeven" ? e.notes : undefined,
    }));
}

/** True for entries that represent an actual growth measurement (height,
 * fruit size, or a genuine note) — excludes the auto-generated "Water
 * gegeven"/"Voeding gegeven" marker entries created by recordWatering/
 * recordFeeding, which already have their own dedicated event types. */
function isGrowthMeasurement(e: LogEntry): boolean {
  if (e.height_cm !== null || e.fruit_length_cm !== null || e.fruit_width_cm !== null) return true;
  if (!e.notes) return false;
  const isAutoActionNote = e.notes === "Water gegeven" || e.notes === "Voeding gegeven";
  return !(isAutoActionNote && (e.watered || e.fertilized));
}

export function buildGrowthEvents(entries: LogEntry[]): LogboekEvent[] {
  // Grouped by instance id when known (falling back to plant_name only for
  // legacy unlinked entries) so two differently-tracked instances of the
  // same species — or two instances that happen to share a display name —
  // never get merged into one height-delta sequence.
  const byPlant = new Map<string, LogEntry[]>();
  for (const e of entries) {
    if (!isGrowthMeasurement(e)) continue;
    const key = e.plant_instance_id ?? `legacy:${e.plant_name}`;
    const list = byPlant.get(key) ?? [];
    list.push(e);
    byPlant.set(key, list);
  }

  const events: LogboekEvent[] = [];
  for (const list of byPlant.values()) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let prevHeight: number | null = null;
    for (const e of sorted) {
      // Height delta is computed purely from height measurements in sequence —
      // fruit-size-only or notes-only entries in between never affect it.
      const delta = e.height_cm !== null && prevHeight !== null ? e.height_cm - prevHeight : null;
      if (e.height_cm !== null) prevHeight = e.height_cm;

      const fruitSize = formatFruitSize(e.fruit_length_cm, e.fruit_width_cm);
      const detailParts: string[] = [];
      let label: string;

      if (e.height_cm !== null) {
        label = `Gegroeid naar ${formatMeasurement(e.height_cm)} cm`;
        if (delta !== null) detailParts.push(`${delta >= 0 ? "+" : ""}${formatMeasurement(delta)} cm`);
        if (fruitSize) detailParts.push(`vrucht ${fruitSize}`);
      } else if (fruitSize) {
        label = "Vrucht gemeten";
        detailParts.push(fruitSize);
      } else {
        label = "Notitie toegevoegd";
      }
      if (e.notes) detailParts.push(e.notes);

      events.push({
        id: `growth-${e.id}`,
        type: "growth",
        date: e.date,
        plantId: e.plant_id,
        instanceId: e.plant_instance_id,
        growingSeasonId: e.growing_season_id,
        plantName: e.plant_name,
        label,
        detail: detailParts.length > 0 ? detailParts.join(" · ") : undefined,
      });
    }
  }
  return events;
}

/** `plantNameById` resolves the legacy species-level name (key = plant_id);
 * `instanceNameById`, when passed, resolves the instance display name (key
 * = plant_instance_id) and takes priority whenever a log row is linked to a
 * concrete instance — the only way two instances of the same species show
 * up as distinguishable rows in a combined, multi-plant logboek. */
export function buildHarvestEvents(logs: PlantHarvestLog[], plantNameById: Map<string, string>, instanceNameById?: Map<string, string>): LogboekEvent[] {
  return logs.map((l) => ({
    id: `harvest-${l.id}`,
    type: "harvest" as const,
    date: l.harvested_at,
    plantId: l.plant_id,
    instanceId: l.plant_instance_id,
    growingSeasonId: l.growing_season_id,
    plantName: (l.plant_instance_id && instanceNameById?.get(l.plant_instance_id)) ?? plantNameById.get(l.plant_id) ?? "Onbekende plant",
    label: "Geoogst",
    detail:
      [l.weight_grams ? `${l.weight_grams} gram` : null, l.quantity ? `${l.quantity} ${l.unit ?? "stuks"}` : null]
        .filter(Boolean)
        .join(", ") || undefined,
  }));
}

export function buildPruningEvents(logs: PlantPruningLog[], plantNameById: Map<string, string>, instanceNameById?: Map<string, string>): LogboekEvent[] {
  return logs.map((l) => ({
    id: `pruning-${l.id}`,
    type: "pruning" as const,
    date: l.pruned_at,
    plantId: l.plant_id,
    instanceId: l.plant_instance_id,
    growingSeasonId: l.growing_season_id,
    plantName: (l.plant_instance_id && instanceNameById?.get(l.plant_instance_id)) ?? plantNameById.get(l.plant_id) ?? "Onbekende plant",
    label: "Gesnoeid",
    detail: l.pruning_type ?? undefined,
  }));
}

export function buildRepotEvents(logs: PlantRepotLog[], plantNameById: Map<string, string>, instanceNameById?: Map<string, string>): LogboekEvent[] {
  return logs.map((l) => ({
    id: `repot-${l.id}`,
    type: "repot" as const,
    date: l.repotted_at,
    plantId: l.plant_id,
    instanceId: l.plant_instance_id,
    growingSeasonId: l.growing_season_id,
    plantName: (l.plant_instance_id && instanceNameById?.get(l.plant_instance_id)) ?? plantNameById.get(l.plant_id) ?? "Onbekende plant",
    label: "Verpot",
    detail:
      [
        l.old_pot_size_liters && l.new_pot_size_liters
          ? `${l.old_pot_size_liters}L → ${l.new_pot_size_liters}L`
          : null,
        l.soil_type,
      ]
        .filter(Boolean)
        .join(", ") || undefined,
  }));
}

/** Inspections only ever exist at the instance level (no legacy species-only
 * rows), so `instanceNameById` is the only resolution path — there is no
 * species-level `plantNameById` fallback for this one. */
export function buildInspectionEvents(logs: PlantInspectionLog[], instanceNameById: Map<string, string>): LogboekEvent[] {
  return logs.map((l) => ({
    id: `inspection-${l.id}`,
    type: "inspection" as const,
    date: l.checked_at,
    plantId: null,
    instanceId: l.plant_instance_id,
    growingSeasonId: l.growing_season_id,
    plantName: instanceNameById.get(l.plant_instance_id) ?? "Onbekende plant",
    label: "Geïnspecteerd",
    detail: [l.health_status, l.notes, l.issues, l.action_taken].filter(Boolean).join(" · ") || undefined,
  }));
}

/** plant_photos gained plant_instance_id/growing_season_id columns in phase
 * 4's data-integrity pass — a photo linked to a concrete instance resolves
 * its name via `instanceNameById` first (never mixing two instances of the
 * same species), falling back to the species map only for legacy rows with
 * no instance link (photos taken before instances existed). */
export function buildPhotoEvents(photos: PlantPhoto[], plantNameById: Map<string, string>, instanceNameById?: Map<string, string>): LogboekEvent[] {
  return photos.map((p) => ({
    id: `photo-${p.id}`,
    type: "photo" as const,
    date: p.taken_at,
    plantId: p.plant_id,
    instanceId: p.plant_instance_id,
    growingSeasonId: p.growing_season_id,
    plantName: (p.plant_instance_id && instanceNameById?.get(p.plant_instance_id)) ?? plantNameById.get(p.plant_id) ?? "Onbekende plant",
    label: "Foto toegevoegd",
    detail: p.note ?? undefined,
  }));
}

export function buildSeasonStartedEvents(seasons: GrowingSeason[], instanceNameById: Map<string, string>): LogboekEvent[] {
  return seasons.map((s) => ({
    id: `season_started-${s.id}`,
    type: "season_started" as const,
    date: s.started_at,
    plantId: null,
    instanceId: s.plant_instance_id,
    growingSeasonId: s.id,
    plantName: instanceNameById.get(s.plant_instance_id) ?? "Onbekende plant",
    label: "Seizoen gestart",
    detail: s.label ?? `Seizoen ${s.year}`,
  }));
}

export function buildSeasonEndedEvents(seasons: GrowingSeason[], instanceNameById: Map<string, string>): LogboekEvent[] {
  return seasons
    .filter((s) => s.ended_at)
    .map((s) => ({
      id: `season_ended-${s.id}`,
      type: "season_ended" as const,
      date: s.ended_at!,
      plantId: null,
      instanceId: s.plant_instance_id,
      growingSeasonId: s.id,
      plantName: instanceNameById.get(s.plant_instance_id) ?? "Onbekende plant",
      label: s.status === "completed" ? "Seizoen afgerond" : "Seizoen mislukt",
      detail: [s.closing_reason, s.closing_notes].filter(Boolean).join(" · ") || undefined,
    }));
}

/** Instance-level first bloom/fruit (plant_instances.first_flower_at /
 * first_fruit_at) — the current, actively-written source since phase 2/3.
 * The species-level buildFirstFlowerEvents/buildFirstFruitEvents below stay
 * for legacy rows dated before instances existed. */
export function buildInstanceFirstFlowerEvents(instances: PlantInstance[], instanceNameById: Map<string, string>): LogboekEvent[] {
  return instances
    .filter((i) => i.first_flower_at)
    .map((i) => ({
      id: `instance_first_flower-${i.id}`,
      type: "first_flower" as const,
      date: i.first_flower_at!,
      plantId: null,
      instanceId: i.id,
      growingSeasonId: null,
      plantName: instanceNameById.get(i.id) ?? "Onbekende plant",
      label: "Kreeg de eerste bloem",
    }));
}

export function buildInstanceFirstFruitEvents(instances: PlantInstance[], instanceNameById: Map<string, string>): LogboekEvent[] {
  return instances
    .filter((i) => i.first_fruit_at)
    .map((i) => ({
      id: `instance_first_fruit-${i.id}`,
      type: "first_fruit" as const,
      date: i.first_fruit_at!,
      plantId: null,
      instanceId: i.id,
      growingSeasonId: null,
      plantName: instanceNameById.get(i.id) ?? "Onbekende plant",
      label: "Kreeg de eerste vrucht",
    }));
}

export function buildFirstFlowerEvents(plants: Plant[]): LogboekEvent[] {
  return plants
    .filter((p) => p.first_flower_at)
    .map((p) => ({
      id: `first_flower-${p.id}`,
      type: "first_flower" as const,
      date: p.first_flower_at!,
      plantId: p.id,
      instanceId: null,
      growingSeasonId: null,
      plantName: p.name,
      label: "Kreeg de eerste bloem",
    }));
}

export function buildFirstFruitEvents(plants: Plant[]): LogboekEvent[] {
  return plants
    .filter((p) => p.first_fruit_at)
    .map((p) => ({
      id: `first_fruit-${p.id}`,
      instanceId: null,
      growingSeasonId: null,
      type: "first_fruit" as const,
      date: p.first_fruit_at!,
      plantId: p.id,
      plantName: p.name,
      label: "Kreeg de eerste vrucht",
    }));
}

export function buildAllLogboekEvents(input: {
  entries: LogEntry[];
  harvestLogs: PlantHarvestLog[];
  pruningLogs: PlantPruningLog[];
  repotLogs: PlantRepotLog[];
  plants: Plant[];
  // Optional (phase 4 additions) — when omitted, behaves exactly as before:
  // species-level first bloom/fruit only, no inspections/photos/seasons.
  instances?: PlantInstance[];
  seasons?: GrowingSeason[];
  inspectionLogs?: PlantInspectionLog[];
  photos?: PlantPhoto[];
}): LogboekEvent[] {
  const plantNameById = new Map(input.plants.map((p) => [p.id, p.name]));
  const speciesById = new Map(input.plants.map((p) => [p.id, p]));
  const instanceNameById = new Map(
    (input.instances ?? []).map((i) => [i.id, plantInstanceDisplayName(i, speciesById.get(i.species_id))]),
  );
  const events = [
    ...buildWaterEvents(input.entries),
    ...buildFeedingEvents(input.entries),
    ...buildGrowthEvents(input.entries),
    ...buildHarvestEvents(input.harvestLogs, plantNameById, instanceNameById),
    ...buildPruningEvents(input.pruningLogs, plantNameById, instanceNameById),
    ...buildRepotEvents(input.repotLogs, plantNameById, instanceNameById),
    ...buildInspectionEvents(input.inspectionLogs ?? [], instanceNameById),
    ...buildPhotoEvents(input.photos ?? [], plantNameById, instanceNameById),
    ...buildSeasonStartedEvents(input.seasons ?? [], instanceNameById),
    ...buildSeasonEndedEvents(input.seasons ?? [], instanceNameById),
    ...buildInstanceFirstFlowerEvents(input.instances ?? [], instanceNameById),
    ...buildInstanceFirstFruitEvents(input.instances ?? [], instanceNameById),
    ...buildFirstFlowerEvents(input.plants),
    ...buildFirstFruitEvents(input.plants),
  ];
  return events.sort((a, b) => b.date.localeCompare(a.date));
}
