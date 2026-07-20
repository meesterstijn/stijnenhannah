import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type Plant,
  type PlantPhoto,
  type PlantHarvestLog,
  type PlantPruningLog,
  type PlantRepotLog,
} from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Sprout,
  Droplet,
  Leaf,
  Trash2,
  Loader2,
  Pencil,
  X,
  Image as ImageIcon,
  SlidersHorizontal,
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  BookOpen,
  ClipboardCheck,
  Ruler,
  Euro,
  MapPin,
  Scissors,
  Boxes,
  Apple,
  Clock,
} from "lucide-react";
import { useGrowthLog } from "@/features/tuingids/hooks/useGrowthLog";
import type { LogEntry } from "@/features/tuingids/types";

const SUN_OPTIONS = ["Volle zon", "Halfvolle zon", "Half schaduw", "Schaduw"] as const;

const GREENHOUSE_PREF_OPTIONS = ["Kas liefhebber", "Kas of buiten", "Alleen buiten"] as const;

const PLANT_CATEGORY_OPTIONS = [
  "🍅 Moestuin",
  "🍓 Fruit",
  "🌿 Kruiden",
  "🌸 Sierplanten",
  "🌳 Bomen & Mediterrane planten",
] as const;

function parseGreenhouseNotes(raw: string | null): { pref: string; notes: string } {
  if (!raw) return { pref: "", notes: "" };
  for (const p of GREENHOUSE_PREF_OPTIONS) {
    if (raw === p) return { pref: p, notes: "" };
    if (raw.startsWith(p + "\n")) return { pref: p, notes: raw.slice(p.length + 1) };
  }
  return { pref: "", notes: raw };
}

const LIFECYCLE_OPTIONS = ["Eenjarig", "Meerjarig"] as const;

const GROWING_METHOD_OPTIONS = ["Volle grond", "Pot"] as const;

const GROWTH_HABIT_OPTIONS = [
  "Omhoog",
  "Steun nodig",
  "Langs de grond",
  "Bosvormend",
] as const;

const WATERING_METHOD_OPTIONS = [
  "Onder de voet (weken)",
  "Over de plant (bladbesproeiing)",
  "Op de bodem bij de wortels",
] as const;

const HEALTH_STATUS_OPTIONS = [
  "Net geplant",
  "Gezond",
  "In bloei",
  "Vruchten",
  "Stress",
  "Ziek",
  "Afgestorven",
] as const;

const HEALTH_STATUS_EMOJI: Record<string, string> = {
  "Net geplant": "🌱",
  Gezond: "💚",
  "In bloei": "🌼",
  Vruchten: "🍓",
  Stress: "⚠️",
  Ziek: "🤒",
  Afgestorven: "☠️",
};

const POT_MATERIAL_OPTIONS = [
  "Terracotta",
  "Kunststof",
  "Keramiek",
  "Metaal",
  "Hout",
  "Textiel",
  "Steen",
  "Biologisch afbreekbaar",
  "Anders",
] as const;

const PRUNING_TYPE_OPTIONS = [
  "Vormsnoei",
  "Onderhoudssnoei",
  "Zomersnoei",
  "Wintersnoei",
  "Uitgebloeide bloemen verwijderd",
  "Zieke delen verwijderd",
  "Geoogst en teruggeknipt",
  "Anders",
] as const;

function formatEuro(amount: number | null): string | null {
  if (amount === null) return null;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

const WINTER_HARDINESS_OPTIONS = [
  "Winterhard",
  "Beperkt winterhard",
  "Niet winterhard",
] as const;

const PROPAGATION_OPTIONS = [
  "Stekken",
  "Zaad",
  "Scheuren / delen",
  "Uitlopers",
  "Bladstek",
  "Knollen / bollen",
] as const;

const MONTH_OPTIONS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function chipClass(active: boolean): string {
  return `sv-chip px-3 py-1.5 text-sm font-medium${active ? " active" : ""}`;
}

function monthChipClass(active: boolean): string {
  return `sv-chip px-3 py-1 text-xs font-medium capitalize${active ? " active" : ""}`;
}

function warnChipClass(active: boolean): string {
  return `sv-chip px-3 py-1.5 text-sm font-medium${active ? " active warn" : ""}`;
}

function SectionHeading({ children }: { children: string }) {
  return (
    <p className="text-2xl font-semibold tracking-wide sv-heading">
      {children}
    </p>
  );
}

type PlantDraft = {
  name: string;
  species: string;
  fun_fact: string;
  location: string;
  lifecycle: string;
  size_cm: string;
  spacing_cm: string;
  growth_habit: string[];
  sun_needs: string[];
  season_notes: string;
  water_notes: string;
  watering_method: string[];
  watering_soak_minutes: string;
  growing_method: string;
  pot_min_liters: string;
  pot_recommended_liters: string;
  pot_water_notes: string;
  planted: boolean;
  water_interval_days: string;
  pot_water_interval_days: string;
  last_watered_at: string;
  feeding_notes: string;
  feeding_interval_days: string;
  last_fed_at: string;
  feeding_reminders_enabled: boolean;
  feeding_months: string[];
  soil_notes: string;
  soil_ph_min: string;
  soil_ph_max: string;
  temperature_notes: string;
  humidity_notes: string;
  winter_hardiness: string;
  winter_notes: string;
  pruning_notes: string;
  pest_notes: string;
  toxic_to_humans: boolean;
  toxic_to_cats: boolean;
  toxicity_notes: string;
  sow_months: string[];
  sow_week: string;
  sow_notes: string;
  bloom_months: string[];
  bloom_week: string;
  bloom_notes: string;
  propagation_methods: string[];
  propagation_notes: string;
  harvest_notes: string;
  harvest_months: string[];
  harvest_week: string;
  category: string;
  greenhouse_pref: string;
  greenhouse_notes: string;
  general_notes: string;
  photo_url: string;
  planted_at: string;
  reminders_enabled: boolean;
  health_status: string;
  pot_size_liters: string;
  pot_material: string;
  pot_color: string;
  soil_type: string;
  soil_mix_notes: string;
  last_repotted_at: string;
  acquired_at: string;
  source: string;
  price: string;
};

const emptyDraft: PlantDraft = {
  name: "",
  species: "",
  fun_fact: "",
  location: "",
  lifecycle: "",
  size_cm: "",
  spacing_cm: "",
  growth_habit: [],
  sun_needs: [],
  season_notes: "",
  water_notes: "",
  watering_method: [],
  watering_soak_minutes: "",
  growing_method: "",
  pot_min_liters: "",
  pot_recommended_liters: "",
  pot_water_notes: "",
  planted: false,
  water_interval_days: "",
  pot_water_interval_days: "",
  last_watered_at: "",
  feeding_notes: "",
  feeding_interval_days: "",
  last_fed_at: "",
  feeding_reminders_enabled: true,
  feeding_months: [],
  soil_notes: "",
  soil_ph_min: "",
  soil_ph_max: "",
  temperature_notes: "",
  humidity_notes: "",
  winter_hardiness: "",
  winter_notes: "",
  pruning_notes: "",
  pest_notes: "",
  toxic_to_humans: false,
  toxic_to_cats: false,
  toxicity_notes: "",
  sow_months: [],
  sow_week: "",
  sow_notes: "",
  bloom_months: [],
  bloom_week: "",
  bloom_notes: "",
  propagation_methods: [],
  propagation_notes: "",
  harvest_notes: "",
  harvest_months: [],
  harvest_week: "",
  category: "",
  greenhouse_pref: "",
  greenhouse_notes: "",
  general_notes: "",
  photo_url: "",
  planted_at: "",
  reminders_enabled: true,
  health_status: "Net geplant",
  pot_size_liters: "",
  pot_material: "",
  pot_color: "",
  soil_type: "",
  soil_mix_notes: "",
  last_repotted_at: "",
  acquired_at: "",
  source: "",
  price: "",
};

function plantToDraft(p: Plant): PlantDraft {
  return {
    name: p.name,
    species: p.species ?? "",
    fun_fact: p.fun_fact ?? "",
    location: p.location ?? "",
    lifecycle: p.lifecycle ?? "",
    size_cm: p.size_cm ? String(p.size_cm) : "",
    spacing_cm: p.spacing_cm ? String(p.spacing_cm) : "",
    growth_habit: p.growth_habit ?? [],
    sun_needs: p.sun_needs ? p.sun_needs.split(",") : [],
    season_notes: p.season_notes ?? "",
    water_notes: p.water_notes ?? "",
    watering_method: p.watering_method ?? [],
    watering_soak_minutes: p.watering_soak_minutes
      ? String(p.watering_soak_minutes)
      : "",
    growing_method: p.growing_method ?? "",
    pot_min_liters: p.pot_min_liters ? String(p.pot_min_liters) : "",
    pot_recommended_liters: p.pot_recommended_liters
      ? String(p.pot_recommended_liters)
      : "",
    pot_water_notes: p.pot_water_notes ?? "",
    planted: p.planted,
    water_interval_days: p.water_interval_days
      ? String(p.water_interval_days)
      : "",
    pot_water_interval_days: p.pot_water_interval_days
      ? String(p.pot_water_interval_days)
      : "",
    last_watered_at: p.last_watered_at ? p.last_watered_at.slice(0, 10) : "",
    feeding_notes: p.feeding_notes ?? "",
    feeding_interval_days: p.feeding_interval_days
      ? String(p.feeding_interval_days)
      : "",
    last_fed_at: p.last_fed_at ? p.last_fed_at.slice(0, 10) : "",
    feeding_reminders_enabled: p.feeding_reminders_enabled,
    feeding_months: p.feeding_months ?? [],
    soil_notes: p.soil_notes ?? "",
    soil_ph_min: p.soil_ph_min !== null ? String(p.soil_ph_min) : "",
    soil_ph_max: p.soil_ph_max !== null ? String(p.soil_ph_max) : "",
    temperature_notes: p.temperature_notes ?? "",
    humidity_notes: p.humidity_notes ?? "",
    winter_hardiness: p.winter_hardiness ?? "",
    winter_notes: p.winter_notes ?? "",
    pruning_notes: p.pruning_notes ?? "",
    pest_notes: p.pest_notes ?? "",
    toxic_to_humans: p.toxic_to_humans,
    toxic_to_cats: p.toxic_to_cats,
    toxicity_notes: p.toxicity_notes ?? "",
    sow_months: p.sow_months ?? [],
    sow_week: p.sow_week ?? "",
    sow_notes: p.sow_notes ?? "",
    bloom_months: p.bloom_months ?? [],
    bloom_week: p.bloom_week ?? "",
    bloom_notes: p.bloom_notes ?? "",
    propagation_methods: p.propagation_methods ?? [],
    propagation_notes: p.propagation_notes ?? "",
    harvest_notes: p.harvest_notes ?? "",
    harvest_months: p.harvest_months ?? [],
    harvest_week: p.harvest_week ?? "",
    category: p.category ?? "",
    greenhouse_pref: parseGreenhouseNotes(p.greenhouse_notes).pref,
    greenhouse_notes: parseGreenhouseNotes(p.greenhouse_notes).notes,
    general_notes: p.general_notes ?? "",
    photo_url: p.photo_url ?? "",
    planted_at: p.planted_at ? p.planted_at.slice(0, 10) : "",
    reminders_enabled: p.reminders_enabled,
    health_status: p.health_status ?? "",
    pot_size_liters: p.pot_size_liters ? String(p.pot_size_liters) : "",
    pot_material: p.pot_material ?? "",
    pot_color: p.pot_color ?? "",
    soil_type: p.soil_type ?? "",
    soil_mix_notes: p.soil_mix_notes ?? "",
    last_repotted_at: p.last_repotted_at ? p.last_repotted_at.slice(0, 10) : "",
    acquired_at: p.acquired_at ? p.acquired_at.slice(0, 10) : "",
    source: p.source ?? "",
    price: p.price !== null ? String(p.price) : "",
  };
}

function draftToRow(d: PlantDraft) {
  return {
    name: d.name.trim(),
    species: d.species.trim() || null,
    fun_fact: d.fun_fact.trim() || null,
    location: d.location.trim() || null,
    lifecycle: d.lifecycle || null,
    size_cm: d.size_cm ? Number(d.size_cm) : null,
    spacing_cm: d.spacing_cm ? Number(d.spacing_cm) : null,
    growth_habit: d.growth_habit,
    sun_needs: d.sun_needs.length > 0 ? d.sun_needs.join(",") : null,
    season_notes: d.season_notes.trim() || null,
    water_notes: d.water_notes.trim() || null,
    watering_method: d.watering_method,
    watering_soak_minutes: d.watering_soak_minutes
      ? Number(d.watering_soak_minutes)
      : null,
    growing_method: d.growing_method || null,
    pot_min_liters: d.pot_min_liters ? Number(d.pot_min_liters) : null,
    pot_recommended_liters: d.pot_recommended_liters
      ? Number(d.pot_recommended_liters)
      : null,
    pot_water_notes: d.pot_water_notes.trim() || null,
    planted: d.planted,
    water_interval_days: d.water_interval_days
      ? Number(d.water_interval_days)
      : null,
    pot_water_interval_days: d.pot_water_interval_days
      ? Number(d.pot_water_interval_days)
      : null,
    last_watered_at: d.last_watered_at
      ? new Date(d.last_watered_at).toISOString()
      : null,
    feeding_notes: d.feeding_notes.trim() || null,
    feeding_interval_days: d.feeding_interval_days
      ? Number(d.feeding_interval_days)
      : null,
    last_fed_at: d.last_fed_at
      ? new Date(d.last_fed_at).toISOString()
      : null,
    feeding_reminders_enabled: d.feeding_reminders_enabled,
    feeding_months: d.feeding_months,
    soil_notes: d.soil_notes.trim() || null,
    soil_ph_min: d.soil_ph_min ? Number(d.soil_ph_min) : null,
    soil_ph_max: d.soil_ph_max ? Number(d.soil_ph_max) : null,
    temperature_notes: d.temperature_notes.trim() || null,
    humidity_notes: d.humidity_notes.trim() || null,
    winter_hardiness: d.winter_hardiness || null,
    winter_notes: d.winter_notes.trim() || null,
    pruning_notes: d.pruning_notes.trim() || null,
    pest_notes: d.pest_notes.trim() || null,
    toxic_to_humans: d.toxic_to_humans,
    toxic_to_cats: d.toxic_to_cats,
    toxicity_notes: d.toxicity_notes.trim() || null,
    sow_months: d.sow_months,
    sow_week: d.sow_week.trim() || null,
    sow_notes: d.sow_notes.trim() || null,
    bloom_months: d.bloom_months,
    bloom_week: d.bloom_week.trim() || null,
    bloom_notes: d.bloom_notes.trim() || null,
    propagation_methods: d.propagation_methods,
    propagation_notes: d.propagation_notes.trim() || null,
    harvest_notes: d.harvest_notes.trim() || null,
    harvest_months: d.harvest_months,
    harvest_week: d.harvest_week.trim() || null,
    category: d.category || null,
    greenhouse_notes:
      [d.greenhouse_pref, d.greenhouse_notes.trim()].filter(Boolean).join("\n") || null,
    general_notes: d.general_notes.trim() || null,
    photo_url: d.photo_url.trim() || null,
    planted_at: d.planted_at ? new Date(d.planted_at).toISOString() : null,
    reminders_enabled: d.reminders_enabled,
    health_status: d.health_status || null,
    pot_size_liters: d.pot_size_liters ? Number(d.pot_size_liters) : null,
    pot_material: d.pot_material || null,
    pot_color: d.pot_color.trim() || null,
    soil_type: d.soil_type.trim() || null,
    soil_mix_notes: d.soil_mix_notes.trim() || null,
    last_repotted_at: d.last_repotted_at || null,
    acquired_at: d.acquired_at || null,
    source: d.source.trim() || null,
    price: d.price ? Number(d.price) : null,
  };
}

function effectiveWaterIntervalDays(p: Plant): number | null {
  if (p.growing_method === "Pot" && p.pot_water_interval_days) {
    return p.pot_water_interval_days;
  }
  return p.water_interval_days;
}

function waterStatus(p: Plant): { label: string; overdue: boolean } | null {
  if (!p.planted) return null;
  const intervalDays = effectiveWaterIntervalDays(p);
  if (!intervalDays) return null;
  const todayIso = new Date().toISOString().slice(0, 10);
  if (p.water_skip_until && todayIso < p.water_skip_until) {
    return { label: "Uitgesteld tot morgen", overdue: false };
  }
  if (!p.last_watered_at)
    return { label: "Nog geen water gegeven", overdue: true };
  const dueAt =
    new Date(p.last_watered_at).getTime() + intervalDays * 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0) return { label: "Water geven!", overdue: true };
  if (daysLeft === 1) return { label: "Morgen water geven", overdue: false };
  return { label: `Over ${daysLeft} dagen`, overdue: false };
}

function feedingStatus(p: Plant): { label: string; overdue: boolean } | null {
  if (!p.planted) return null;
  if (!p.feeding_interval_days) return null;
  if (p.feeding_months.length > 0) {
    const currentMonth = MONTH_OPTIONS[new Date().getMonth()];
    if (!p.feeding_months.includes(currentMonth)) return null;
  }
  if (!p.last_fed_at)
    return { label: "Nog geen voeding gegeven", overdue: true };
  const dueAt =
    new Date(p.last_fed_at).getTime() +
    p.feeding_interval_days * 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0) return { label: "Voeding geven!", overdue: true };
  if (daysLeft === 1) return { label: "Morgen voeding geven", overdue: false };
  return { label: `Over ${daysLeft} dagen`, overdue: false };
}

function daysAgoLabel(n: number): string {
  if (n === 0) return "vandaag";
  if (n === 1) return "gisteren";
  return `${n} dagen geleden`;
}

function plantAge(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return null;
  const days = Math.floor(diffMs / 86400000);
  if (days < 7) return `${days} dag${days === 1 ? "" : "en"}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} week${weeks === 1 ? "" : "en"}`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} maand${months === 1 ? "" : "en"}`;
  const years = Math.floor(days / 365.25);
  const remMonths = Math.floor((days - years * 365.25) / 30.44);
  return remMonths > 0 ? `${years} jaar en ${remMonths} maand${remMonths === 1 ? "" : "en"}` : `${years} jaar`;
}

function checkedLabel(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const days = Math.floor(
    (Date.now() - new Date(dateStr + "T00:00:00").getTime()) / 86400000,
  );
  if (days <= 0) return "Vandaag gecontroleerd";
  if (days === 1) return "Gisteren gecontroleerd";
  return `${days} dagen geleden gecontroleerd`;
}

async function fetchPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from("plants")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchPhotos(plantId: string): Promise<PlantPhoto[]> {
  const { data, error } = await supabase
    .from("plant_photos")
    .select("*")
    .eq("plant_id", plantId)
    .order("taken_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchHarvestLogs(plantId: string): Promise<PlantHarvestLog[]> {
  const { data, error } = await supabase
    .from("plant_harvest_logs")
    .select("*")
    .eq("plant_id", plantId)
    .order("harvested_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchPruningLogs(plantId: string): Promise<PlantPruningLog[]> {
  const { data, error } = await supabase
    .from("plant_pruning_logs")
    .select("*")
    .eq("plant_id", plantId)
    .order("pruned_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchRepotLogs(plantId: string): Promise<PlantRepotLog[]> {
  const { data, error } = await supabase
    .from("plant_repot_logs")
    .select("*")
    .eq("plant_id", plantId)
    .order("repotted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function PlantForm({
  draft,
  onChange,
}: {
  draft: PlantDraft;
  onChange: (patch: Partial<PlantDraft>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <SectionHeading>Categorie</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {PLANT_CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ category: draft.category === opt ? "" : opt })
              }
              className={chipClass(draft.category === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Status</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {HEALTH_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ health_status: draft.health_status === opt ? "" : opt })
              }
              className={chipClass(draft.health_status === opt)}
            >
              {HEALTH_STATUS_EMOJI[opt]} {opt}
            </button>
          ))}
        </div>
      </div>

      <Input
        placeholder="Naam plant"
        value={draft.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="Soort (Latijnse naam)"
          value={draft.species}
          onChange={(e) => onChange({ species: e.target.value })}
        />
        <Input
          placeholder="Foto: link of /plant-fotos/bestand.jpg"
          value={draft.photo_url}
          onChange={(e) => onChange({ photo_url: e.target.value })}
        />
      </div>
      <Textarea
        placeholder="Leuk weetje over deze plant (optioneel)"
        rows={2}
        value={draft.fun_fact}
        onChange={(e) => onChange({ fun_fact: e.target.value })}
      />

      <div className="space-y-2">
        <SectionHeading>Eenjarig of meerjarig</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {LIFECYCLE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ lifecycle: draft.lifecycle === opt ? "" : opt })
              }
              className={chipClass(draft.lifecycle === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Grootte in cm</SectionHeading>
        <Input
          type="number"
          min={1}
          placeholder="bv. 150"
          value={draft.size_cm}
          onChange={(e) => onChange({ size_cm: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Plantafstand in cm</SectionHeading>
        <Input
          type="number"
          min={1}
          placeholder="bv. 30"
          value={draft.spacing_cm}
          onChange={(e) => onChange({ spacing_cm: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Groeiwijze</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {GROWTH_HABIT_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({
                  growth_habit: toggleInArray(draft.growth_habit, opt),
                })
              }
              className={chipClass(draft.growth_habit.includes(opt))}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Standplaats & seizoen</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {SUN_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ sun_needs: toggleInArray(draft.sun_needs, opt) })
              }
              className={chipClass(draft.sun_needs.includes(opt))}
            >
              {opt}
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.season_notes}
          onChange={(e) => onChange({ season_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Water</SectionHeading>
        <Textarea
          placeholder="Water-notities"
          rows={2}
          value={draft.water_notes}
          onChange={(e) => onChange({ water_notes: e.target.value })}
        />
        <div className="space-y-1">
          <p className="text-xs sv-muted">Hoe het beste water geven</p>
          <div className="flex gap-2 flex-wrap">
            {WATERING_METHOD_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  onChange({
                    watering_method: toggleInArray(draft.watering_method, opt),
                  })
                }
                className={chipClass(draft.watering_method.includes(opt))}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs sv-muted">
            Weektijd in minuten (bij "onder de voet")
          </p>
          <Input
            type="number"
            min={1}
            placeholder="bv. 15"
            value={draft.watering_soak_minutes}
            onChange={(e) =>
              onChange({ watering_soak_minutes: e.target.value })
            }
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs sv-muted">Volle grond of pot</p>
          <div className="flex gap-2 flex-wrap">
            {GROWING_METHOD_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  onChange({
                    growing_method: draft.growing_method === opt ? "" : opt,
                  })
                }
                className={chipClass(draft.growing_method === opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs sv-muted">Minimale potgrootte (liter)</p>
            <Input
              type="number"
              min={1}
              placeholder="bv. 10"
              value={draft.pot_min_liters}
              onChange={(e) => onChange({ pot_min_liters: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs sv-muted">Aanbevolen potgrootte (liter)</p>
            <Input
              type="number"
              min={1}
              placeholder="bv. 20"
              value={draft.pot_recommended_liters}
              onChange={(e) =>
                onChange({ pot_recommended_liters: e.target.value })
              }
            />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs sv-muted">Extra water-notitie voor pot</p>
          <Input
            placeholder="bv. In pot vaker water geven"
            value={draft.pot_water_notes}
            onChange={(e) => onChange({ pot_water_notes: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm sv-muted">
          <input
            type="checkbox"
            checked={draft.planted}
            onChange={(e) => onChange({ planted: e.target.checked })}
          />
          Gepland (in de grond/pot gezet)
        </label>
        <div className="space-y-1">
          <p className="text-xs sv-muted">Datum geplant / gezaaid</p>
          <Input
            type="date"
            value={draft.planted_at}
            onChange={(e) => onChange({ planted_at: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs sv-muted">Elke hoeveel dagen water (volle grond)</p>
            <Input
              type="number"
              min={1}
              placeholder="bv. 7"
              value={draft.water_interval_days}
              onChange={(e) =>
                onChange({ water_interval_days: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs sv-muted">Elke hoeveel dagen water (in pot)</p>
            <Input
              type="number"
              min={1}
              placeholder="bv. 4"
              value={draft.pot_water_interval_days}
              onChange={(e) =>
                onChange({ pot_water_interval_days: e.target.value })
              }
            />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs sv-muted">Laatst water gegeven op</p>
          <Input
            type="date"
            value={draft.last_watered_at}
            onChange={(e) =>
              onChange({ last_watered_at: e.target.value })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm sv-muted">
          <input
            type="checkbox"
            checked={draft.reminders_enabled}
            onChange={(e) =>
              onChange({ reminders_enabled: e.target.checked })
            }
          />
          Stuur een melding als het tijd is om water te geven
        </label>
      </div>

      <div className="space-y-2">
        <SectionHeading>Herkomst</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs sv-muted">Verkregen op</p>
            <Input
              type="date"
              value={draft.acquired_at}
              onChange={(e) => onChange({ acquired_at: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs sv-muted">Prijs (€)</p>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="bv. 9.95"
              value={draft.price}
              onChange={(e) => onChange({ price: e.target.value })}
            />
          </div>
        </div>
        <Input
          placeholder="Herkomst, bv. Intratuin, cadeau van Hannah, zelf gezaaid"
          value={draft.source}
          onChange={(e) => onChange({ source: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Pot (werkelijk)</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs sv-muted">Huidige potgrootte (liter)</p>
            <Input
              type="number"
              min={1}
              placeholder="bv. 20"
              value={draft.pot_size_liters}
              onChange={(e) => onChange({ pot_size_liters: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs sv-muted">Potkleur</p>
            <Input
              placeholder="bv. terracotta-rood"
              value={draft.pot_color}
              onChange={(e) => onChange({ pot_color: e.target.value })}
            />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {POT_MATERIAL_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ pot_material: draft.pot_material === opt ? "" : opt })
              }
              className={chipClass(draft.pot_material === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-xs sv-muted">Laatst verpot op</p>
          <Input
            type="date"
            value={draft.last_repotted_at}
            onChange={(e) => onChange({ last_repotted_at: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Zaaien</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {MONTH_OPTIONS.map((month) => (
            <button
              key={month}
              type="button"
              onClick={() =>
                onChange({ sow_months: toggleInArray(draft.sow_months, month) })
              }
              className={monthChipClass(draft.sow_months.includes(month))}
            >
              {month}
            </button>
          ))}
        </div>
        <Input
          placeholder="Zaaiweek (optioneel, bv. week 2)"
          value={draft.sow_week}
          onChange={(e) => onChange({ sow_week: e.target.value })}
        />
        <Textarea
          placeholder="Overige zaai-notities"
          rows={2}
          value={draft.sow_notes}
          onChange={(e) => onChange({ sow_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Bloeien (indien bloemen)</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {MONTH_OPTIONS.map((month) => (
            <button
              key={month}
              type="button"
              onClick={() =>
                onChange({
                  bloom_months: toggleInArray(draft.bloom_months, month),
                })
              }
              className={monthChipClass(draft.bloom_months.includes(month))}
            >
              {month}
            </button>
          ))}
        </div>
        <Input
          placeholder="Bloeiweek (optioneel, bv. week 2)"
          value={draft.bloom_week}
          onChange={(e) => onChange({ bloom_week: e.target.value })}
        />
        <Textarea
          placeholder="Overige bloei-notities"
          rows={2}
          value={draft.bloom_notes}
          onChange={(e) => onChange({ bloom_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Oogst</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {MONTH_OPTIONS.map((month) => (
            <button
              key={month}
              type="button"
              onClick={() =>
                onChange({
                  harvest_months: toggleInArray(draft.harvest_months, month),
                })
              }
              className={monthChipClass(draft.harvest_months.includes(month))}
            >
              {month}
            </button>
          ))}
        </div>
        <Input
          placeholder="Oogstweek (optioneel, bv. week 2)"
          value={draft.harvest_week}
          onChange={(e) => onChange({ harvest_week: e.target.value })}
        />
        <Textarea
          placeholder="Overige oogst-notities"
          rows={2}
          value={draft.harvest_notes}
          onChange={(e) => onChange({ harvest_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Kas</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {GREENHOUSE_PREF_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ greenhouse_pref: draft.greenhouse_pref === opt ? "" : opt })
              }
              className={chipClass(draft.greenhouse_pref === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.greenhouse_notes}
          onChange={(e) => onChange({ greenhouse_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Voeding</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.feeding_notes}
          onChange={(e) => onChange({ feeding_notes: e.target.value })}
        />
        <div className="space-y-1">
          <p className="text-xs sv-muted">In welke maanden voeden</p>
          <div className="flex gap-2 flex-wrap">
            {MONTH_OPTIONS.map((month) => (
              <button
                key={month}
                type="button"
                onClick={() =>
                  onChange({
                    feeding_months: toggleInArray(draft.feeding_months, month),
                  })
                }
                className={monthChipClass(draft.feeding_months.includes(month))}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs sv-muted">Elke hoeveel dagen voeden</p>
            <Input
              type="number"
              min={1}
              placeholder="bv. 14"
              value={draft.feeding_interval_days}
              onChange={(e) =>
                onChange({ feeding_interval_days: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs sv-muted">Laatst gevoed op</p>
            <Input
              type="date"
              value={draft.last_fed_at}
              onChange={(e) =>
                onChange({ last_fed_at: e.target.value })
              }
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm sv-muted">
          <input
            type="checkbox"
            checked={draft.feeding_reminders_enabled}
            onChange={(e) =>
              onChange({ feeding_reminders_enabled: e.target.checked })
            }
          />
          Stuur een melding als het tijd is om te voeden
        </label>
      </div>

      <div className="space-y-2">
        <SectionHeading>Grond</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.soil_notes}
          onChange={(e) => onChange({ soil_notes: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs sv-muted">Minimale pH</p>
            <Input
              type="number"
              step="0.1"
              min={0}
              max={14}
              placeholder="bv. 6.0"
              value={draft.soil_ph_min}
              onChange={(e) => onChange({ soil_ph_min: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs sv-muted">Maximale pH</p>
            <Input
              type="number"
              step="0.1"
              min={0}
              max={14}
              placeholder="bv. 7.0"
              value={draft.soil_ph_max}
              onChange={(e) => onChange({ soil_ph_max: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Grond (werkelijk)</SectionHeading>
        <Input
          placeholder="bv. Pokon Moestuingrond"
          value={draft.soil_type}
          onChange={(e) => onChange({ soil_type: e.target.value })}
        />
        <Textarea
          placeholder="Samenstelling, bv. 60% potgrond, 20% perliet, 20% kokos"
          rows={2}
          value={draft.soil_mix_notes}
          onChange={(e) => onChange({ soil_mix_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Klimaat</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.temperature_notes}
          onChange={(e) => onChange({ temperature_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Winterhardheid</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {WINTER_HARDINESS_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({
                  winter_hardiness: draft.winter_hardiness === opt ? "" : opt,
                })
              }
              className={chipClass(draft.winter_hardiness === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Winter-notities (bv. vorstvrij houden, afdekken met vorstdoek)"
          rows={2}
          value={draft.winter_notes}
          onChange={(e) => onChange({ winter_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Snoeien</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.pruning_notes}
          onChange={(e) => onChange({ pruning_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Ziektes & plagen</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.pest_notes}
          onChange={(e) => onChange({ pest_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Vermeerderen</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {PROPAGATION_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({
                  propagation_methods: toggleInArray(
                    draft.propagation_methods,
                    opt,
                  ),
                })
              }
              className={chipClass(draft.propagation_methods.includes(opt))}
            >
              {opt}
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Overige vermeerder-notities"
          rows={2}
          value={draft.propagation_notes}
          onChange={(e) => onChange({ propagation_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Giftigheid</SectionHeading>
        <p className="text-sm sv-muted">Giftig voor</p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              onChange({ toxic_to_humans: !draft.toxic_to_humans })
            }
            className={warnChipClass(draft.toxic_to_humans)}
          >
            Mens
          </button>
          <button
            type="button"
            onClick={() => onChange({ toxic_to_cats: !draft.toxic_to_cats })}
            className={warnChipClass(draft.toxic_to_cats)}
          >
            Kat
          </button>
        </div>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.toxicity_notes}
          onChange={(e) => onChange({ toxicity_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Overig</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.general_notes}
          onChange={(e) => onChange({ general_notes: e.target.value })}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-2xl font-bold tracking-wide sv-heading">{label}</p>
      <p className="text-sm mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function CompactInfo({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs sv-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

function sn(structured: (string | null | undefined)[], notes: (string | null | undefined)[]): string | null {
  const s = structured.filter(Boolean).join(" · ");
  const n = notes.filter(Boolean).join(" · ");
  if (s && n) return `${s}\n${n}`;
  return s || n || null;
}

function PlantCard({
  p,
  onOpen,
  onWater,
  onFeed,
}: {
  p: Plant;
  onOpen: (p: Plant) => void;
  onWater: (p: Plant) => void;
  onFeed: (p: Plant) => void;
}) {
  const status = waterStatus(p);
  const feedStatus = feedingStatus(p);
  return (
    <button
      onClick={() => onOpen(p)}
      className="sv-panel text-left p-5 hover:-translate-y-0.5 transition-transform flex items-center gap-3"
    >
      {p.photo_url ? (
        <img src={p.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 sv-icon-slot" />
      ) : (
        <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
          <Sprout className="h-5 w-5" strokeWidth={1.6} />
        </div>
      )}
      <div className="min-w-0">
        <p className="sv-heading text-2xl leading-snug truncate">
          {p.health_status && (
            <span aria-label={p.health_status}>
              {HEALTH_STATUS_EMOJI[p.health_status]}{" "}
            </span>
          )}
          {p.name}
        </p>
        {(status || feedStatus) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {status && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onWater(p);
                }}
                className={`sv-heading inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full w-fit cursor-pointer hover:brightness-95 ${status.overdue ? "sv-badge-overdue" : "sv-badge-ok"}`}
              >
                <Droplet className="h-3 w-3" /> {status.label}
              </span>
            )}
            {feedStatus && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFeed(p);
                }}
                className={`sv-heading inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full w-fit cursor-pointer hover:brightness-95 ${feedStatus.overdue ? "sv-badge-overdue" : "sv-badge-ok"}`}
              >
                <Leaf className="h-3 w-3" /> {feedStatus.label}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function PlantSeasonRow({ p }: { p: Plant }) {
  return (
    <div className="flex items-center gap-2">
      {p.photo_url ? (
        <img src={p.photo_url} alt="" className="h-7 w-7 rounded object-cover shrink-0 sv-icon-slot" />
      ) : (
        <div className="h-7 w-7 sv-icon-slot flex items-center justify-center shrink-0">
          <Sprout className="h-3.5 w-3.5" strokeWidth={1.6} />
        </div>
      )}
      <p className="sv-heading text-xl">{p.name}</p>
    </div>
  );
}

function SeasonalOverview({ plants }: { plants: Plant[] }) {
  const [open, setOpen] = useState(true);
  const [monthIndex, setMonthIndex] = useState(new Date().getMonth());
  const currentMonth = MONTH_OPTIONS[monthIndex];
  const monthLabel = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
  const isCurrentMonth = monthIndex === new Date().getMonth();

  const sowNow = plants.filter((p) => p.sow_months.includes(currentMonth));
  const bloomNow = plants.filter((p) => p.bloom_months.includes(currentMonth));
  const harvestNow = plants.filter((p) => p.harvest_months.includes(currentMonth));

  const isEmpty = sowNow.length === 0 && bloomNow.length === 0 && harvestNow.length === 0;

  return (
    <div className="sv-panel p-5 space-y-3">
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={() => setMonthIndex((i) => (i + 11) % 12)}
          className="sv-icon-slot h-7 w-7 flex items-center justify-center rounded shrink-0"
          aria-label="Vorige maand"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="sv-heading text-2xl flex-1 text-center">
          🌱 {monthLabel}
        </p>
        {!isCurrentMonth && (
          <button
            onClick={() => setMonthIndex(new Date().getMonth())}
            className="text-xs sv-muted underline shrink-0"
          >
            nu
          </button>
        )}
        <button
          onClick={() => setMonthIndex((i) => (i + 1) % 12)}
          className="sv-icon-slot h-7 w-7 flex items-center justify-center rounded shrink-0"
          aria-label="Volgende maand"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button onClick={() => setOpen((v) => !v)} className="shrink-0">
          {open ? <ChevronUp className="h-4 w-4 sv-muted" /> : <ChevronDown className="h-4 w-4 sv-muted" />}
        </button>
      </div>
      {open && (
        <div className="space-y-3 pt-1">
          {isEmpty && (
            <p className="text-sm sv-muted">Niets gepland voor {monthLabel}.</p>
          )}
          {sowNow.length > 0 && (
            <div>
              <p className="text-xs sv-muted mb-1">Zaaien</p>
              <div className="space-y-1">
                {sowNow.map((p) => <PlantSeasonRow key={p.id} p={p} />)}
              </div>
            </div>
          )}
          {bloomNow.length > 0 && (
            <div>
              <p className="text-xs sv-muted mb-1">In bloei</p>
              <div className="space-y-1">
                {bloomNow.map((p) => <PlantSeasonRow key={p.id} p={p} />)}
              </div>
            </div>
          )}
          {harvestNow.length > 0 && (
            <div>
              <p className="text-xs sv-muted mb-1">Oogsten</p>
              <div className="space-y-1">
                {harvestNow.map((p) => <PlantSeasonRow key={p.id} p={p} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



// ─── Water advice ───────────────────────────────────────────────────────────

type SoilMoisture = "kurkdroog" | "droog" | "vochtig" | "nat" | "";
type PotMaterial = "terracotta" | "kunststof" | "";
type WaterUrgency = "hoog" | "middel" | "laag" | "overslaan";

interface WaterAdvice {
  urgency: WaterUrgency;
  message: string;
}

function computeWaterAdvice(
  plant: Plant,
  opts: { soilMoisture: SoilMoisture; rainToday: boolean; tempHigh: boolean; strongWind: boolean; potMaterial: PotMaterial },
): WaterAdvice | null {
  const { soilMoisture, rainToday, tempHigh, strongWind, potMaterial } = opts;
  if (!soilMoisture && !rainToday && !tempHigh && !strongWind && !potMaterial) return null;

  const inPot = plant.growing_method === "Pot";
  const greenPref = parseGreenhouseNotes(plant.greenhouse_notes).pref?.toLowerCase() ?? "";
  const inGreenhouse = greenPref.includes("kas") && !greenPref.includes("alleen buiten");

  if (soilMoisture === "nat")
    return { urgency: "overslaan", message: "De grond is nog nat — wacht nog even met water geven." };

  if (soilMoisture === "vochtig" && rainToday && !inGreenhouse)
    return { urgency: "overslaan", message: "Het heeft geregend en de grond is vochtig — sla vandaag over." };

  if (soilMoisture === "vochtig")
    return { urgency: "laag", message: "De grond is licht vochtig. Wacht een dag of geef een kleine hoeveelheid." };

  if (rainToday && !inGreenhouse && !inPot && soilMoisture !== "kurkdroog" && soilMoisture !== "droog")
    return { urgency: "laag", message: "Het heeft geregend — volle-grond planten hebben genoeg water gekregen." };

  const mods: string[] = [];
  if (tempHigh) mods.push("warmte versnelt verdamping");
  if (strongWind) mods.push("wind droogt de aarde sneller uit");
  if (potMaterial === "terracotta") mods.push("terracotta droogt sneller uit dan kunststof");
  if (inPot && rainToday && !inGreenhouse) mods.push("pot vangt geen regen op — toch water geven");

  const urgency: WaterUrgency =
    soilMoisture === "kurkdroog" || soilMoisture === "droog" ? "hoog" : "middel";

  let message =
    urgency === "hoog"
      ? "Geef nu water — de plant heeft het zeker nodig."
      : "Het is een goed moment om water te geven.";
  if (mods.length > 0) message += ` Let op: ${mods.join("; ")}.`;

  return { urgency, message };
}

// ─── WaterPanel component ───────────────────────────────────────────────────

function WaterPanel({
  plant,
  onWatered,
  onSkipWet,
  onSkipToday,
}: {
  plant: Plant;
  onWatered: (note: string) => void;
  onSkipWet: () => void;
  onSkipToday: () => void;
}) {
  const inPot = plant.growing_method === "Pot";

  const [soilMoisture, setSoilMoisture] = useState<SoilMoisture>("");
  const [rainToday, setRainToday] = useState(false);
  const [tempHigh, setTempHigh] = useState(false);
  const [strongWind, setStrongWind] = useState(false);
  const [potMaterial, setPotMaterial] = useState<PotMaterial>("");
  const [note, setNote] = useState("");

  const advice = computeWaterAdvice(plant, { soilMoisture, rainToday, tempHigh, strongWind, potMaterial });

  const wateringTip = inPot
    ? "Geef water totdat er water uit de drainagegaten onder de pot begint te lopen. Geef liever één keer goed water dan meerdere kleine beetjes."
    : "Geef minder vaak, maar wel royaal zodat het water diep in de bodem trekt. Hierdoor ontwikkelen planten diepere en sterkere wortels.";

  function handleWatered() {
    onWatered(note.trim());
    setNote("");
  }

  const soilBtns: { value: Exclude<SoilMoisture, "">; emoji: string; label: string }[] = [
    { value: "kurkdroog", emoji: "🏜️", label: "Kurkdroog" },
    { value: "droog", emoji: "🌵", label: "Droog" },
    { value: "vochtig", emoji: "💧", label: "Vochtig" },
    { value: "nat", emoji: "💦", label: "Nat" },
  ];

  const urgencyStyle: Record<WaterUrgency, string> = {
    hoog: "sv-badge-overdue rounded-xl px-4 py-3",
    middel: "sv-badge-ok rounded-xl px-4 py-3",
    laag: "sv-badge-ok rounded-xl px-4 py-3",
    overslaan: "sv-inset px-4 py-3",
  };
  const urgencyLabel: Record<WaterUrgency, string> = {
    hoog: "🔴 Dringend water geven",
    middel: "🟡 Tijd om water te geven",
    laag: "🟢 Nog even wachten",
    overslaan: "⏭️ Overslaan vandaag",
  };

  function toggleChip(label: string, active: boolean, onToggle: () => void) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`sv-button sv-button-thin-border px-3 py-1.5 text-xs whitespace-nowrap flex items-center gap-1${active ? " ring-2 ring-offset-1 ring-[var(--sv-wood-dark)]" : ""}`}
      >
        {active && <span>✓</span>}
        {label}
      </button>
    );
  }

  return (
    <div className="sv-inset p-4 space-y-5 rounded-xl">
      {/* Watertip */}
      <p className="text-xs sv-muted italic">{wateringTip}</p>

      {/* Grondvocht meting */}
      <div className="space-y-2">
        <p className="text-[11px] sv-muted uppercase tracking-wider font-semibold">Hoe voelt de grond?</p>
        <div className="grid grid-cols-4 gap-1.5">
          {soilBtns.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSoilMoisture(soilMoisture === opt.value ? "" : opt.value)}
              className={`sv-button sv-button-thin-border flex flex-col items-center gap-1 py-2.5 text-xs leading-snug${soilMoisture === opt.value ? " ring-2 ring-offset-1 ring-[var(--sv-wood-dark)]" : ""}`}
            >
              <span className="text-lg">{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Omstandigheden */}
      <div className="space-y-2">
        <p className="text-[11px] sv-muted uppercase tracking-wider font-semibold">Omstandigheden vandaag</p>
        <div className="flex flex-wrap gap-1.5">
          {toggleChip("🌧️ Regen", rainToday, () => setRainToday(!rainToday))}
          {toggleChip("🌡️ Heet (>25°C)", tempHigh, () => setTempHigh(!tempHigh))}
          {toggleChip("💨 Sterke wind", strongWind, () => setStrongWind(!strongWind))}
          {inPot && toggleChip("🏺 Terracotta", potMaterial === "terracotta", () => setPotMaterial(potMaterial === "terracotta" ? "" : "terracotta"))}
          {inPot && toggleChip("🪣 Kunststof", potMaterial === "kunststof", () => setPotMaterial(potMaterial === "kunststof" ? "" : "kunststof"))}
        </div>
      </div>

      {/* Advieskaart */}
      {advice && (
        <div className={urgencyStyle[advice.urgency]}>
          <p className="sv-heading text-sm font-semibold">{urgencyLabel[advice.urgency]}</p>
          <p className="text-sm mt-0.5">{advice.message}</p>
        </div>
      )}

      {/* Optionele notitie */}
      <div className="space-y-1.5">
        <label className="text-[11px] sv-muted uppercase tracking-wider font-semibold block">
          Notitie <span className="normal-case opacity-60">(optioneel)</span>
        </label>
        <Textarea
          placeholder="Bijv. bladeren hingen slap, of aarde voelde heel droog..."
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="text-sm resize-none"
        />
      </div>

      {/* Actieknoppen */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="sv-button gap-1.5" onClick={handleWatered}>
          <Droplet className="h-3.5 w-3.5" /> Water gegeven
        </Button>
        <Button size="sm" className="sv-button sv-button-ghost gap-1.5" onClick={onSkipWet}>
          💧 Grond nog nat
        </Button>
        <Button size="sm" className="sv-button sv-button-ghost gap-1.5" onClick={onSkipToday}>
          ⏭️ Sla vandaag over
        </Button>
      </div>
    </div>
  );
}

// ─── WaterSection component ─────────────────────────────────────────────────

function WaterSection({
  plant,
  onRecordWatering,
  onSyncLastWatered,
  onSkipToday,
  isUpdating,
  isRecording,
}: {
  plant: Plant;
  onRecordWatering: (plant: Plant, note?: string) => void;
  onSyncLastWatered: (isoDate: string | null) => void;
  onSkipToday: () => void;
  isUpdating: boolean;
  isRecording: boolean;
}) {
  const { entries, updateEntry, deleteEntry } = useGrowthLog();
  const inPot = plant.growing_method === "Pot";

  // Water history: growth log entries where watered=true for this plant
  const waterHistory = entries
    .filter(
      (e) =>
        e.watered &&
        (e.plant_id === plant.id || e.plant_name === plant.name),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Fallback to Supabase field when no local history yet
  const lastWaterDateStr =
    waterHistory[0]?.date ?? plant.last_watered_at?.slice(0, 10) ?? null;

  const interval = effectiveWaterIntervalDays(plant);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastWaterDate = lastWaterDateStr
    ? new Date(lastWaterDateStr + "T00:00:00")
    : null;

  const daysAgo =
    lastWaterDate !== null
      ? Math.floor((today.getTime() - lastWaterDate.getTime()) / 86_400_000)
      : null;

  const nextWaterDate =
    lastWaterDate && interval
      ? new Date(lastWaterDate.getTime() + interval * 86_400_000)
      : null;

  const daysLeft =
    nextWaterDate !== null
      ? Math.ceil((nextWaterDate.getTime() - today.getTime()) / 86_400_000)
      : null;

  const todayIso = today.toISOString().slice(0, 10);
  const isSkippedToday = !!plant.water_skip_until && todayIso < plant.water_skip_until;

  const [quickNote, setQuickNote] = useState("");
  const [grondcheckOpen, setGrondcheckOpen] = useState(false);
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function recordWatering(note: string) {
    onRecordWatering(plant, note);
    setQuickNote("");
    setGrondcheckOpen(false);
  }

  function handleDelete(id: string) {
    const remaining = entries
      .filter(
        (e) =>
          e.id !== id &&
          e.watered &&
          (e.plant_id === plant.id || e.plant_name === plant.name),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    deleteEntry(id);
    onSyncLastWatered(remaining[0]?.date ?? null);
    setConfirmDeleteId(null);
  }

  function handleSaveNote(id: string) {
    updateEntry(id, { notes: editNote.trim() || "Water gegeven" });
    setEditingId(null);
  }

  function daysLeftBadge() {
    if (isSkippedToday) return { label: "Uitgesteld tot morgen", overdue: false };
    if (daysLeft === null || !interval) return null;
    if (daysLeft < 0)
      return {
        label: `${Math.abs(daysLeft)} dag${Math.abs(daysLeft) !== 1 ? "en" : ""} te laat`,
        overdue: true,
      };
    if (daysLeft === 0) return { label: "Vandaag water geven", overdue: true };
    if (daysLeft === 1) return { label: "Morgen water geven", overdue: false };
    return { label: `Over ${daysLeft} dagen`, overdue: false };
  }

  const badge = daysLeftBadge();

  const hasAdvice =
    !!(
      plant.water_notes ||
      plant.pot_water_notes ||
      plant.watering_method.length > 0 ||
      plant.water_interval_days ||
      plant.pot_water_interval_days
    );

  return (
    <div className="sv-panel p-4 space-y-4">
      <h3 className="sv-heading text-xl flex items-center gap-2">
        <Droplet className="h-4 w-4" /> Water geven
      </h3>

      {/* Huidige waterstatus */}
      <div className="space-y-2">
        {!lastWaterDate ? (
          <p className="text-sm sv-muted">Nog geen watergift geregistreerd.</p>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <span className="sv-muted">Laatste watergift</span>
            <span>
              {lastWaterDate.toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
              })}
              {daysAgo !== null && (
                <span className="sv-muted ml-1.5">({daysAgoLabel(daysAgo)})</span>
              )}
            </span>
            {nextWaterDate && (
              <>
                <span className="sv-muted">Volgende watergift</span>
                <span>
                  {nextWaterDate.toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </>
            )}
            {interval && (
              <>
                <span className="sv-muted">Waterinterval</span>
                <span>
                  elke {interval} dag{interval !== 1 ? "en" : ""}{" "}
                  <span className="sv-muted">({inPot ? "pot" : "volle grond"})</span>
                </span>
              </>
            )}
          </div>
        )}
        {!interval && (
          <p className="text-xs sv-muted">
            Geen vast waterinterval beschikbaar — controleer de grond voordat je water geeft.
          </p>
        )}
        {badge && (
          <span
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full sv-heading ${
              badge.overdue ? "sv-badge-overdue" : "sv-badge-ok"
            }`}
          >
            <Droplet className="h-3 w-3" /> {badge.label}
          </span>
        )}
      </div>

      {/* Snelle wateractie */}
      <div className="flex gap-2">
        <Input
          placeholder="Notitie (optioneel)..."
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
          className="text-sm"
          onKeyDown={(e) => e.key === "Enter" && recordWatering(quickNote)}
        />
        <Button
          size="sm"
          className="sv-button shrink-0 gap-1.5"
          onClick={() => recordWatering(quickNote)}
          disabled={isUpdating || isRecording}
        >
          {isRecording ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Droplet className="h-3.5 w-3.5" />
          )}{" "}
          Water gegeven
        </Button>
      </div>

      {/* Grondcheck (optioneel) */}
      <div>
        <button
          type="button"
          onClick={() => setGrondcheckOpen(!grondcheckOpen)}
          className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2 text-sm"
        >
          <span>Grondcheck (optioneel)</span>
          {grondcheckOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        {grondcheckOpen && (
          <div className="mt-2">
            <WaterPanel
              plant={plant}
              onWatered={(note) => recordWatering(note)}
              onSkipWet={() => setGrondcheckOpen(false)}
              onSkipToday={() => {
                onSkipToday();
                setGrondcheckOpen(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Wateradvies */}
      {hasAdvice && (
        <div>
          <button
            type="button"
            onClick={() => setAdviceOpen(!adviceOpen)}
            className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2 text-sm"
          >
            <span>Wateradvies</span>
            {adviceOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {adviceOpen && (
            <div className="sv-inset mt-2 px-4 py-3 space-y-1.5 text-sm rounded-xl">
              {plant.water_notes && (
                <p>
                  <span className="sv-muted">Volle grond: </span>
                  {plant.water_notes}
                </p>
              )}
              {plant.pot_water_notes && (
                <p>
                  <span className="sv-muted">Pot: </span>
                  {plant.pot_water_notes}
                </p>
              )}
              {plant.watering_method.length > 0 && (
                <p>
                  <span className="sv-muted">Methode: </span>
                  {plant.watering_method.join(", ")}
                  {plant.watering_soak_minutes
                    ? ` (${plant.watering_soak_minutes} min. weken)`
                    : ""}
                </p>
              )}
              {plant.water_interval_days && (
                <p>
                  <span className="sv-muted">Interval volle grond: </span>
                  elke {plant.water_interval_days} dagen
                </p>
              )}
              {plant.pot_water_interval_days && (
                <p>
                  <span className="sv-muted">Interval pot: </span>
                  elke {plant.pot_water_interval_days} dagen
                </p>
              )}
              <p className="text-xs sv-muted italic border-t pt-2 mt-2">
                {inPot
                  ? "Geef water totdat er water uit de drainagegaten onder de pot begint te lopen. Geef liever één keer goed water dan meerdere kleine beetjes."
                  : "Geef minder vaak, maar wel royaal zodat het water diep in de bodem trekt. Hierdoor ontwikkelen planten diepere en sterkere wortels."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Watergeschiedenis */}
      <div>
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2 text-sm"
        >
          <span>
            Watergeschiedenis
            {waterHistory.length > 0 && (
              <span className="sv-muted ml-1">({waterHistory.length})</span>
            )}
          </span>
          {historyOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        {historyOpen && (
          <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
            {waterHistory.length === 0 ? (
              <p className="text-sm sv-muted text-center py-4">
                Nog geen watergiften geregistreerd.
              </p>
            ) : (
              waterHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="sv-inset px-3 py-2.5 rounded-xl space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs sv-muted font-medium">
                      {new Date(
                        entry.date + "T00:00:00",
                      ).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {confirmDeleteId === entry.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs sv-muted">Verwijderen?</span>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-xs sv-badge-overdue px-2 py-0.5 rounded-full"
                        >
                          Ja
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs sv-badge-ok px-2 py-0.5 rounded-full"
                        >
                          Nee
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditNote(
                              entry.notes === "Water gegeven" ? "" : entry.notes,
                            );
                          }}
                          className="sv-icon-slot h-6 w-6 flex items-center justify-center opacity-60 hover:opacity-100"
                          title="Notitie bewerken"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(entry.id)}
                          className="sv-icon-slot h-6 w-6 flex items-center justify-center opacity-60 hover:opacity-100"
                          title="Verwijderen"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {editingId === entry.id ? (
                    <div className="flex gap-1.5">
                      <Input
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Notitie..."
                        className="text-xs h-7"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveNote(entry.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button
                        onClick={() => handleSaveNote(entry.id)}
                        className="sv-button sv-button-thin-border px-2 py-1 text-xs shrink-0"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="sv-button sv-button-ghost px-2 py-1 text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    entry.notes &&
                    entry.notes !== "Water gegeven" && (
                      <p className="text-sm">{entry.notes}</p>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FeedingSection component ───────────────────────────────────────────────

function FeedingSection({
  plant,
  onRecordFeeding,
  onSyncLastFed,
  isUpdating,
  isRecording,
}: {
  plant: Plant;
  onRecordFeeding: (plant: Plant, note?: string) => void;
  onSyncLastFed: (isoDate: string | null) => void;
  isUpdating: boolean;
  isRecording: boolean;
}) {
  const { entries, updateEntry, deleteEntry } = useGrowthLog();

  const feedHistory = entries
    .filter(
      (e) =>
        e.fertilized &&
        (e.plant_id === plant.id || e.plant_name === plant.name),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastFedDateStr =
    feedHistory[0]?.date ?? plant.last_fed_at?.slice(0, 10) ?? null;

  const interval = plant.feeding_interval_days ?? null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastFedDate = lastFedDateStr
    ? new Date(lastFedDateStr + "T00:00:00")
    : null;

  const daysAgo =
    lastFedDate !== null
      ? Math.floor((today.getTime() - lastFedDate.getTime()) / 86_400_000)
      : null;

  const nextFeedDate =
    lastFedDate && interval
      ? new Date(lastFedDate.getTime() + interval * 86_400_000)
      : null;

  const daysLeft =
    nextFeedDate !== null
      ? Math.ceil((nextFeedDate.getTime() - today.getTime()) / 86_400_000)
      : null;

  const currentMonth = MONTH_OPTIONS[new Date().getMonth()];
  const outsideFeedingSeason =
    plant.feeding_months.length > 0 &&
    !plant.feeding_months.includes(currentMonth);

  const [quickNote, setQuickNote] = useState("");
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function recordFeeding(note: string) {
    onRecordFeeding(plant, note);
    setQuickNote("");
  }

  function handleDelete(id: string) {
    const remaining = entries
      .filter(
        (e) =>
          e.id !== id &&
          e.fertilized &&
          (e.plant_id === plant.id || e.plant_name === plant.name),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    deleteEntry(id);
    onSyncLastFed(remaining[0]?.date ?? null);
    setConfirmDeleteId(null);
  }

  function handleSaveNote(id: string) {
    updateEntry(id, { notes: editNote.trim() || "Voeding gegeven" });
    setEditingId(null);
  }

  function daysLeftBadge() {
    if (daysLeft === null || !interval) return null;
    if (daysLeft < 0)
      return {
        label: `${Math.abs(daysLeft)} dag${Math.abs(daysLeft) !== 1 ? "en" : ""} te laat`,
        overdue: true,
      };
    if (daysLeft === 0) return { label: "Vandaag voeding geven", overdue: true };
    if (daysLeft === 1) return { label: "Morgen voeding geven", overdue: false };
    return { label: `Over ${daysLeft} dagen`, overdue: false };
  }

  const badge = daysLeftBadge();

  const hasAdvice = !!(
    plant.feeding_notes ||
    plant.feeding_interval_days ||
    plant.feeding_months.length > 0
  );

  return (
    <div className="sv-panel p-4 space-y-4">
      <h3 className="sv-heading text-xl flex items-center gap-2">
        <Leaf className="h-4 w-4" /> Voeding geven
      </h3>

      {/* Huidige voedingsstatus */}
      <div className="space-y-2">
        {outsideFeedingSeason && (
          <p className="text-sm sv-muted italic">
            Deze plant hoeft normaal gesproken deze maand geen voeding te krijgen.
          </p>
        )}
        {!lastFedDate ? (
          <p className="text-sm sv-muted">Nog geen voedingsgift geregistreerd.</p>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <span className="sv-muted">Laatste voedingsgift</span>
            <span>
              {lastFedDate.toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
              })}
              {daysAgo !== null && (
                <span className="sv-muted ml-1.5">({daysAgoLabel(daysAgo)})</span>
              )}
            </span>
            {nextFeedDate && (
              <>
                <span className="sv-muted">Volgende voedingsgift</span>
                <span>
                  {nextFeedDate.toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </>
            )}
            {interval && (
              <>
                <span className="sv-muted">Voedingsinterval</span>
                <span>
                  elke {interval} dag{interval !== 1 ? "en" : ""}
                </span>
              </>
            )}
          </div>
        )}
        {!interval && (
          <p className="text-xs sv-muted">
            Geen vast voedingsinterval beschikbaar — geef alleen voeding wanneer de plant actief groeit.
          </p>
        )}
        {badge && (
          <span
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full sv-heading ${
              badge.overdue ? "sv-badge-overdue" : "sv-badge-ok"
            }`}
          >
            <Leaf className="h-3 w-3" /> {badge.label}
          </span>
        )}
      </div>

      {/* Snelle voedingsactie */}
      <div className="flex gap-2">
        <Input
          placeholder="Notitie (optioneel)..."
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
          className="text-sm"
          onKeyDown={(e) => e.key === "Enter" && recordFeeding(quickNote)}
        />
        <Button
          size="sm"
          className="sv-button shrink-0 gap-1.5"
          onClick={() => recordFeeding(quickNote)}
          disabled={isUpdating || isRecording}
        >
          {isRecording ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Leaf className="h-3.5 w-3.5" />
          )}{" "}
          Voeding gegeven
        </Button>
      </div>

      {/* Voedingsadvies */}
      {hasAdvice && (
        <div>
          <button
            type="button"
            onClick={() => setAdviceOpen(!adviceOpen)}
            className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2 text-sm"
          >
            <span>Voedingsadvies</span>
            {adviceOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {adviceOpen && (
            <div className="sv-inset mt-2 px-4 py-3 space-y-1.5 text-sm rounded-xl">
              {plant.feeding_notes && (
                <p>
                  <span className="sv-muted">Advies: </span>
                  {plant.feeding_notes}
                </p>
              )}
              {plant.feeding_interval_days && (
                <p>
                  <span className="sv-muted">Interval: </span>
                  elke {plant.feeding_interval_days} dagen
                </p>
              )}
              {plant.feeding_months.length > 0 && (
                <p>
                  <span className="sv-muted">Voedingsmaanden: </span>
                  {plant.feeding_months
                    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
                    .join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Voedingsgeschiedenis */}
      <div>
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2 text-sm"
        >
          <span>
            Voedingsgeschiedenis
            {feedHistory.length > 0 && (
              <span className="sv-muted ml-1">({feedHistory.length})</span>
            )}
          </span>
          {historyOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        {historyOpen && (
          <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
            {feedHistory.length === 0 ? (
              <p className="text-sm sv-muted text-center py-4">
                Nog geen voedingsgiften geregistreerd.
              </p>
            ) : (
              feedHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="sv-inset px-3 py-2.5 rounded-xl space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs sv-muted font-medium">
                      {new Date(entry.date + "T00:00:00").toLocaleDateString(
                        "nl-NL",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </p>
                    {confirmDeleteId === entry.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs sv-muted">Verwijderen?</span>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-xs sv-badge-overdue px-2 py-0.5 rounded-full"
                        >
                          Ja
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs sv-badge-ok px-2 py-0.5 rounded-full"
                        >
                          Nee
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditNote(
                              entry.notes === "Voeding gegeven" ? "" : entry.notes,
                            );
                          }}
                          className="sv-icon-slot h-6 w-6 flex items-center justify-center opacity-60 hover:opacity-100"
                          title="Notitie bewerken"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(entry.id)}
                          className="sv-icon-slot h-6 w-6 flex items-center justify-center opacity-60 hover:opacity-100"
                          title="Verwijderen"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {editingId === entry.id ? (
                    <div className="flex gap-1.5">
                      <Input
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Notitie..."
                        className="text-xs h-7"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveNote(entry.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button
                        onClick={() => handleSaveNote(entry.id)}
                        className="sv-button sv-button-thin-border px-2 py-1 text-xs shrink-0"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="sv-button sv-button-ghost px-2 py-1 text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    entry.notes &&
                    entry.notes !== "Voeding gegeven" && (
                      <p className="text-sm">{entry.notes}</p>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PlantLogboek component ─────────────────────────────────────────────────

function PlantLogboek({ plantName }: { plantName: string }) {
  const { addEntry, deleteEntry, getEntriesForPlant } = useGrowthLog();
  // Alleen groei-notities tonen; automatische water-/voedingsregistraties horen
  // al thuis in de Water-/Voedingsgeschiedenis en worden hier niet herhaald.
  const entries = getEntriesForPlant(plantName).filter((entry) => {
    const isDefaultActionNote =
      !entry.notes || entry.notes === "Water gegeven" || entry.notes === "Voeding gegeven";
    const isPureAction = entry.height_cm === null && isDefaultActionNote && (entry.watered || entry.fertilized);
    return !isPureAction;
  });

  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [watered, setWatered] = useState(false);
  const [fertilized, setFertilized] = useState(false);

  function resetForm() {
    setNotes("");
    setHeightCm("");
    setWatered(false);
    setFertilized(false);
    setDate(new Date().toISOString().slice(0, 10));
    setFormOpen(false);
  }

  function handleSave() {
    addEntry({
      plant_id: null,
      plant_name: plantName,
      date,
      notes,
      height_cm: heightCm ? Number(heightCm) : null,
      flower_count: null,
      fruit_count: null,
      watered,
      fertilized,
      photo_url: "",
    });
    resetForm();
  }

  return (
    <div className="sv-inset p-4 space-y-4 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-xs sv-muted">{entries.length === 0 ? "Nog geen notities" : `${entries.length} notitie${entries.length !== 1 ? "s" : ""}`}</p>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="sv-button sv-button-thin-border flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3 w-3" /> Notitie
          </button>
        )}
      </div>

      {formOpen && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs sv-muted block mb-1">Datum</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-xs sv-muted block mb-1">Hoogte (cm)</label>
              <Input
                type="number"
                placeholder="bijv. 45"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <Textarea
            placeholder="Notities..."
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm resize-none"
          />
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={watered} onChange={(e) => setWatered(e.target.checked)} />
              <span>💧 Water</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={fertilized} onChange={(e) => setFertilized(e.target.checked)} />
              <span>🌿 Bemest</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="sv-button" onClick={handleSave}>
              Opslaan
            </Button>
            <Button size="sm" className="sv-button sv-button-ghost" onClick={resetForm}>
              Annuleer
            </Button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div key={entry.id} className="sv-panel p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs sv-muted font-medium">
                  {new Date(entry.date).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="sv-icon-slot h-5 w-5 flex items-center justify-center shrink-0 opacity-60 hover:opacity-100"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              {entry.height_cm !== null && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="sv-badge-ok text-xs px-2 py-0.5 rounded-full">📏 {entry.height_cm} cm</span>
                </div>
              )}
              {entry.notes && <p className="text-sm">{entry.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HarvestLogSection component ───────────────────────────────────────────

function HarvestLogSection({
  plantId,
  logs,
  onAdd,
  onDelete,
  isSaving,
}: {
  plantId: string;
  logs: PlantHarvestLog[];
  onAdd: (row: {
    plant_id: string;
    harvested_at: string;
    weight_grams: number | null;
    quantity: number | null;
    unit: string | null;
    notes: string | null;
  }) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setWeight("");
    setQuantity("");
    setUnit("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setError(null);
    setFormOpen(false);
  }

  function handleSave() {
    setError(null);
    if (!weight.trim() && !quantity.trim() && !notes.trim()) {
      setError("Vul minimaal een gewicht, aantal of notitie in.");
      return;
    }
    if (Number(weight) < 0 || Number(quantity) < 0) {
      setError("Gewicht en aantal mogen niet negatief zijn.");
      return;
    }
    if (new Date(date).getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      setError("Datum ligt te ver in de toekomst.");
      return;
    }
    onAdd({
      plant_id: plantId,
      harvested_at: date,
      weight_grams: weight.trim() ? Number(weight) : null,
      quantity: quantity.trim() ? Number(quantity) : null,
      unit: unit.trim() || null,
      notes: notes.trim() || null,
    });
    resetForm();
  }

  const currentYear = new Date().getFullYear();
  const thisYearLogs = logs.filter(
    (l) => new Date(l.harvested_at).getFullYear() === currentYear,
  );
  const totalWeight = thisYearLogs.reduce((sum, l) => sum + (l.weight_grams ?? 0), 0);
  const totalsByUnit = new Map<string, number>();
  for (const l of thisYearLogs) {
    if (l.quantity !== null) {
      const key = l.unit || "stuks";
      totalsByUnit.set(key, (totalsByUnit.get(key) ?? 0) + l.quantity);
    }
  }

  return (
    <div className="sv-inset p-4 space-y-4 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-xs sv-muted">
          {logs.length === 0 ? "Nog geen oogst" : `${logs.length} oogst${logs.length !== 1 ? "en" : ""}`}
        </p>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="sv-button sv-button-thin-border flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3 w-3" /> Oogst
          </button>
        )}
      </div>

      {(totalWeight > 0 || totalsByUnit.size > 0) && (
        <p className="text-xs sv-muted">
          Totaal dit jaar:{" "}
          {sn(
            [
              totalWeight > 0 ? `${totalWeight} g` : null,
              ...Array.from(totalsByUnit.entries()).map(([unit, n]) => `${n} ${unit}`),
            ],
            [],
          )}
        </p>
      )}

      {formOpen && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs sv-muted block mb-1">Datum</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-xs sv-muted block mb-1">Gewicht (gram)</label>
              <Input type="number" min={0} step="0.1" placeholder="bijv. 350" value={weight} onChange={(e) => setWeight(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs sv-muted block mb-1">Aantal</label>
              <Input type="number" min={0} step="0.1" placeholder="bijv. 4" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-xs sv-muted block mb-1">Eenheid</label>
              <Input placeholder="bijv. courgettes, bos munt" value={unit} onChange={(e) => setUnit(e.target.value)} className="text-sm" />
            </div>
          </div>
          <Textarea placeholder="Notities..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm resize-none" />
          {error && <p className="text-xs sv-destructive-text">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" className="sv-button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
            </Button>
            <Button size="sm" className="sv-button sv-button-ghost" onClick={resetForm}>
              Annuleer
            </Button>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-none">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-2 text-sm border-t border-black/10 pt-2">
              <div>
                <p className="sv-muted text-xs">
                  {new Date(log.harvested_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <p>
                  {sn(
                    [
                      log.weight_grams ? `${log.weight_grams} g` : null,
                      log.quantity ? `${log.quantity} ${log.unit ?? "stuks"}` : null,
                    ],
                    [log.notes],
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(log.id)}
                className="sv-muted hover:sv-destructive-text shrink-0"
                aria-label="Verwijder oogst"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PruningLogSection component ───────────────────────────────────────────

function PruningLogSection({
  plantId,
  logs,
  onAdd,
  onDelete,
  isSaving,
}: {
  plantId: string;
  logs: PlantPruningLog[];
  onAdd: (row: {
    plant_id: string;
    pruned_at: string;
    pruning_type: string | null;
    notes: string | null;
  }) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setType("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setFormOpen(false);
  }

  function handleSave() {
    onAdd({
      plant_id: plantId,
      pruned_at: date,
      pruning_type: type || null,
      notes: notes.trim() || null,
    });
    resetForm();
  }

  return (
    <div className="sv-inset p-4 space-y-4 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-xs sv-muted">
          {logs.length === 0 ? "Nog niet gesnoeid" : `Laatst gesnoeid: ${new Date(logs[0].pruned_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`}
        </p>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="sv-button sv-button-thin-border flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3 w-3" /> Snoeien
          </button>
        )}
      </div>

      {formOpen && (
        <div className="space-y-3">
          <div>
            <label className="text-xs sv-muted block mb-1">Datum</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {PRUNING_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setType(type === opt ? "" : opt)}
                className={chipClass(type === opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <Textarea placeholder="Notities..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm resize-none" />
          <div className="flex gap-2">
            <Button size="sm" className="sv-button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
            </Button>
            <Button size="sm" className="sv-button sv-button-ghost" onClick={resetForm}>
              Annuleer
            </Button>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-none">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-2 text-sm border-t border-black/10 pt-2">
              <div>
                <p className="sv-muted text-xs">
                  {new Date(log.pruned_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                  {log.pruning_type ? ` · ${log.pruning_type}` : ""}
                </p>
                {log.notes && <p className="text-sm">{log.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => onDelete(log.id)}
                className="sv-muted hover:sv-destructive-text shrink-0"
                aria-label="Verwijder snoeimoment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RepotLogSection component ─────────────────────────────────────────────

function RepotLogSection({
  plant,
  logs,
  onAdd,
  onDelete,
  isSaving,
}: {
  plant: Plant;
  logs: PlantRepotLog[];
  onAdd: (row: {
    plant_id: string;
    repotted_at: string;
    old_pot_size_liters: number | null;
    new_pot_size_liters: number | null;
    pot_material: string | null;
    soil_type: string | null;
    notes: string | null;
  }) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newSize, setNewSize] = useState("");
  const [material, setMaterial] = useState("");
  const [soil, setSoil] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setNewSize("");
    setMaterial("");
    setSoil("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setFormOpen(false);
  }

  function handleSave() {
    onAdd({
      plant_id: plant.id,
      repotted_at: date,
      old_pot_size_liters: plant.pot_size_liters,
      new_pot_size_liters: newSize.trim() ? Number(newSize) : null,
      pot_material: material || null,
      soil_type: soil.trim() || null,
      notes: notes.trim() || null,
    });
    resetForm();
  }

  return (
    <div className="sv-inset p-4 space-y-4 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-xs sv-muted">
          {plant.last_repotted_at
            ? `Laatst verpot: ${new Date(plant.last_repotted_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}${plantAge(plant.last_repotted_at) ? ` (${plantAge(plant.last_repotted_at)} geleden)` : ""}`
            : "Nog niet verpot"}
        </p>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="sv-button sv-button-thin-border flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3 w-3" /> Verpotten
          </button>
        )}
      </div>

      {formOpen && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs sv-muted block mb-1">Datum</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-xs sv-muted block mb-1">
                Nieuwe potgrootte (L){plant.pot_size_liters ? ` — was ${plant.pot_size_liters} L` : ""}
              </label>
              <Input type="number" min={1} placeholder="bijv. 25" value={newSize} onChange={(e) => setNewSize(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {POT_MATERIAL_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setMaterial(material === opt ? "" : opt)}
                className={chipClass(material === opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <Input placeholder="Nieuwe grondsoort (optioneel)" value={soil} onChange={(e) => setSoil(e.target.value)} className="text-sm" />
          <Textarea placeholder="Notities..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm resize-none" />
          <div className="flex gap-2">
            <Button size="sm" className="sv-button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
            </Button>
            <Button size="sm" className="sv-button sv-button-ghost" onClick={resetForm}>
              Annuleer
            </Button>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-none">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-2 text-sm border-t border-black/10 pt-2">
              <div>
                <p className="sv-muted text-xs">
                  {new Date(log.repotted_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <p>
                  {sn(
                    [
                      log.old_pot_size_liters || log.new_pot_size_liters
                        ? `${log.old_pot_size_liters ?? "?"} L → ${log.new_pot_size_liters ?? "?"} L`
                        : null,
                      log.pot_material,
                      log.soil_type,
                    ],
                    [log.notes],
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(log.id)}
                className="sv-muted hover:sv-destructive-text shrink-0"
                aria-label="Verwijder verpotmoment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TimelineSection component ─────────────────────────────────────────────
// Merges existing history sources (growth log, photos) with the new log
// tables into one read-only chronological view. No new storage — every
// item is derived from data that already lives somewhere else.

type TimelineItem = { date: string; icon: typeof Droplet; label: string };

function TimelineSection({
  plant,
  photos,
  harvestLogs,
  pruningLogs,
  repotLogs,
}: {
  plant: Plant;
  photos: PlantPhoto[];
  harvestLogs: PlantHarvestLog[];
  pruningLogs: PlantPruningLog[];
  repotLogs: PlantRepotLog[];
}) {
  const { getEntriesForPlant } = useGrowthLog();
  const growthEntries: LogEntry[] = getEntriesForPlant(plant.name);

  const items: TimelineItem[] = [];

  if (plant.acquired_at) {
    items.push({ date: plant.acquired_at, icon: MapPin, label: sn([plant.source ? `Verkregen — ${plant.source}` : "Verkregen"], []) ?? "Verkregen" });
  }
  if (plant.planted_at) {
    items.push({ date: plant.planted_at, icon: Sprout, label: "Geplant / gezaaid" });
  }
  for (const photo of photos) {
    items.push({ date: photo.taken_at, icon: ImageIcon, label: photo.note ? `Foto toegevoegd — ${photo.note}` : "Foto toegevoegd" });
  }
  for (const log of harvestLogs) {
    items.push({
      date: log.harvested_at,
      icon: Apple,
      label: `Oogst — ${sn([log.weight_grams ? `${log.weight_grams} g` : null, log.quantity ? `${log.quantity} ${log.unit ?? "stuks"}` : null], []) ?? "geregistreerd"}`,
    });
  }
  for (const log of pruningLogs) {
    items.push({ date: log.pruned_at, icon: Scissors, label: log.pruning_type ? `Gesnoeid — ${log.pruning_type}` : "Gesnoeid" });
  }
  for (const log of repotLogs) {
    items.push({ date: log.repotted_at, icon: Boxes, label: "Verpot" });
  }
  for (const entry of growthEntries) {
    if (entry.watered) items.push({ date: entry.date, icon: Droplet, label: "Water gegeven" });
    if (entry.fertilized) items.push({ date: entry.date, icon: Leaf, label: "Voeding gegeven" });
    if (entry.height_cm) items.push({ date: entry.date, icon: Ruler, label: `Hoogte bijgewerkt naar ${entry.height_cm} cm` });
    if (entry.notes && !entry.watered && !entry.fertilized && !entry.height_cm) {
      items.push({ date: entry.date, icon: BookOpen, label: entry.notes });
    }
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) {
    return <p className="text-sm sv-muted px-1">Nog geen gebeurtenissen vastgelegd.</p>;
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-none">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={i} className="flex items-start gap-2 text-sm">
            <Icon className="h-4 w-4 shrink-0 mt-0.5 sv-muted" />
            <div>
              <p className="sv-muted text-xs">
                {new Date(item.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p>{item.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Tuinieren() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { addEntryAsync } = useGrowthLog();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlantDraft>(emptyDraft);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recordingWaterId, setRecordingWaterId] = useState<string | null>(null);
  const [recordingFeedId, setRecordingFeedId] = useState<string | null>(null);

  const [view, setView] = useState<Plant | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<PlantDraft>(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoUrlDraft, setPhotoUrlDraft] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [pruningOpen, setPruningOpen] = useState(false);
  const [repotOpen, setRepotOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!importMsg) return;
    const t = setTimeout(() => setImportMsg(null), 5000);
    return () => clearTimeout(t);
  }, [importMsg]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : [data];
      let imported = 0;
      const errors: string[] = [];
      for (const p of list) {
        if (!p.name?.trim()) { errors.push("plant zonder naam overgeslagen"); continue; }
        const row = {
          name: p.name.trim(),
          category: p.category || null,
          species: p.species || null,
          fun_fact: p.fun_fact || null,
          location: p.location || null,
          lifecycle: p.lifecycle || null,
          size_cm: p.size_cm ? Number(p.size_cm) : null,
          spacing_cm: p.spacing_cm ? Number(p.spacing_cm) : null,
          growth_habit: p.growth_habit ?? [],
          sun_needs: Array.isArray(p.sun_needs) ? p.sun_needs.join(",") : p.sun_needs || null,
          season_notes: p.season_notes || null,
          water_notes: p.water_notes || null,
          watering_method: p.watering_method ?? [],
          watering_soak_minutes: p.watering_soak_minutes ? Number(p.watering_soak_minutes) : null,
          growing_method: p.growing_method || null,
          pot_min_liters: p.pot_min_liters ? Number(p.pot_min_liters) : null,
          pot_recommended_liters: p.pot_recommended_liters ? Number(p.pot_recommended_liters) : null,
          pot_water_notes: p.pot_water_notes || null,
          planted: p.planted ?? false,
          planted_at: p.planted_at ? new Date(p.planted_at).toISOString() : null,
          health_status: p.health_status || null,
          pot_size_liters: p.pot_size_liters ? Number(p.pot_size_liters) : null,
          pot_material: p.pot_material || null,
          pot_color: p.pot_color || null,
          soil_type: p.soil_type || null,
          soil_mix_notes: p.soil_mix_notes || null,
          last_repotted_at: p.last_repotted_at || null,
          acquired_at: p.acquired_at || null,
          source: p.source || null,
          price: p.price ? Number(p.price) : null,
          water_interval_days: p.water_interval_days ? Number(p.water_interval_days) : null,
          pot_water_interval_days: p.pot_water_interval_days ? Number(p.pot_water_interval_days) : null,
          last_watered_at: p.last_watered_at ? new Date(p.last_watered_at).toISOString() : null,
          reminders_enabled: p.reminders_enabled ?? true,
          greenhouse_notes: [p.greenhouse_pref, p.greenhouse_notes].filter(Boolean).join("\n") || null,
          feeding_notes: p.feeding_notes || null,
          feeding_interval_days: p.feeding_interval_days ? Number(p.feeding_interval_days) : null,
          last_fed_at: p.last_fed_at ? new Date(p.last_fed_at).toISOString() : null,
          feeding_reminders_enabled: p.feeding_reminders_enabled ?? true,
          feeding_months: p.feeding_months ?? [],
          soil_notes: p.soil_notes || null,
          soil_ph_min: p.soil_ph_min ? Number(p.soil_ph_min) : null,
          soil_ph_max: p.soil_ph_max ? Number(p.soil_ph_max) : null,
          temperature_notes: p.temperature_notes || null,
          humidity_notes: p.humidity_notes || null,
          winter_hardiness: p.winter_hardiness || null,
          winter_notes: p.winter_notes || null,
          pruning_notes: p.pruning_notes || null,
          pest_notes: p.pest_notes || null,
          toxic_to_humans: p.toxic_to_humans ?? false,
          toxic_to_cats: p.toxic_to_cats ?? false,
          toxicity_notes: p.toxicity_notes || null,
          sow_months: p.sow_months ?? [],
          sow_week: p.sow_week || null,
          sow_notes: p.sow_notes || null,
          bloom_months: p.bloom_months ?? [],
          bloom_week: p.bloom_week || null,
          bloom_notes: p.bloom_notes || null,
          propagation_methods: p.propagation_methods ?? [],
          propagation_notes: p.propagation_notes || null,
          harvest_months: p.harvest_months ?? [],
          harvest_week: p.harvest_week || null,
          harvest_notes: p.harvest_notes || null,
          general_notes: p.general_notes || null,
          photo_url: p.photo_url || null,
          created_by: session?.user.id,
        };
        const { error } = await supabase.from("plants").insert(row);
        if (error) errors.push(`${row.name}: ${error.message}`);
        else imported++;
      }
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      setImportMsg(errors.length > 0
        ? `${imported} toegevoegd, ${errors.length} fout(en): ${errors.join(" · ")}`
        : `${imported} plant${imported === 1 ? "" : "en"} toegevoegd!`);
    } catch {
      setImportMsg("Ongeldig JSON-bestand.");
    }
    e.target.value = "";
  }

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["plants"],
    queryFn: fetchPlants,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["plant_photos", view?.id],
    queryFn: () => fetchPhotos(view!.id),
    enabled: !!view,
  });

  const { data: harvestLogs = [] } = useQuery({
    queryKey: ["plant_harvest_logs", view?.id],
    queryFn: () => fetchHarvestLogs(view!.id),
    enabled: !!view,
  });

  const { data: pruningLogs = [] } = useQuery({
    queryKey: ["plant_pruning_logs", view?.id],
    queryFn: () => fetchPruningLogs(view!.id),
    enabled: !!view,
  });

  const { data: repotLogs = [] } = useQuery({
    queryKey: ["plant_repot_logs", view?.id],
    queryFn: () => fetchRepotLogs(view!.id),
    enabled: !!view,
  });

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) {
      setDraft(emptyDraft);
      setSaveError(null);
    }
  }

  const addPlant = useMutation({
    mutationFn: async (d: PlantDraft) => {
      const { error } = await supabase
        .from("plants")
        .insert({ ...draftToRow(d), created_by: session?.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      handleOpenChange(false);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const updatePlant = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("plants")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { patch }) => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      setView((prev) => (prev ? ({ ...prev, ...patch } as Plant) : null));
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const deletePlant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      setView(null);
    },
  });

  const addPhoto = useMutation({
    mutationFn: async ({ plantId, url }: { plantId: string; url: string }) => {
      const { error } = await supabase
        .from("plant_photos")
        .insert({ plant_id: plantId, photo_url: url });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plant_photos", view?.id] });
      setPhotoUrlDraft("");
    },
  });

  const removePhoto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plant_photos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plant_photos", view?.id] }),
  });

  const addHarvestLog = useMutation({
    mutationFn: async (row: {
      plant_id: string;
      harvested_at: string;
      weight_grams: number | null;
      quantity: number | null;
      unit: string | null;
      notes: string | null;
    }) => {
      const { error } = await supabase.from("plant_harvest_logs").insert(row);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plant_harvest_logs", view?.id] }),
  });

  const deleteHarvestLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plant_harvest_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plant_harvest_logs", view?.id] }),
  });

  const addPruningLog = useMutation({
    mutationFn: async (row: {
      plant_id: string;
      pruned_at: string;
      pruning_type: string | null;
      notes: string | null;
    }) => {
      const { error } = await supabase.from("plant_pruning_logs").insert(row);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plant_pruning_logs", view?.id] }),
  });

  const deletePruningLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plant_pruning_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plant_pruning_logs", view?.id] }),
  });

  const addRepotLog = useMutation({
    mutationFn: async (row: {
      plant_id: string;
      repotted_at: string;
      old_pot_size_liters: number | null;
      new_pot_size_liters: number | null;
      pot_material: string | null;
      soil_type: string | null;
      notes: string | null;
    }) => {
      const { error } = await supabase.from("plant_repot_logs").insert(row);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["plant_repot_logs", view?.id] });
      const patch: Record<string, unknown> = { last_repotted_at: row.repotted_at };
      if (row.new_pot_size_liters !== null) patch.pot_size_liters = row.new_pot_size_liters;
      if (row.pot_material !== null) patch.pot_material = row.pot_material;
      if (row.soil_type !== null) patch.soil_type = row.soil_type;
      updatePlant.mutate({ id: row.plant_id, patch });
    },
  });

  const deleteRepotLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plant_repot_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plant_repot_logs", view?.id] }),
  });

  function startEdit() {
    if (!view) return;
    setEditDraft(plantToDraft(view));
    setSaveError(null);
    setEditMode(true);
  }

  function handleSaveEdit() {
    if (!view || !editDraft.name.trim()) return;
    updatePlant.mutate(
      { id: view.id, patch: draftToRow(editDraft) },
      { onSuccess: () => setEditMode(false) },
    );
  }

  function handleSyncLastWatered(isoDate: string | null) {
    if (!view) return;
    updatePlant.mutate({
      id: view.id,
      patch: {
        last_watered_at: isoDate ? new Date(isoDate).toISOString() : null,
        last_water_reminder_sent_at: null,
        water_skip_until: null,
      },
    });
  }

  function handleSkipWaterToday() {
    if (!view) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updatePlant.mutate({
      id: view.id,
      patch: { water_skip_until: tomorrow.toISOString().slice(0, 10) },
    });
  }

  // Single source of truth for "water given": always writes one growth-log
  // entry AND syncs plants.last_watered_at, in that order, so the plant is
  // never marked watered without a matching log entry. Used by both the
  // detail-view water button and the quick-water badge on the tile.
  async function recordWatering(plant: Plant, note?: string) {
    if (recordingWaterId === plant.id) return;
    setRecordingWaterId(plant.id);
    setSaveError(null);
    try {
      await addEntryAsync({
        plant_id: plant.id,
        plant_name: plant.name,
        date: new Date().toISOString().slice(0, 10),
        notes: note?.trim() || "Water gegeven",
        height_cm: null,
        flower_count: null,
        fruit_count: null,
        watered: true,
        fertilized: false,
        photo_url: "",
      });
      await updatePlant.mutateAsync({
        id: plant.id,
        patch: {
          last_watered_at: new Date().toISOString(),
          last_water_reminder_sent_at: null,
          water_skip_until: null,
        },
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Waterregistratie mislukt.",
      );
    } finally {
      setRecordingWaterId(null);
    }
  }

  function handleSyncLastFed(isoDate: string | null) {
    if (!view) return;
    updatePlant.mutate({
      id: view.id,
      patch: {
        last_fed_at: isoDate ? new Date(isoDate).toISOString() : null,
        last_feeding_reminder_sent_at: null,
      },
    });
  }

  // Single source of truth for "feeding given" — mirrors recordWatering.
  async function recordFeeding(plant: Plant, note?: string) {
    if (recordingFeedId === plant.id) return;
    setRecordingFeedId(plant.id);
    setSaveError(null);
    try {
      await addEntryAsync({
        plant_id: plant.id,
        plant_name: plant.name,
        date: new Date().toISOString().slice(0, 10),
        notes: note?.trim() || "Voeding gegeven",
        height_cm: null,
        flower_count: null,
        fruit_count: null,
        watered: false,
        fertilized: true,
        photo_url: "",
      });
      await updatePlant.mutateAsync({
        id: plant.id,
        patch: {
          last_fed_at: new Date().toISOString(),
          last_feeding_reminder_sent_at: null,
        },
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Voedingsregistratie mislukt.",
      );
    } finally {
      setRecordingFeedId(null);
    }
  }

  function markChecked() {
    if (!view) return;
    updatePlant.mutate({
      id: view.id,
      patch: { last_checked_at: new Date().toISOString().slice(0, 10) },
    });
  }

  type FilterState = {
    category: string[];
    sun_needs: string[];
    greenhouse_pref: string[];
    lifecycle: string[];
    winter_hardiness: string[];
    toxic: string[];
    health_status: string[];
    planted: "all" | "planted" | "not_planted";
    sow_months: string[];
    bloom_months: string[];
    harvest_months: string[];
    feeding_months: string[];
    water: "all" | "overdue" | "soon";
    feeding: "all" | "overdue" | "soon";
    sort: "naam" | "water" | "categorie";
  };

  const initialFilters: FilterState = {
    category: [],
    sun_needs: [],
    greenhouse_pref: [],
    lifecycle: [],
    winter_hardiness: [],
    toxic: [],
    health_status: [],
    planted: "all",
    sow_months: [],
    bloom_months: [],
    harvest_months: [],
    feeding_months: [],
    water: "all",
    feeding: "all",
    sort: "naam",
  };

  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  function patchFilter(patch: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function daysLeftForSort(p: Plant): number {
    const intervalDays = effectiveWaterIntervalDays(p);
    if (!p.planted || !intervalDays) return 9999;
    if (!p.last_watered_at) return -9999;
    const dueAt =
      new Date(p.last_watered_at).getTime() + intervalDays * 24 * 60 * 60 * 1000;
    return Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
  }

  function daysLeftForFeedingSort(p: Plant): number {
    if (!p.planted || !p.feeding_interval_days) return 9999;
    if (!p.last_fed_at) return -9999;
    const dueAt =
      new Date(p.last_fed_at).getTime() +
      p.feeding_interval_days * 24 * 60 * 60 * 1000;
    return Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
  }

  const filteredPlants = useMemo(() => {
    let result = plants;

    if (filters.category.length > 0) {
      result = result.filter((p) => p.category && filters.category.includes(p.category));
    }

    if (filters.sun_needs.length > 0) {
      result = result.filter((p) => {
        if (!p.sun_needs) return false;
        const plantSun = p.sun_needs.split(",");
        return filters.sun_needs.some((f) => plantSun.includes(f));
      });
    }

    if (filters.greenhouse_pref.length > 0) {
      result = result.filter((p) => {
        const pref = parseGreenhouseNotes(p.greenhouse_notes).pref;
        return filters.greenhouse_pref.includes(pref);
      });
    }

    if (filters.lifecycle.length > 0) {
      result = result.filter((p) => p.lifecycle && filters.lifecycle.includes(p.lifecycle));
    }

    if (filters.winter_hardiness.length > 0) {
      result = result.filter((p) => p.winter_hardiness && filters.winter_hardiness.includes(p.winter_hardiness));
    }

    if (filters.toxic.length > 0) {
      result = result.filter((p) => {
        if (filters.toxic.includes("Mens") && !p.toxic_to_humans) return false;
        if (filters.toxic.includes("Kat") && !p.toxic_to_cats) return false;
        return true;
      });
    }

    if (filters.health_status.length > 0) {
      result = result.filter(
        (p) => p.health_status && filters.health_status.includes(p.health_status),
      );
    }

    if (filters.planted !== "all") {
      result = result.filter((p) =>
        filters.planted === "planted" ? p.planted : !p.planted,
      );
    }

    if (filters.sow_months.length > 0) {
      result = result.filter((p) =>
        filters.sow_months.some((m) => p.sow_months.includes(m)),
      );
    }

    if (filters.bloom_months.length > 0) {
      result = result.filter((p) =>
        filters.bloom_months.some((m) => p.bloom_months.includes(m)),
      );
    }

    if (filters.harvest_months.length > 0) {
      result = result.filter((p) =>
        filters.harvest_months.some((m) => p.harvest_months.includes(m)),
      );
    }

    if (filters.feeding_months.length > 0) {
      result = result.filter((p) =>
        filters.feeding_months.some((m) => p.feeding_months.includes(m)),
      );
    }

    if (filters.water === "overdue") {
      result = result.filter((p) => waterStatus(p)?.overdue);
    } else if (filters.water === "soon") {
      result = result.filter((p) => {
        const days = daysLeftForSort(p);
        return days <= 3 && days > 0;
      });
    }

    if (filters.feeding === "overdue") {
      result = result.filter((p) => feedingStatus(p)?.overdue);
    } else if (filters.feeding === "soon") {
      result = result.filter((p) => {
        const days = daysLeftForFeedingSort(p);
        return days <= 3 && days > 0;
      });
    }

    if (filters.sort === "water") {
      result = [...result].sort((a, b) => daysLeftForSort(a) - daysLeftForSort(b));
    } else if (filters.sort === "categorie") {
      result = [...result].sort((a, b) => {
        const ai = PLANT_CATEGORY_OPTIONS.indexOf(a.category as (typeof PLANT_CATEGORY_OPTIONS)[number]);
        const bi = PLANT_CATEGORY_OPTIONS.indexOf(b.category as (typeof PLANT_CATEGORY_OPTIONS)[number]);
        const aIdx = ai === -1 ? 999 : ai;
        const bIdx = bi === -1 ? 999 : bi;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.name.localeCompare(b.name, "nl");
      });
    } else {
      result = [...result].sort((a, b) => {
        const aUrgent = waterStatus(a)?.overdue || feedingStatus(a)?.overdue ? 0 : 1;
        const bUrgent = waterStatus(b)?.overdue || feedingStatus(b)?.overdue ? 0 : 1;
        if (aUrgent !== bUrgent) return aUrgent - bUrgent;
        return a.name.localeCompare(b.name, "nl");
      });
    }

    return result;
  }, [plants, filters]);

  const groupedPlants = useMemo(() => {
    if (filters.sort !== "categorie") return null;
    const groups: { label: string; plants: Plant[] }[] = [];
    for (const cat of PLANT_CATEGORY_OPTIONS) {
      const ps = filteredPlants.filter((p) => p.category === cat);
      if (ps.length > 0) groups.push({ label: cat, plants: ps });
    }
    const other = filteredPlants.filter(
      (p) => !p.category || !PLANT_CATEGORY_OPTIONS.includes(p.category as (typeof PLANT_CATEGORY_OPTIONS)[number]),
    );
    if (other.length > 0) groups.push({ label: "Overig", plants: other });
    return groups;
  }, [filteredPlants, filters.sort]);

  const activeFilterCount =
    filters.category.length +
    filters.sun_needs.length +
    filters.greenhouse_pref.length +
    filters.lifecycle.length +
    filters.winter_hardiness.length +
    filters.toxic.length +
    filters.health_status.length +
    (filters.planted !== "all" ? 1 : 0) +
    filters.sow_months.length +
    filters.bloom_months.length +
    filters.harvest_months.length +
    filters.feeding_months.length +
    (filters.water !== "all" ? 1 : 0) +
    (filters.feeding !== "all" ? 1 : 0) +
    (filters.sort !== "naam" ? 1 : 0);

  function handleExport() {
    const data = plants.map((p) => ({
      name: p.name,
      category: p.category,
      species: p.species,
      fun_fact: p.fun_fact,
      location: p.location,
      lifecycle: p.lifecycle,
      size_cm: p.size_cm,
      spacing_cm: p.spacing_cm,
      growth_habit: p.growth_habit,
      sun_needs: p.sun_needs ? p.sun_needs.split(",") : [],
      season_notes: p.season_notes,
      water_notes: p.water_notes,
      watering_method: p.watering_method,
      watering_soak_minutes: p.watering_soak_minutes,
      growing_method: p.growing_method,
      pot_min_liters: p.pot_min_liters,
      pot_recommended_liters: p.pot_recommended_liters,
      pot_water_notes: p.pot_water_notes,
      water_interval_days: p.water_interval_days,
      pot_water_interval_days: p.pot_water_interval_days,
      greenhouse_pref: parseGreenhouseNotes(p.greenhouse_notes).pref || null,
      greenhouse_notes: parseGreenhouseNotes(p.greenhouse_notes).notes || null,
      feeding_notes: p.feeding_notes,
      feeding_interval_days: p.feeding_interval_days,
      feeding_months: p.feeding_months,
      soil_notes: p.soil_notes,
      soil_ph_min: p.soil_ph_min,
      soil_ph_max: p.soil_ph_max,
      temperature_notes: p.temperature_notes,
      winter_hardiness: p.winter_hardiness,
      winter_notes: p.winter_notes,
      pruning_notes: p.pruning_notes,
      pest_notes: p.pest_notes,
      toxic_to_humans: p.toxic_to_humans,
      toxic_to_cats: p.toxic_to_cats,
      toxicity_notes: p.toxicity_notes,
      sow_months: p.sow_months,
      sow_week: p.sow_week,
      sow_notes: p.sow_notes,
      bloom_months: p.bloom_months,
      bloom_week: p.bloom_week,
      bloom_notes: p.bloom_notes,
      propagation_methods: p.propagation_methods,
      propagation_notes: p.propagation_notes,
      harvest_months: p.harvest_months,
      harvest_week: p.harvest_week,
      harvest_notes: p.harvest_notes,
      general_notes: p.general_notes,
      photo_url: p.photo_url,
      planted: p.planted,
      planted_at: p.planted_at,
      health_status: p.health_status,
      pot_size_liters: p.pot_size_liters,
      pot_material: p.pot_material,
      pot_color: p.pot_color,
      soil_type: p.soil_type,
      soil_mix_notes: p.soil_mix_notes,
      last_repotted_at: p.last_repotted_at,
      acquired_at: p.acquired_at,
      source: p.source,
      price: p.price,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planten-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tuinieren-theme space-y-8">
      <header className="flex flex-wrap items-center justify-center gap-2">
        <Button
          className="sv-button text-2xl h-11 px-3 sm:px-6"
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Zoeken</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 text-xs sv-badge-ok rounded-full px-1.5 py-0.5">
              {activeFilterCount}
            </span>
          )}
        </Button>

        <Link to="/tuingids">
          <Button className="sv-button text-2xl h-11 px-3 sm:px-6">
            <Lightbulb className="h-4 w-4" /><span className="hidden sm:inline">Tuingids</span>
          </Button>
        </Link>
        <Button
          className="sv-button text-2xl h-11 px-3 sm:px-6"
          onClick={handleExport}
          disabled={plants.length === 0}
        >
          <Download className="h-4 w-4" /><span className="hidden sm:inline">Exporteer</span>
        </Button>
        <Button
          className="sv-button text-2xl h-11 px-3 sm:px-6"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" /><span className="hidden sm:inline">Importeer</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="sv-button text-2xl h-11 px-3 sm:px-6">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Nieuwe plant</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="tuinieren-theme sv-dialog max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="sv-heading text-3xl">
                Nieuwe plant
              </DialogTitle>
            </DialogHeader>
            <PlantForm
              draft={draft}
              onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            />
            {saveError && (
              <p className="text-sm sv-destructive-text">{saveError}</p>
            )}
            <DialogFooter>
              <Button
                onClick={() => addPlant.mutate(draft)}
                disabled={!draft.name.trim() || addPlant.isPending}
                className="sv-button text-xl"
              >
                {addPlant.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Opslaan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {importMsg && (
        <p className="text-sm sv-muted text-right -mt-4">{importMsg}</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12 sv-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : plants.length === 0 ? (
        <div className="sv-panel p-12 text-center">
          <Sprout className="h-10 w-10 mx-auto" strokeWidth={1.4} />
          <p className="sv-heading text-2xl mt-4">Nog geen planten</p>
          <p className="text-sm sv-muted mt-1">
            Voeg je eerste plant toe om bij te houden.
          </p>
        </div>
      ) : groupedPlants ? (
        <div className="space-y-6">
          {groupedPlants.map((group) => (
            <div key={group.label} className="space-y-3">
              <p className="sv-heading text-2xl">{group.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {group.plants.map((p) => <PlantCard key={p.id} p={p} onOpen={setView} onWater={(p) => recordWatering(p)} onFeed={(p) => recordFeeding(p)} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredPlants.map((p) => <PlantCard key={p.id} p={p} onOpen={setView} onWater={(p) => recordWatering(p)} onFeed={(p) => recordFeeding(p)} />)}
        </div>
      )}

      <SeasonalOverview plants={plants} />

      <Dialog
        open={!!view}
        onOpenChange={(o) => {
          if (!o) {
            setView(null);
            setConfirmDelete(false);
            setEditMode(false);
            setLogOpen(false);
          }
        }}
      >
        <DialogContent className="tuinieren-theme sv-dialog w-full max-w-2xl max-h-[90vh]">
          {view && editMode ? (
            <>
              <DialogHeader>
                <DialogTitle className="sv-heading text-3xl">
                  Plant bewerken
                </DialogTitle>
              </DialogHeader>
              <PlantForm
                draft={editDraft}
                onChange={(patch) =>
                  setEditDraft((prev) => ({ ...prev, ...patch }))
                }
              />
              {saveError && (
                <p className="text-sm sv-destructive-text">{saveError}</p>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  className="sv-button sv-button-ghost"
                  onClick={() => {
                    setEditMode(false);
                    setSaveError(null);
                  }}
                >
                  Annuleer
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={!editDraft.name.trim() || updatePlant.isPending}
                  className="sv-button text-xl"
                >
                  {updatePlant.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Opslaan"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : view ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {view.photo_url ? (
                    <img
                      src={view.photo_url}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover shrink-0 sv-icon-slot"
                    />
                  ) : (
                    <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
                      <Sprout className="h-5 w-5" strokeWidth={1.6} />
                    </div>
                  )}
                  <DialogTitle className="sv-heading text-3xl sm:text-4xl leading-snug">
                    {view.name}
                  </DialogTitle>
                  {view.health_status && (
                    <span className="sv-heading inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full sv-badge-ok shrink-0">
                      {HEALTH_STATUS_EMOJI[view.health_status]} {view.health_status}
                    </span>
                  )}
                </div>
              </DialogHeader>

              {view.fun_fact && (
                <p className="text-sm italic sv-inset px-4 py-3">
                  {view.fun_fact}
                </p>
              )}

              {/* Action row */}
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="sv-button sv-button-thin-border text-xl"
                  onClick={() =>
                    updatePlant.mutate({
                      id: view.id,
                      patch: { planted: !view.planted },
                    })
                  }
                  disabled={updatePlant.isPending}
                >
                  <Sprout className="h-3.5 w-3.5" />{" "}
                  {view.planted ? "Gepland" : "Markeer als gepland"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="sv-button sv-button-thin-border text-xl"
                  onClick={markChecked}
                  disabled={updatePlant.isPending}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />{" "}
                  {checkedLabel(view.last_checked_at) ?? "Plant gecontroleerd"}
                </Button>
              </div>

              {/* Water sectie */}
              <WaterSection
                plant={view}
                onRecordWatering={recordWatering}
                onSyncLastWatered={handleSyncLastWatered}
                onSkipToday={handleSkipWaterToday}
                isUpdating={updatePlant.isPending}
                isRecording={recordingWaterId === view.id}
              />

              {/* Voeding sectie */}
              <FeedingSection
                plant={view}
                onRecordFeeding={recordFeeding}
                onSyncLastFed={handleSyncLastFed}
                isUpdating={updatePlant.isPending}
                isRecording={recordingFeedId === view.id}
              />

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setLogOpen((o) => !o)}
                  className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Groeilogboek
                  </span>
                  {logOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {logOpen && view && <PlantLogboek plantName={view.name} />}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setHarvestOpen((o) => !o)}
                  className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Apple className="h-4 w-4" />
                    Oogst
                  </span>
                  {harvestOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {harvestOpen && view && (
                  <HarvestLogSection
                    plantId={view.id}
                    logs={harvestLogs}
                    onAdd={(row) => addHarvestLog.mutate(row)}
                    onDelete={(id) => deleteHarvestLog.mutate(id)}
                    isSaving={addHarvestLog.isPending}
                  />
                )}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPruningOpen((o) => !o)}
                  className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Scissors className="h-4 w-4" />
                    Snoeien
                  </span>
                  {pruningOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {pruningOpen && view && (
                  <PruningLogSection
                    plantId={view.id}
                    logs={pruningLogs}
                    onAdd={(row) => addPruningLog.mutate(row)}
                    onDelete={(id) => deletePruningLog.mutate(id)}
                    isSaving={addPruningLog.isPending}
                  />
                )}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setRepotOpen((o) => !o)}
                  className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Boxes className="h-4 w-4" />
                    Verpotten
                  </span>
                  {repotOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {repotOpen && view && (
                  <RepotLogSection
                    plant={view}
                    logs={repotLogs}
                    onAdd={(row) => addRepotLog.mutate(row)}
                    onDelete={(id) => deleteRepotLog.mutate(id)}
                    isSaving={addRepotLog.isPending}
                  />
                )}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setTimelineOpen((o) => !o)}
                  className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Tijdlijn
                  </span>
                  {timelineOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {timelineOpen && view && (
                  <div className="sv-inset p-4 rounded-xl">
                    <TimelineSection
                      plant={view}
                      photos={photos}
                      harvestLogs={harvestLogs}
                      pruningLogs={pruningLogs}
                      repotLogs={repotLogs}
                    />
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <InfoRow label="Soort" value={view.species} />
                <InfoRow label="Levensduur" value={view.lifecycle} />
                <InfoRow
                  label="Geplant / gezaaid"
                  value={view.planted_at ? sn(
                    [new Date(view.planted_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })],
                    [plantAge(view.planted_at) ? `${plantAge(view.planted_at)} oud` : null],
                  ) : null}
                />
                <InfoRow
                  label="Verkregen op"
                  value={
                    view.acquired_at
                      ? sn(
                          [
                            new Date(view.acquired_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }),
                            plantAge(view.acquired_at) ? `${plantAge(view.acquired_at)} geleden` : null,
                          ],
                          [view.source, formatEuro(view.price)],
                        )
                      : sn([], [view.source, formatEuro(view.price)])
                  }
                />
                <InfoRow label="Locatie" value={view.location} />
                <InfoRow label="Zon" value={view.sun_needs ? view.sun_needs.replace(/,/g, " · ") : null} />
                <InfoRow
                  label="Groeiwijze"
                  value={view.growth_habit.length > 0 ? view.growth_habit.join(", ") : null}
                />
                <InfoRow
                  label="Grootte"
                  value={[
                    view.size_cm ? `${view.size_cm} cm hoog` : null,
                    view.spacing_cm ? `${view.spacing_cm} cm afstand` : null,
                  ].filter(Boolean).join(" · ") || null}
                />
                <InfoRow label="Volle grond of pot" value={view.growing_method} />
                {view.growing_method === "Pot" && (
                  <>
                    <InfoRow
                      label="Huidige pot"
                      value={sn(
                        [
                          view.pot_size_liters ? `${view.pot_size_liters} L` : null,
                          view.pot_material,
                          view.pot_color,
                        ],
                        [],
                      )}
                    />
                    <InfoRow
                      label="Potgrootte (advies)"
                      value={[
                        view.pot_min_liters ? `min. ${view.pot_min_liters} L` : null,
                        view.pot_recommended_liters ? `aanbevolen ${view.pot_recommended_liters} L` : null,
                      ].filter(Boolean).join(" · ") || null}
                    />
                    <InfoRow
                      label="Laatst verpot"
                      value={
                        view.last_repotted_at
                          ? sn(
                              [new Date(view.last_repotted_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })],
                              [plantAge(view.last_repotted_at) ? `${plantAge(view.last_repotted_at)} geleden` : null],
                            )
                          : null
                      }
                    />
                  </>
                )}
                <InfoRow
                  label="Water"
                  value={sn(
                    [
                      view.water_interval_days ? `elke ${view.water_interval_days} d (grond)` : null,
                      view.pot_water_interval_days ? `elke ${view.pot_water_interval_days} d (pot)` : null,
                      view.watering_method.length > 0 ? view.watering_method.join(", ") : null,
                      view.watering_method.includes("Onder de voet (weken)") && view.watering_soak_minutes
                        ? `${view.watering_soak_minutes} min. weken`
                        : null,
                    ],
                    [
                      view.growing_method === "Pot" ? view.pot_water_notes : null,
                      view.water_notes,
                    ],
                  )}
                />
                <InfoRow
                  label="Seizoen"
                  value={view.season_notes}
                />
                <InfoRow
                  label="Zaaien"
                  value={sn(
                    [
                      view.sow_months.length > 0 ? view.sow_months.join(", ") : null,
                      view.sow_week || null,
                    ],
                    [view.sow_notes],
                  )}
                />
                <InfoRow
                  label="Bloei"
                  value={sn(
                    [
                      view.bloom_months.length > 0 ? view.bloom_months.join(", ") : null,
                      view.bloom_week || null,
                    ],
                    [view.bloom_notes],
                  )}
                />
                <InfoRow
                  label="Oogst"
                  value={sn(
                    [
                      view.harvest_months.length > 0 ? view.harvest_months.join(", ") : null,
                      view.harvest_week || null,
                    ],
                    [view.harvest_notes],
                  )}
                />
                <InfoRow
                  label="Kas"
                  value={sn(
                    [parseGreenhouseNotes(view.greenhouse_notes).pref || null],
                    [parseGreenhouseNotes(view.greenhouse_notes).notes || null],
                  )}
                />
                <InfoRow
                  label="Voeding"
                  value={sn(
                    [
                      view.feeding_interval_days ? `elke ${view.feeding_interval_days} dagen` : null,
                      view.feeding_months.length > 0 ? view.feeding_months.join(", ") : null,
                    ],
                    [view.feeding_notes],
                  )}
                />
                <InfoRow
                  label="Grond"
                  value={sn(
                    [
                      view.soil_ph_min || view.soil_ph_max
                        ? `pH ${view.soil_ph_min ?? "?"}–${view.soil_ph_max ?? "?"}`
                        : null,
                    ],
                    [view.soil_notes],
                  )}
                />
                <InfoRow
                  label="Grond (werkelijk)"
                  value={sn([view.soil_type], [view.soil_mix_notes])}
                />
                <InfoRow
                  label="Klimaat"
                  value={[view.temperature_notes, view.humidity_notes].filter(Boolean).join(" · ") || null}
                />
                <InfoRow
                  label="Winterhardheid"
                  value={sn(
                    [view.winter_hardiness],
                    [view.winter_notes],
                  )}
                />
                <InfoRow label="Snoeien" value={view.pruning_notes} />
                <InfoRow label="Ziektes & plagen" value={view.pest_notes} />
                <InfoRow
                  label="Vermeerderen"
                  value={sn(
                    [view.propagation_methods.length > 0 ? view.propagation_methods.join(", ") : null],
                    [view.propagation_notes],
                  )}
                />
                <InfoRow
                  label="Giftig voor"
                  value={sn(
                    [
                      view.toxic_to_humans ? "Mens" : null,
                      view.toxic_to_cats ? "Kat" : null,
                    ],
                    [view.toxicity_notes],
                  )}
                />
                <InfoRow label="Overig" value={view.general_notes} />
                <InfoRow
                  label="Laatste controle"
                  value={
                    view.last_checked_at
                      ? sn(
                          [new Date(view.last_checked_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })],
                          [plantAge(view.last_checked_at) ? `${plantAge(view.last_checked_at)} geleden` : null],
                        )
                      : null
                  }
                />
              </div>

              <div className="space-y-3">
                <h3 className="sv-heading text-xl flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Groei bijhouden
                </h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Plak een foto-URL..."
                    value={photoUrlDraft}
                    onChange={(e) => setPhotoUrlDraft(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="sv-button shrink-0"
                    disabled={!photoUrlDraft.trim() || addPhoto.isPending}
                    onClick={() =>
                      addPhoto.mutate({
                        plantId: view.id,
                        url: photoUrlDraft.trim(),
                      })
                    }
                  >
                    {addPhoto.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.photo_url}
                          alt=""
                          className="w-full aspect-square object-cover rounded-lg sv-icon-slot"
                        />
                        <p className="text-[10px] sv-muted mt-1">
                          {new Date(photo.taken_at).toLocaleDateString(
                            "nl-NL",
                            { day: "numeric", month: "short" },
                          )}
                        </p>
                        <button
                          onClick={() => removePhoto.mutate(photo.id)}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full sv-icon-slot flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Verwijder foto"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                {confirmDelete ? (
                  <div className="flex items-center gap-3 w-full sm:justify-end">
                    <span className="text-sm sv-muted">Weet je het zeker?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="sv-button sv-button-ghost"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Annuleer
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="sv-button sv-button-destructive"
                      onClick={() => deletePlant.mutate(view.id)}
                      disabled={deletePlant.isPending}
                    >
                      {deletePlant.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Ja, verwijder"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex w-full items-center justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmDelete(true)}
                      className="sv-button sv-button-ghost"
                    >
                      <Trash2 className="h-4 w-4" /> Verwijder
                    </Button>
                    <Button
                      variant="outline"
                      className="sv-button text-xl"
                      onClick={startEdit}
                    >
                      <Pencil className="h-4 w-4" /> Bewerken
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="tuinieren-theme sv-dialog max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="sv-heading text-3xl">Zoeken & filteren</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <SectionHeading>Sortering</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: "naam", label: "Naam (A–Z)" },
                    { value: "water", label: "Water urgentie" },
                    { value: "categorie", label: "Categorie" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchFilter({ sort: value })}
                    className={chipClass(filters.sort === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Categorie</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {PLANT_CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      patchFilter({ category: toggleInArray(filters.category, opt) })
                    }
                    className={chipClass(filters.category.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Zon</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {SUN_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      patchFilter({ sun_needs: toggleInArray(filters.sun_needs, opt) })
                    }
                    className={chipClass(filters.sun_needs.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Kas</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {GREENHOUSE_PREF_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      patchFilter({ greenhouse_pref: toggleInArray(filters.greenhouse_pref, opt) })
                    }
                    className={chipClass(filters.greenhouse_pref.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Zaaien</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {MONTH_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      patchFilter({ sow_months: toggleInArray(filters.sow_months, m) })
                    }
                    className={monthChipClass(filters.sow_months.includes(m))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Bloeien</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {MONTH_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      patchFilter({ bloom_months: toggleInArray(filters.bloom_months, m) })
                    }
                    className={monthChipClass(filters.bloom_months.includes(m))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Oogsten</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {MONTH_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      patchFilter({ harvest_months: toggleInArray(filters.harvest_months, m) })
                    }
                    className={monthChipClass(filters.harvest_months.includes(m))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Water</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: "all", label: "Alles" },
                    { value: "overdue", label: "Te laat" },
                    { value: "soon", label: "Binnenkort (≤ 3 dagen)" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchFilter({ water: value })}
                    className={chipClass(filters.water === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Voeding</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: "all", label: "Alles" },
                    { value: "overdue", label: "Te laat" },
                    { value: "soon", label: "Binnenkort (≤ 3 dagen)" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchFilter({ feeding: value })}
                    className={chipClass(filters.feeding === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {MONTH_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      patchFilter({ feeding_months: toggleInArray(filters.feeding_months, m) })
                    }
                    className={monthChipClass(filters.feeding_months.includes(m))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Status</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {HEALTH_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      patchFilter({ health_status: toggleInArray(filters.health_status, opt) })
                    }
                    className={chipClass(filters.health_status.includes(opt))}
                  >
                    {HEALTH_STATUS_EMOJI[opt]} {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Ingeplant</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: "all", label: "Alles" },
                    { value: "planted", label: "Ingeplant" },
                    { value: "not_planted", label: "Nog te planten" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchFilter({ planted: value })}
                    className={chipClass(filters.planted === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Levensduur</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {LIFECYCLE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => patchFilter({ lifecycle: toggleInArray(filters.lifecycle, opt) })}
                    className={chipClass(filters.lifecycle.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Winterhardheid</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {WINTER_HARDINESS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => patchFilter({ winter_hardiness: toggleInArray(filters.winter_hardiness, opt) })}
                    className={chipClass(filters.winter_hardiness.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Giftig voor</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {["Mens", "Kat"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => patchFilter({ toxic: toggleInArray(filters.toxic, opt) })}
                    className={warnChipClass(filters.toxic.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <DialogFooter className="flex justify-between w-full">
            <Button
              variant="ghost"
              className="sv-button sv-button-ghost text-xl"
              onClick={() => setFilters(initialFilters)}
            >
              Reset
            </Button>
            <Button className="sv-button text-xl" onClick={() => setFilterOpen(false)}>
              Tonen ({filteredPlants.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
