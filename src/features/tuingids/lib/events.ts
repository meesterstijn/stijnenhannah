import type { LucideIcon } from "lucide-react";
import { Droplet, Leaf, Ruler, Apple, Scissors, Boxes, Flower2, Cherry } from "lucide-react";
import type { Plant, PlantHarvestLog, PlantPruningLog, PlantRepotLog } from "@/lib/supabase";
import type { LogEntry } from "../types";
import { formatMeasurement, formatFruitSize } from "./growthStats";

// Generic logboek/timeline event system. Every event type is derived purely
// from data that already exists (growth log entries, harvest/pruning/repot
// logs, plant fields) — nothing here introduces new storage. Adding a new
// event type later means: add a slot to EVENT_META, write one buildXEvents
// function, and add it to buildAllLogboekEvents — no other logic changes.

export type EventType =
  | "water"
  | "feeding"
  | "growth"
  | "harvest"
  | "pruning"
  | "repot"
  | "first_flower"
  | "first_fruit";

export type LogboekEvent = {
  id: string;
  type: EventType;
  date: string;
  plantId: string | null;
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
  const byPlant = new Map<string, LogEntry[]>();
  for (const e of entries) {
    if (!isGrowthMeasurement(e)) continue;
    const list = byPlant.get(e.plant_name) ?? [];
    list.push(e);
    byPlant.set(e.plant_name, list);
  }

  const events: LogboekEvent[] = [];
  for (const [plantName, list] of byPlant) {
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
        plantName,
        label,
        detail: detailParts.length > 0 ? detailParts.join(" · ") : undefined,
      });
    }
  }
  return events;
}

export function buildHarvestEvents(logs: PlantHarvestLog[], plantNameById: Map<string, string>): LogboekEvent[] {
  return logs.map((l) => ({
    id: `harvest-${l.id}`,
    type: "harvest" as const,
    date: l.harvested_at,
    plantId: l.plant_id,
    plantName: plantNameById.get(l.plant_id) ?? "Onbekende plant",
    label: "Geoogst",
    detail:
      [l.weight_grams ? `${l.weight_grams} gram` : null, l.quantity ? `${l.quantity} ${l.unit ?? "stuks"}` : null]
        .filter(Boolean)
        .join(", ") || undefined,
  }));
}

export function buildPruningEvents(logs: PlantPruningLog[], plantNameById: Map<string, string>): LogboekEvent[] {
  return logs.map((l) => ({
    id: `pruning-${l.id}`,
    type: "pruning" as const,
    date: l.pruned_at,
    plantId: l.plant_id,
    plantName: plantNameById.get(l.plant_id) ?? "Onbekende plant",
    label: "Gesnoeid",
    detail: l.pruning_type ?? undefined,
  }));
}

export function buildRepotEvents(logs: PlantRepotLog[], plantNameById: Map<string, string>): LogboekEvent[] {
  return logs.map((l) => ({
    id: `repot-${l.id}`,
    type: "repot" as const,
    date: l.repotted_at,
    plantId: l.plant_id,
    plantName: plantNameById.get(l.plant_id) ?? "Onbekende plant",
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

export function buildFirstFlowerEvents(plants: Plant[]): LogboekEvent[] {
  return plants
    .filter((p) => p.first_flower_at)
    .map((p) => ({
      id: `first_flower-${p.id}`,
      type: "first_flower" as const,
      date: p.first_flower_at!,
      plantId: p.id,
      plantName: p.name,
      label: "Kreeg de eerste bloem",
    }));
}

export function buildFirstFruitEvents(plants: Plant[]): LogboekEvent[] {
  return plants
    .filter((p) => p.first_fruit_at)
    .map((p) => ({
      id: `first_fruit-${p.id}`,
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
}): LogboekEvent[] {
  const plantNameById = new Map(input.plants.map((p) => [p.id, p.name]));
  const events = [
    ...buildWaterEvents(input.entries),
    ...buildFeedingEvents(input.entries),
    ...buildGrowthEvents(input.entries),
    ...buildHarvestEvents(input.harvestLogs, plantNameById),
    ...buildPruningEvents(input.pruningLogs, plantNameById),
    ...buildRepotEvents(input.repotLogs, plantNameById),
    ...buildFirstFlowerEvents(input.plants),
    ...buildFirstFruitEvents(input.plants),
  ];
  return events.sort((a, b) => b.date.localeCompare(a.date));
}
