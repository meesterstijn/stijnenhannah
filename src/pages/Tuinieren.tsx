import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type Plant,
  type PlantImportData,
  type PlantPhoto,
  type PlantHarvestLog,
  type PlantPruningLog,
  type PlantRepotLog,
  type PlantInspectionLog,
  type PlantInstance,
  type GrowingSeason,
  type CultivationType,
  type IndoorOutdoorType,
  type GrowthLogPhoto,
  type TrackingMode,
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
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
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
  Camera,
  SlidersHorizontal,
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  ClipboardCheck,
  ClipboardCopy,
  Ruler,
  Euro,
  Scissors,
  Boxes,
  Apple,
  Clock,
  Check,
  Layers,
  QrCode,
} from "lucide-react";
import { useGrowthLog } from "@/features/tuingids/hooks/useGrowthLog";
import { useGrowthPhotos } from "@/features/tuingids/hooks/useGrowthPhotos";
import type { LogEntry } from "@/features/tuingids/types";
import { optimizeGrowthPhoto } from "@/features/tuingids/lib/optimizeGrowthPhoto";
import { uploadGrowthPhoto } from "@/features/tuingids/lib/growthPhotoStorage";
import { GrowthPhotoInput } from "@/features/tuingids/components/GrowthPhotoInput";
import { GrowthPhotoTimeline } from "@/features/tuingids/components/GrowthPhotoTimeline";
import { QuickGrowthPhotoDialog } from "@/features/tuingids/components/QuickGrowthPhotoDialog";
import { QuickGrowthPhotoCapture } from "@/features/tuingids/components/QuickGrowthPhotoCapture";
import { useQrLabels } from "@/features/tuingids/hooks/useQrLabels";
import { QrScanner } from "@/features/tuingids/components/QrScanner";
import { QrScanAndLinkControl } from "@/features/tuingids/components/QrScanAndLinkControl";
import { QrLabelsManagerDialog } from "@/features/tuingids/components/QrLabelsManagerDialog";
import {
  fetchPlants,
  fetchHarvestLogs,
  fetchPruningLogs,
  fetchRepotLogs,
  fetchHarvestLogsForInstance,
  fetchPruningLogsForInstance,
  fetchRepotLogsForInstance,
  fetchInspectionLogsForInstance,
} from "@/features/tuingids/lib/plantLogs";
import { MONTH_OPTIONS } from "@/features/tuingids/lib/plantStatus";
import {
  instanceWaterStatus,
  instanceFeedingStatus,
  effectiveInstanceWaterIntervalDays,
  isInstanceWaterSkippedToday,
  INSTANCE_STATUS_LABELS,
  HEALTH_STATUS_EMOJI,
  TRACKING_MODE_LABELS,
  describeInstanceQuantity,
  compactBatchLabel,
} from "@/features/tuingids/lib/plantInstanceStatus";
import { formatMeasurement, formatFruitSize, computeSeasonStats } from "@/features/tuingids/lib/growthStats";
import { useRecordInstanceCare } from "@/features/tuingids/hooks/usePlantCareActions";
import {
  fetchPlantInstances,
  fetchActivePlantInstances,
  fetchPlantInstance,
  fetchAllGrowingSeasons,
  fetchGrowingSeasons,
  fetchActiveGrowingSeason,
  plantInstanceDisplayName,
  suggestInstanceName,
  suggestBatchName,
  resolveInstanceNames,
  getActiveInstancesForSpecies,
  hasActiveInstancesForSpecies,
} from "@/features/tuingids/lib/plantInstances";
import { usePlantInstances } from "@/features/tuingids/hooks/usePlantInstances";
import {
  SUN_OPTIONS,
  GREENHOUSE_PREF_OPTIONS,
  PLANT_CATEGORY_OPTIONS,
  LIFECYCLE_OPTIONS,
  GROWING_METHOD_OPTIONS,
  GROWTH_HABIT_OPTIONS,
  WATERING_METHOD_OPTIONS,
  HEALTH_STATUS_OPTIONS,
  POT_MATERIAL_OPTIONS,
  WINTER_HARDINESS_OPTIONS,
  PROPAGATION_OPTIONS,
  validatePlantImportEntry,
} from "@/features/tuingids/lib/plantImportSchema";
import { buildPlantImportChatGptPrompt } from "@/features/tuingids/lib/plantImportPrompt";

function parseGreenhouseNotes(raw: string | null): { pref: string; notes: string } {
  if (!raw) return { pref: "", notes: "" };
  for (const p of GREENHOUSE_PREF_OPTIONS) {
    if (raw === p) return { pref: p, notes: "" };
    if (raw.startsWith(p + "\n")) return { pref: p, notes: raw.slice(p.length + 1) };
  }
  return { pref: "", notes: raw };
}

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
  pot_min_depth_cm: string;
  pot_recommended_depth_cm: string;
  pot_water_notes: string;
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
  pot_min_depth_cm: "",
  pot_recommended_depth_cm: "",
  pot_water_notes: "",
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
    pot_min_depth_cm: p.pot_min_depth_cm ? String(p.pot_min_depth_cm) : "",
    pot_recommended_depth_cm: p.pot_recommended_depth_cm
      ? String(p.pot_recommended_depth_cm)
      : "",
    pot_water_notes: p.pot_water_notes ?? "",
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
    pot_min_depth_cm: d.pot_min_depth_cm ? Number(d.pot_min_depth_cm) : null,
    pot_recommended_depth_cm: d.pot_recommended_depth_cm
      ? Number(d.pot_recommended_depth_cm)
      : null,
    pot_water_notes: d.pot_water_notes.trim() || null,
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

// Species-level gallery only ever shows legacy/general photos
// (plant_instance_id is null) — instance photos live exclusively in their
// own instance dialog now, so two instances of the same species never
// share or mix photos, and existing pre-instance species photos keep
// showing here exactly as before this column existed.
async function fetchPhotos(plantId: string): Promise<PlantPhoto[]> {
  const { data, error } = await supabase
    .from("plant_photos")
    .select("*")
    .eq("plant_id", plantId)
    .is("plant_instance_id", null)
    .order("taken_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchPhotosForInstance(plantInstanceId: string): Promise<PlantPhoto[]> {
  const { data, error } = await supabase
    .from("plant_photos")
    .select("*")
    .eq("plant_instance_id", plantInstanceId)
    .order("taken_at", { ascending: false });
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs sv-muted">Minimale potdiepte (cm)</p>
            <Input
              type="number"
              min={1}
              placeholder="bv. 15"
              value={draft.pot_min_depth_cm}
              onChange={(e) => onChange({ pot_min_depth_cm: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs sv-muted">Aanbevolen potdiepte (cm)</p>
            <Input
              type="number"
              min={1}
              placeholder="bv. 25"
              value={draft.pot_recommended_depth_cm}
              onChange={(e) =>
                onChange({ pot_recommended_depth_cm: e.target.value })
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

// ─── Shared card shell ──────────────────────────────────────────────────────
// One presentational shell for both "Alle plantsoorten" (species) and "Mijn
// geplante exemplaren" (instance) tiles, so the two views are visually
// identical by construction instead of two hand-maintained card designs.

type PlantCardBadgeDef = {
  key: string;
  label: string;
  icon: typeof Droplet;
  overdue: boolean;
  onClick: () => void;
};

function PlantCardShell({
  photoUrl,
  healthEmoji,
  title,
  titleSuffix,
  subtitle,
  extraLines,
  badges,
  onOpen,
}: {
  photoUrl: string | null;
  healthEmoji?: string | null;
  title: string;
  titleSuffix?: React.ReactNode;
  subtitle?: string | null;
  extraLines?: (string | null | undefined)[];
  badges: PlantCardBadgeDef[];
  onOpen: () => void;
}) {
  const visibleExtraLines = (extraLines ?? []).filter((l): l is string => !!l);
  return (
    <button
      onClick={onOpen}
      className="sv-panel text-left p-5 hover:-translate-y-0.5 transition-transform flex items-center gap-3"
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 sv-icon-slot" />
      ) : (
        <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
          <Sprout className="h-5 w-5" strokeWidth={1.6} />
        </div>
      )}
      <div className="min-w-0">
        <p className="sv-heading text-2xl leading-snug truncate">
          {healthEmoji && <span aria-label={healthEmoji}>{healthEmoji} </span>}
          {title}
          {titleSuffix}
        </p>
        {subtitle && <p className="text-xs sv-muted truncate">{subtitle}</p>}
        {visibleExtraLines.map((line, i) => (
          <p key={i} className="text-xs sv-muted truncate">{line}</p>
        ))}
        {badges.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {badges.map((b) => (
              <span
                key={b.key}
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  b.onClick();
                }}
                className={`sv-heading inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full w-fit cursor-pointer hover:brightness-95 ${b.overdue ? "sv-badge-overdue" : "sv-badge-ok"}`}
              >
                <b.icon className="h-3 w-3" /> {b.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function PlantCard({
  p,
  onOpen,
}: {
  p: Plant;
  onOpen: (p: Plant) => void;
}) {
  return (
    <PlantCardShell
      photoUrl={p.photo_url}
      healthEmoji={p.health_status ? HEALTH_STATUS_EMOJI[p.health_status] : null}
      title={p.name}
      badges={[]}
      onOpen={() => onOpen(p)}
    />
  );
}

function PlantInstanceCard({
  instance,
  species,
  activeSeason,
  onOpen,
  onWater,
  onFeed,
}: {
  instance: PlantInstance;
  species: Plant | undefined;
  activeSeason: GrowingSeason | null;
  onOpen: (instance: PlantInstance) => void;
  onWater: (instance: PlantInstance) => void;
  onFeed: (instance: PlantInstance) => void;
}) {
  const name = plantInstanceDisplayName(instance, species);
  const status = species ? instanceWaterStatus(instance, species) : null;
  const feedStatus = species ? instanceFeedingStatus(instance, species) : null;
  const badges: PlantCardBadgeDef[] = [];
  if (status) badges.push({ key: "water", label: status.label, icon: Droplet, overdue: status.overdue, onClick: () => onWater(instance) });
  if (feedStatus) badges.push({ key: "feed", label: feedStatus.label, icon: Leaf, overdue: feedStatus.overdue, onClick: () => onFeed(instance) });

  const statusLabel = instance.status !== "active" ? INSTANCE_STATUS_LABELS[instance.status] : null;
  const seasonLabel = activeSeason ? activeSeason.label ?? `Seizoen ${activeSeason.year}` : null;

  const healthSuffix = instance.health_status
    ? ` ${HEALTH_STATUS_EMOJI[instance.health_status] ?? ""} ${instance.health_status}`
    : null;

  return (
    <PlantCardShell
      photoUrl={species?.photo_url ?? null}
      title={name}
      titleSuffix={
        healthSuffix ? (
          <span className="text-base sv-muted font-normal">{healthSuffix}</span>
        ) : null
      }
      subtitle={species && species.name !== name ? species.name : undefined}
      extraLines={[compactBatchLabel(instance), instance.location, seasonLabel, statusLabel]}
      badges={badges}
      onOpen={() => onOpen(instance)}
    />
  );
}

// Determines once at render time whether the user prefers reduced motion.
// Inline because this component is file-local and the check is synchronous.
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function SpeciesGroupCard({
  species,
  instances,
  isExpanded,
  onToggle,
  onOpen,
  onWater,
  onFeed,
  activeSeasonByInstance,
}: {
  species: Plant | undefined;
  instances: PlantInstance[];
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: (i: PlantInstance) => void;
  onWater: (i: PlantInstance) => void;
  onFeed: (i: PlantInstance) => void;
  activeSeasonByInstance: Map<string, GrowingSeason>;
}) {
  const speciesName = species?.name ?? "Onbekende soort";
  const reduced = prefersReducedMotion();

  // Count how many instances in this group are overdue for water / feeding.
  // Uses the same helpers as PlantInstanceCard — no second implementation.
  const waterNeededCount = species
    ? instances.filter((i) => instanceWaterStatus(i, species)?.overdue === true).length
    : 0;
  const feedNeededCount = species
    ? instances.filter((i) => instanceFeedingStatus(i, species)?.overdue === true).length
    : 0;

  // "{instances.length} exemplaren" blijft het aantal REGISTRATIES (zoals
  // het al was) — een groep met batches erin toont er daarnaast het totaal
  // aantal fysieke planten bij, want die twee getallen kunnen sinds
  // batchtracking uiteenlopen (bv. 2 registraties, maar 1 daarvan is een
  // batch van 18). Alleen getoond als het groep minstens 1 batch bevat, om
  // de gangbare "allemaal individueel"-groep niet nodeloos drukker te maken.
  const hasBatch = instances.some((i) => i.tracking_mode === "batch");
  const totalPlants = instances.reduce(
    (sum, i) => sum + (i.tracking_mode === "individual" ? 1 : (i.quantity ?? 0)),
    0,
  );
  const hasUncountedBatch = instances.some((i) => i.tracking_mode === "batch" && i.quantity === null);

  // grid-template-rows 0fr→1fr is the standard CSS-only height animation.
  // The inner overflow:hidden clips content during the transition.
  const containerStyle: React.CSSProperties = reduced
    ? isExpanded ? {} : { display: "none" }
    : {
        display: "grid",
        gridTemplateRows: isExpanded ? "1fr" : "0fr",
        opacity: isExpanded ? 1 : 0,
        transition: "grid-template-rows 0.2s ease, opacity 0.15s ease",
      };

  return (
    <div className={isExpanded ? "space-y-3" : "h-full"}>
      {/* Group header — same visual style as PlantCardShell */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${speciesName}, ${instances.length} exemplaren ${isExpanded ? "inklappen" : "uitklappen"}`}
        className={`sv-panel text-left p-5 hover:-translate-y-0.5 transition-transform flex items-center gap-3 w-full focus-visible:ring-2 focus-visible:ring-offset-2${isExpanded ? "" : " h-full"}`}
      >
        {species?.photo_url ? (
          <img src={species.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 sv-icon-slot" />
        ) : (
          <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
            <Sprout className="h-5 w-5" strokeWidth={1.6} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="sv-heading text-2xl leading-snug truncate">{speciesName}</p>
            <Layers className="h-4 w-4 sv-muted shrink-0" aria-hidden />
          </div>
          <p className="text-xs sv-muted">{instances.length} exemplaren</p>
          {hasBatch && (
            <p className="text-xs sv-muted">
              {totalPlants} {totalPlants === 1 ? "plant" : "planten"}
              {hasUncountedBatch ? " (excl. niet-getelde batch)" : ""}
            </p>
          )}
          {(waterNeededCount > 0 || feedNeededCount > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {waterNeededCount > 0 && (
                <span className="sv-heading inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full w-fit sv-badge-overdue">
                  <Droplet className="h-3 w-3" aria-hidden />
                  {waterNeededCount} water nodig
                </span>
              )}
              {feedNeededCount > 0 && (
                <span className="sv-heading inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full w-fit sv-badge-overdue">
                  <Leaf className="h-3 w-3" aria-hidden />
                  {feedNeededCount} voeding nodig
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 sv-muted shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {/* Animated subgrid of individual instance cards */}
      <div style={containerStyle}>
        <div style={{ overflow: "hidden" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {instances.map((instance) => (
              <PlantInstanceCard
                key={instance.id}
                instance={instance}
                species={species}
                activeSeason={activeSeasonByInstance.get(instance.id) ?? null}
                onOpen={onOpen}
                onWater={onWater}
                onFeed={onFeed}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
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

type CalendarPlantFilter = "all" | "planted";

function calendarFilterButtonClass(active: boolean): string {
  return `px-3 py-1 rounded-full transition-colors ${active ? "sv-badge-ok" : "sv-muted"}`;
}

// Single source of truth for the plant detail popup's outer look — used by
// both the species detail dialog and the plant-instance detail dialog so
// the two are provably, exactly visually identical (same width, height,
// border, radius, shadow — the `sv-dialog` class, not `sv-panel` which is
// for in-page tiles/cards). Keep in sync if the species dialog's classes
// ever change.
const PLANT_DIALOG_CONTENT_CLASS = "tuinieren-theme sv-dialog w-full max-w-2xl max-h-[90vh]";
const PLANT_DIALOG_TITLE_CLASS = "sv-heading text-3xl sm:text-4xl leading-snug";

function SeasonalOverview({ plants }: { plants: Plant[] }) {
  const [open, setOpen] = useState(true);
  const [monthIndex, setMonthIndex] = useState(new Date().getMonth());
  const [plantFilter, setPlantFilter] = useState<CalendarPlantFilter>("all");
  const currentMonth = MONTH_OPTIONS[monthIndex];
  const monthLabel = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
  const isCurrentMonth = monthIndex === new Date().getMonth();

  const { data: activeInstancesForCalendar = [] } = useQuery({
    queryKey: ["plant_instances", "active"],
    queryFn: fetchActivePlantInstances,
  });

  // "Mijn geplante planten": a species counts as planted when it has at
  // least one active plant_instances row — the only source of truth since
  // phase 4 (the legacy `plants.planted` boolean is no longer read here).
  // `plants` already has exactly one row per species, so filtering it —
  // rather than filtering instances — dedupes by species_id for free: two
  // active Koralik exemplaren still only match the one Koralik species row
  // once.
  const visiblePlants = useMemo(() => {
    if (plantFilter === "all") return plants;
    return plants.filter((p) => hasActiveInstancesForSpecies(p.id, activeInstancesForCalendar));
  }, [plants, plantFilter, activeInstancesForCalendar]);

  const noPlantedPlants = plantFilter === "planted" && visiblePlants.length === 0;

  const sowNow = visiblePlants.filter((p) => p.sow_months.includes(currentMonth));
  const bloomNow = visiblePlants.filter((p) => p.bloom_months.includes(currentMonth));
  const harvestNow = visiblePlants.filter((p) => p.harvest_months.includes(currentMonth));

  const isEmpty = sowNow.length === 0 && bloomNow.length === 0 && harvestNow.length === 0;

  return (
    <div className="sv-panel p-5 space-y-3">
      <div className="flex justify-center">
        <div className="flex sv-inset rounded-full p-1 gap-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setPlantFilter("all")}
            className={calendarFilterButtonClass(plantFilter === "all")}
          >
            Alle planten
          </button>
          <button
            type="button"
            onClick={() => setPlantFilter("planted")}
            className={calendarFilterButtonClass(plantFilter === "planted")}
          >
            Mijn geplante planten
          </button>
        </div>
      </div>
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
          {noPlantedPlants ? (
            <p className="text-sm sv-muted">Je hebt nog geen planten als geplant geregistreerd.</p>
          ) : isEmpty ? (
            <p className="text-sm sv-muted">Niets gepland voor {monthLabel}.</p>
          ) : null}
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



// ─── WaterSection component ─────────────────────────────────────────────────

type InstanceCareState = {
  id: string;
  name: string;
  last_watered_at: string | null;
  last_fed_at: string | null;
  water_skip_until: string | null;
  cultivation_type: CultivationType | null;
};

function WaterSection({
  plant,
  instanceState,
  onRecordWatering,
  isUpdating,
  isRecording,
}: {
  plant: Plant;
  // When set, this section is being shown for a concrete PlantInstance
  // rather than the species directly — `plant` still supplies general
  // advice text/intervals, but state (last watered, skip-until, cultivation)
  // and history/actions are scoped to this instance instead.
  instanceState?: InstanceCareState;
  onRecordWatering: (note?: string) => void;
  isUpdating: boolean;
  isRecording: boolean;
}) {
  const { entries } = useGrowthLog();
  const inPot = instanceState ? instanceState.cultivation_type === "pot" : plant.growing_method === "Pot";

  // Water history: growth log entries where watered=true for this plant.
  // In instance mode, matched strictly by plant_instance_id so two instances
  // of the same species never share history. In legacy species mode, a
  // plant_id match is required; only legacy entries without a plant_id
  // (freehand notes) fall back to matching by name.
  const waterHistory = entries
    .filter(
      (e) =>
        e.watered &&
        (instanceState
          ? e.plant_instance_id === instanceState.id
          : e.plant_id ? e.plant_id === plant.id : e.plant_name === plant.name),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Fallback to the Supabase field when no local history yet
  const lastWateredAtField = instanceState ? instanceState.last_watered_at : plant.last_watered_at;
  const lastWaterDateStr =
    waterHistory[0]?.date ?? lastWateredAtField?.slice(0, 10) ?? null;

  const interval = inPot && plant.pot_water_interval_days ? plant.pot_water_interval_days : plant.water_interval_days;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastWaterDate = lastWaterDateStr
    ? new Date(lastWaterDateStr + "T00:00:00")
    : null;

  const daysAgo =
    lastWaterDate !== null
      ? Math.floor((today.getTime() - lastWaterDate.getTime()) / 86_400_000)
      : null;

  let nextWaterDate: Date | null = null;
  if (lastWaterDate && interval) {
    nextWaterDate = new Date(lastWaterDate);
    nextWaterDate.setDate(nextWaterDate.getDate() + interval);
  }

  const daysLeft =
    nextWaterDate !== null
      ? Math.ceil((nextWaterDate.getTime() - today.getTime()) / 86_400_000)
      : null;

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const waterSkipUntil = instanceState ? instanceState.water_skip_until : plant.water_skip_until;
  const isSkippedToday = !!waterSkipUntil && todayIso < waterSkipUntil;

  const [adviceOpen, setAdviceOpen] = useState(false);

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
      </div>

      {/* Wateractie: interval-status en knop in één compacte, responsieve rij */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {badge ? (
          <span
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full sv-heading sm:flex-1 ${
              badge.overdue ? "sv-badge-overdue" : "sv-badge-ok"
            }`}
          >
            <Droplet className="h-3 w-3" /> {badge.label}
          </span>
        ) : (
          <span className="text-sm sv-muted sm:flex-1">Geen vast waterinterval — geef water wanneer nodig.</span>
        )}
        <Button
          size="sm"
          className="sv-button gap-1.5 w-full sm:w-auto shrink-0"
          onClick={() => onRecordWatering()}
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

    </div>
  );
}

// ─── FeedingSection component ───────────────────────────────────────────────

function FeedingSection({
  plant,
  instanceState,
  onRecordFeeding,
  isUpdating,
  isRecording,
}: {
  plant: Plant;
  instanceState?: InstanceCareState;
  onRecordFeeding: (note?: string) => void;
  isUpdating: boolean;
  isRecording: boolean;
}) {
  const { entries } = useGrowthLog();

  const feedHistory = entries
    .filter(
      (e) =>
        e.fertilized &&
        (instanceState
          ? e.plant_instance_id === instanceState.id
          : e.plant_id ? e.plant_id === plant.id : e.plant_name === plant.name),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastFedAtField = instanceState ? instanceState.last_fed_at : plant.last_fed_at;
  const lastFedDateStr =
    feedHistory[0]?.date ?? lastFedAtField?.slice(0, 10) ?? null;

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

  let nextFeedDate: Date | null = null;
  if (lastFedDate && interval) {
    nextFeedDate = new Date(lastFedDate);
    nextFeedDate.setDate(nextFeedDate.getDate() + interval);
  }

  const daysLeft =
    nextFeedDate !== null
      ? Math.ceil((nextFeedDate.getTime() - today.getTime()) / 86_400_000)
      : null;

  const currentMonth = MONTH_OPTIONS[new Date().getMonth()];
  const outsideFeedingSeason =
    plant.feeding_months.length > 0 &&
    !plant.feeding_months.includes(currentMonth);

  const [adviceOpen, setAdviceOpen] = useState(false);

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
      </div>

      {/* Voedingsactie: interval-status en knop in één compacte, responsieve rij */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {badge ? (
          <span
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full sv-heading sm:flex-1 ${
              badge.overdue ? "sv-badge-overdue" : "sv-badge-ok"
            }`}
          >
            <Leaf className="h-3 w-3" /> {badge.label}
          </span>
        ) : (
          <span className="text-sm sv-muted sm:flex-1">Geen vast voedingsinterval — geef voeding wanneer nodig.</span>
        )}
        <Button
          size="sm"
          className="sv-button gap-1.5 w-full sm:w-auto shrink-0"
          onClick={() => onRecordFeeding()}
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

    </div>
  );
}

// ─── PlantLogboek component ─────────────────────────────────────────────────

function PlantLogboek({
  plantName,
  plantInstanceId = null,
  growingSeasonId = null,
  isBatch = false,
}: {
  plantName: string;
  plantInstanceId?: string | null;
  growingSeasonId?: string | null;
  /** True for tracking_mode="batch" instances — de hoogte staat dan voor de
   *  hele batch, niet voor één plant, dus het label verduidelijkt dat. */
  isBatch?: boolean;
}) {
  const { addEntryAsync, isAdding, addError } = useGrowthLog();
  const { addPhoto } = useGrowthPhotos();

  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [fruitLengthCm, setFruitLengthCm] = useState("");
  const [fruitWidthCm, setFruitWidthCm] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [isSavingAsync, setIsSavingAsync] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  function resetForm() {
    setNotes("");
    setHeightCm("");
    setFruitLengthCm("");
    setFruitWidthCm("");
    setSelectedPhotos([]);
    setDate(new Date().toISOString().slice(0, 10));
    setFormError(null);
    setFormOpen(false);
    isSavingRef.current = false;
    setIsSavingAsync(false);
  }

  async function handleSave() {
    if (isSavingRef.current) return;
    setFormError(null);

    const height = heightCm.trim() ? Number(heightCm) : null;
    const fruitLength = fruitLengthCm.trim() ? Number(fruitLengthCm) : null;
    const fruitWidth = fruitWidthCm.trim() ? Number(fruitWidthCm) : null;
    const noteText = notes.trim();

    if (height === null && fruitLength === null && fruitWidth === null && !noteText && selectedPhotos.length === 0) {
      setFormError("Vul minimaal een planthoogte, vruchtgrootte, notitie of foto in.");
      return;
    }
    if (height !== null && (!Number.isFinite(height) || height < 0)) {
      setFormError("Planthoogte moet nul of een positief getal zijn.");
      return;
    }
    if (fruitLength !== null && (!Number.isFinite(fruitLength) || fruitLength <= 0)) {
      setFormError("Vruchtlengte moet een getal groter dan nul zijn.");
      return;
    }
    if (fruitWidth !== null && (!Number.isFinite(fruitWidth) || fruitWidth <= 0)) {
      setFormError("Vruchtbreedte/diameter moet een getal groter dan nul zijn.");
      return;
    }

    isSavingRef.current = true;
    setIsSavingAsync(true);

    let newEntry: { id: string } | undefined;
    try {
      newEntry = await addEntryAsync({
        plant_id: null,
        plant_name: plantName,
        plant_instance_id: plantInstanceId,
        growing_season_id: growingSeasonId,
        date,
        notes: noteText,
        height_cm: height,
        flower_count: null,
        fruit_count: null,
        fruit_length_cm: fruitLength,
        fruit_width_cm: fruitWidth,
        quantity: null,
        watered: false,
        fertilized: false,
        photo_url: "",
      });
    } catch (err) {
      setFormError(`Opslaan mislukt: ${err instanceof Error ? err.message : "Onbekende fout"}`);
      isSavingRef.current = false;
      setIsSavingAsync(false);
      return;
    }

    // Photo uploads — iterate over all selected photos sequentially.
    // Stop on first failure: the entry is already saved so we warn without
    // resetting the form, letting the user see which entry needs a retry.
    if (selectedPhotos.length > 0 && newEntry && plantInstanceId) {
      for (const photo of selectedPhotos) {
        try {
          const optimized = await optimizeGrowthPhoto(photo);
          const { storagePath, publicUrl } = await uploadGrowthPhoto(plantInstanceId, newEntry.id, optimized);
          await addPhoto({
            growth_log_entry_id: newEntry.id,
            plant_instance_id: plantInstanceId,
            storage_path: storagePath,
            photo_url: publicUrl,
            original_filename: optimized.originalFilename,
            mime_type: optimized.mimeType,
            file_size_bytes: optimized.fileSizeBytes,
          });
        } catch (photoErr) {
          setFormError(
            `Meting opgeslagen, maar een foto kon niet worden geüpload: ${photoErr instanceof Error ? photoErr.message : "Onbekende fout"}. Je kunt de foto later toevoegen via de groeifoto-tijdlijn.`,
          );
          isSavingRef.current = false;
          setIsSavingAsync(false);
          return;
        }
      }
    }

    resetForm();
  }

  return (
    <div className="sv-inset p-4 space-y-4 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">🌱 Groei bijhouden</p>
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs sv-muted block mb-1">Datum</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-xs sv-muted block mb-1">
                {isBatch ? "Gem. hoogte batch (cm)" : "Hoogte plant (cm)"}
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="bijv. 45"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs sv-muted font-medium uppercase tracking-wide">Vrucht of groente</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs sv-muted block mb-1">Lengte (cm)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="bijv. 18"
                  value={fruitLengthCm}
                  onChange={(e) => setFruitLengthCm(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs sv-muted block mb-1">Breedte / diameter (cm)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="bijv. 4"
                  value={fruitWidthCm}
                  onChange={(e) => setFruitWidthCm(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs sv-muted font-medium uppercase tracking-wide">Notitie</p>
            <Textarea
              placeholder="bijv. Eerste kleine tomaat zichtbaar..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs sv-muted font-medium uppercase tracking-wide">Foto</p>
            <GrowthPhotoInput
              files={selectedPhotos}
              onFilesChange={setSelectedPhotos}
              disabled={isSavingAsync}
            />
          </div>

          {formError && <p className="text-xs sv-destructive-text">{formError}</p>}
          {!formError && addError && (
            <p className="text-xs sv-destructive-text">Opslaan mislukt: {addError.message}</p>
          )}

          <div className="flex gap-2">
            <Button size="sm" className="sv-button" onClick={handleSave} disabled={isAdding || isSavingAsync}>
              {isSavingAsync ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
            </Button>
            <Button size="sm" className="sv-button sv-button-ghost" onClick={resetForm} disabled={isAdding || isSavingAsync}>
              Annuleer
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── HarvestLogSection component ───────────────────────────────────────────

function HarvestLogSection({
  plantId,
  plantInstanceId,
  growingSeasonId,
  logs,
  onAdd,
  onDelete,
  isSaving,
}: {
  plantId: string;
  plantInstanceId?: string;
  growingSeasonId?: string | null;
  logs: PlantHarvestLog[];
  onAdd: (row: {
    plant_id: string;
    plant_instance_id?: string;
    growing_season_id?: string | null;
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
  // Synchronous double-submit guard — `isSaving` (mutation.isPending) only
  // flips after the next render, so two clicks in the same tick can both
  // pass that check; a ref updates immediately and closes that race.
  const isSavingRef = useRef(false);

  function resetForm() {
    setWeight("");
    setQuantity("");
    setUnit("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setError(null);
    setFormOpen(false);
    isSavingRef.current = false;
  }

  function handleSave() {
    if (isSavingRef.current) return;
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
    isSavingRef.current = true;
    onAdd({
      plant_id: plantId,
      plant_instance_id: plantInstanceId,
      growing_season_id: growingSeasonId,
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
  plantInstanceId,
  growingSeasonId,
  logs,
  onAdd,
  onDelete,
  isSaving,
}: {
  plantId: string;
  plantInstanceId?: string;
  growingSeasonId?: string | null;
  logs: PlantPruningLog[];
  onAdd: (row: {
    plant_id: string;
    plant_instance_id?: string;
    growing_season_id?: string | null;
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
  const isSavingRef = useRef(false);

  function resetForm() {
    setType("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setFormOpen(false);
    isSavingRef.current = false;
  }

  function handleSave() {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    onAdd({
      plant_id: plantId,
      plant_instance_id: plantInstanceId,
      growing_season_id: growingSeasonId,
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
  plantInstanceId,
  growingSeasonId,
  legacyPlantId,
  logs,
  onAdd,
  onDelete,
  isSaving,
}: {
  // Structurally compatible with both Plant (species, legacy) and
  // PlantInstance — both share these three fields with the same shape.
  plant: Pick<Plant, "id" | "pot_size_liters" | "last_repotted_at">;
  plantInstanceId?: string;
  growingSeasonId?: string | null;
  // The species-level plant_id the log row's (legacy) plant_id column
  // should point to; defaults to `plant.id` when `plant` already is the
  // species (legacy mode).
  legacyPlantId?: string;
  logs: PlantRepotLog[];
  onAdd: (row: {
    plant_id: string;
    plant_instance_id?: string;
    growing_season_id?: string | null;
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
  const isSavingRef = useRef(false);

  function resetForm() {
    setNewSize("");
    setMaterial("");
    setSoil("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setFormOpen(false);
    isSavingRef.current = false;
  }

  function handleSave() {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    onAdd({
      plant_id: legacyPlantId ?? plant.id,
      plant_instance_id: plantInstanceId,
      growing_season_id: growingSeasonId,
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

// ─── FirstEventButton component ────────────────────────────────────────────
// Shared UI for "Eerste bloem" / "Eerste vrucht": registers a one-off date on
// the plant itself, editable/removable afterwards. Reused for both events so
// there is only one implementation of the register/edit/delete behavior.

function FirstEventButton({
  label,
  emoji,
  value,
  onSave,
  onDelete,
  isSaving,
}: {
  label: string;
  emoji: string;
  value: string | null;
  onSave: (date: string) => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(() => value ?? new Date().toISOString().slice(0, 10));

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 sv-inset px-2 py-1 rounded-full">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-7 text-xs w-[8.5rem]"
        />
        <Button
          size="icon"
          className="sv-button h-7 w-7 shrink-0"
          disabled={isSaving || !date}
          onClick={() => {
            onSave(date);
            setEditing(false);
          }}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="sv-button sv-button-ghost h-7 w-7 shrink-0"
          onClick={() => setEditing(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (value) {
    return (
      <div className="sv-badge-ok flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full">
        <span>
          {emoji} {label}:{" "}
          {new Date(value + "T00:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => {
            setDate(value);
            setEditing(true);
          }}
          className="opacity-70 hover:opacity-100"
          aria-label={`${label} wijzigen`}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button type="button" onClick={onDelete} className="opacity-70 hover:opacity-100" aria-label={`${label} verwijderen`}>
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="sv-button sv-button-thin-border text-xl"
      onClick={() => {
        setDate(new Date().toISOString().slice(0, 10));
        setEditing(true);
      }}
    >
      <span className="text-base">{emoji}</span> {label}
    </Button>
  );
}

// ─── InspectionLogSection component ────────────────────────────────────────
// Instance-only: full inspection history (health status + observations,
// issues, action taken), replacing the single last_checked_at timestamp
// with a real log. Mirrors HarvestLogSection/PruningLogSection/
// RepotLogSection's collapsible-form-plus-list pattern.

function InspectionLogSection({
  plantInstanceId,
  growingSeasonId,
  logs,
  onAdd,
  onDelete,
  isSaving,
}: {
  plantInstanceId: string;
  growingSeasonId?: string | null;
  logs: PlantInspectionLog[];
  onAdd: (row: {
    plant_instance_id: string;
    growing_season_id?: string | null;
    checked_at: string;
    health_status: string | null;
    notes: string | null;
    issues: string | null;
    action_taken: string | null;
    photo_url: string | null;
  }) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [checkedAt, setCheckedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [healthStatus, setHealthStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [issues, setIssues] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  function resetForm() {
    setHealthStatus("");
    setNotes("");
    setIssues("");
    setActionTaken("");
    setPhotoUrl("");
    setCheckedAt(new Date().toISOString().slice(0, 10));
    setError(null);
    setFormOpen(false);
    isSavingRef.current = false;
  }

  function handleSave() {
    if (isSavingRef.current) return;
    setError(null);
    if (new Date(checkedAt).getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      setError("Datum ligt te ver in de toekomst.");
      return;
    }
    isSavingRef.current = true;
    onAdd({
      plant_instance_id: plantInstanceId,
      growing_season_id: growingSeasonId,
      checked_at: checkedAt,
      health_status: healthStatus || null,
      notes: notes.trim() || null,
      issues: issues.trim() || null,
      action_taken: actionTaken.trim() || null,
      photo_url: photoUrl.trim() || null,
    });
    resetForm();
  }

  return (
    <div className="sv-inset p-4 space-y-4 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-xs sv-muted">
          {logs.length === 0 ? "Nog geen inspecties" : `${logs.length} inspectie${logs.length !== 1 ? "s" : ""}`}
        </p>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="sv-button sv-button-thin-border flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3 w-3" /> Inspectie
          </button>
        )}
      </div>

      {formOpen && (
        <div className="space-y-3">
          <div>
            <label className="text-xs sv-muted block mb-1">Datum</label>
            <Input type="date" value={checkedAt} onChange={(e) => setCheckedAt(e.target.value)} className="text-sm max-w-[10rem]" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs sv-muted block">Gezondheid</label>
            <div className="flex gap-2 flex-wrap">
              {HEALTH_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setHealthStatus((v) => (v === opt ? "" : opt))}
                  className={chipClass(healthStatus === opt)}
                >
                  {HEALTH_STATUS_EMOJI[opt]} {opt}
                </button>
              ))}
            </div>
          </div>
          <Textarea placeholder="Observaties / notities..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm resize-none" />
          <Textarea placeholder="Problemen (plagen, ziektes, gebreksverschijnselen...)" rows={2} value={issues} onChange={(e) => setIssues(e.target.value)} className="text-sm resize-none" />
          <Input placeholder="Ondernomen actie" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} className="text-sm" />
          <Input placeholder="Foto-URL (optioneel)" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="text-sm" />
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
                  {new Date(log.checked_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                  {log.health_status && ` · ${HEALTH_STATUS_EMOJI[log.health_status] ?? ""} ${log.health_status}`}
                </p>
                {log.notes && <p>{log.notes}</p>}
                {log.issues && <p className="text-xs sv-destructive-text">⚠ {log.issues}</p>}
                {log.action_taken && <p className="text-xs sv-muted">Actie: {log.action_taken}</p>}
                {log.photo_url && (
                  <a href={log.photo_url} target="_blank" rel="noreferrer" className="text-xs underline sv-muted">
                    Foto
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDelete(log.id)}
                className="sv-muted hover:sv-destructive-text shrink-0"
                aria-label="Verwijder inspectie"
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


// ─── SpeciesCombobox ────────────────────────────────────────────────────────
// A real searchable combobox (Popover + cmdk Command, both already used
// elsewhere in the shadcn setup but never wired up for this form): clicking
// the trigger immediately opens a floating, scrollable list of every
// species (alphabetical, since `fetchPlants()` already orders by name) —
// typing only filters it, it never becomes free text. Replaces the old
// plain <Input> + inline conditional list, which only ever showed results
// once the user had typed something and was never a real dropdown (no
// click-to-open, no floating overlay, no keyboard navigation). Popover
// renders through a portal at a higher z-index than the surrounding Dialog,
// so it can never be clipped or covered by it.
function SpeciesCombobox({
  speciesList,
  value,
  onSelect,
  autoFocusOpen,
}: {
  speciesList: Plant[];
  value: string | null;
  onSelect: (species: Plant) => void;
  // Opens the popover immediately on mount — used for "Wijzig", which should
  // behave like clicking the trigger itself.
  autoFocusOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!autoFocusOpen);
  const selected = speciesList.find((s) => s.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="sv-inset rounded-lg px-3 py-2 w-full flex items-center justify-between gap-2 text-left text-sm hover:opacity-90"
        >
          {selected ? (
            <span className="min-w-0 flex items-center gap-2">
              {selected.photo_url ? (
                <img src={selected.photo_url} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
              ) : (
                <Sprout className="h-4 w-4 shrink-0 sv-muted" />
              )}
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="sv-muted">Zoek een plantsoort...</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 sv-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 z-[60] w-[var(--radix-popover-trigger-width)]"
      >
        <Command
          filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Zoek op naam, cultivar of soort..." />
          <CommandList className="max-h-60">
            <CommandEmpty>
              <p className="text-xs sv-muted px-3 py-2">Geen plantsoort gevonden.</p>
            </CommandEmpty>
            {speciesList.map((s) => (
              <CommandItem
                key={s.id}
                value={`${s.name} ${s.species ?? ""} ${s.category ?? ""}`}
                onSelect={() => {
                  onSelect(s);
                  setOpen(false);
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                {s.photo_url ? (
                  <img src={s.photo_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                ) : (
                  <Sprout className="h-4 w-4 shrink-0 sv-muted" />
                )}
                <div className="min-w-0">
                  <p className="truncate">{s.name}</p>
                  {(s.species || s.category) && (
                    <p className="text-xs sv-muted truncate">{[s.species, s.category].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Nieuw exemplaar planten ────────────────────────────────────────────────
// Same collapsible-panel pattern as the groeilogboek (sv-panel + a toggle
// button that expands into a form). Creates one PlantInstance + one active
// GrowingSeason, linked via species_id — never touches the species catalog.

const CULTIVATION_TYPE_OPTIONS: { value: CultivationType; label: string }[] = [
  { value: "pot", label: "Pot" },
  { value: "open_ground", label: "Volle grond" },
  { value: "raised_bed", label: "Verhoogde border" },
];

const INDOOR_OUTDOOR_OPTIONS: { value: IndoorOutdoorType; label: string }[] = [
  { value: "outdoor", label: "Buiten" },
  { value: "indoor", label: "Kas" },
];

function NewPlantInstanceForm({
  speciesList,
  allInstances,
  preselectedSpecies,
  onCreated,
  controlledOpen,
  onClose,
}: {
  speciesList: Plant[];
  allInstances: PlantInstance[];
  // Set when opened from a species tile/detail ("Nieuw exemplaar planten"
  // for THIS soort) — the species search is skipped and locked in, matching
  // the shared workflow used from every entry point.
  preselectedSpecies?: Plant;
  onCreated?: () => void;
  /** When provided, the component is in controlled mode: the trigger button is
   *  suppressed and open/close is driven by the parent. */
  controlledOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(!!preselectedSpecies);
  const [locked, setLocked] = useState(!!preselectedSpecies);
  const [speciesId, setSpeciesId] = useState<string | null>(preselectedSpecies?.id ?? null);
  // individual (default) vs batch — zie opdracht "hybride systeem voor
  // individuele planten en batches". Bepaalt of het bestaande "Aantal
  // exemplaren"-bulkveld hieronder (dat N losse exemplaren aanmaakt, elk
  // met een eigen auto-naam) getoond wordt, of dat er in plaats daarvan ÉÉN
  // batch-registratie met tracking_mode="batch" ontstaat.
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("individual");
  const [customName, setCustomName] = useState(() =>
    preselectedSpecies
      ? suggestInstanceName(preselectedSpecies.name, allInstances.filter((i) => i.species_id === preselectedSpecies.id).length)
      : "",
  );
  const [nameTouched, setNameTouched] = useState(false);
  // Bulkaanmaak van N losse INDIVIDUELE exemplaren in één keer (bestaande
  // functionaliteit, ongewijzigd) — bewust NIET "quantity" genoemd, om
  // verwarring met plant_instances.quantity (het aantal fysieke planten in
  // ÉÉN batch-registratie) te voorkomen. Alleen relevant/getoond bij
  // trackingMode "individual".
  const [bulkCount, setBulkCount] = useState("1");
  const [location, setLocation] = useState("");
  const [cultivationType, setCultivationType] = useState<CultivationType | ("")>("");
  const [indoorOutdoor, setIndoorOutdoor] = useState<IndoorOutdoorType | "">("");
  const [potSizeLiters, setPotSizeLiters] = useState("");
  const [potMaterial, setPotMaterial] = useState("");
  const [potColor, setPotColor] = useState("");
  const [soilType, setSoilType] = useState("");
  const [soilMixNotes, setSoilMixNotes] = useState("");
  const [plantedAt, setPlantedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [acquiredAt, setAcquiredAt] = useState("");
  const [source, setSource] = useState("");
  const [price, setPrice] = useState("");
  const [seasonStartedAt, setSeasonStartedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [seasonLabel, setSeasonLabel] = useState("");
  const [startHeightInput, setStartHeightInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  // Optionele QR-koppeling (Deel C): alleen zinvol als dit exact ÉÉN nieuwe
  // registratie oplevert — een QR hoort bij precies één instance, dus bij
  // bulkaanmaak van N losse individuele exemplaren is er geen eenduidige
  // ontvanger voor de scan (zie qrEligible hieronder).
  const [qrCode, setQrCode] = useState<string | null>(null);

  const { createInstanceWithSeason, isCreating } = usePlantInstances();
  const { assignLabel } = useQrLabels();
  // Synchronous guard against double-submit: `isCreating` (mutation.isPending)
  // only flips after React commits the next render, so two clicks fired in
  // the same tick (e.g. a fast double-click) can both pass the `disabled`
  // check before either registers — a ref updates immediately, closing that
  // race window.
  const isSavingRef = useRef(false);

  // Derived values — computed once per render so handleSave and JSX share them.
  const parsedBulkCount = parseInt(bulkCount, 10);
  const validBulkCount = Number.isInteger(parsedBulkCount) && parsedBulkCount >= 1 && parsedBulkCount <= 50;
  const isBatch = trackingMode === "batch";
  const isSaving = batchSaving || isCreating;
  const instancesByIdForQr = useMemo(() => new Map(allInstances.map((i) => [i.id, i])), [allInstances]);
  const speciesByIdForQr = useMemo(() => new Map(speciesList.map((s) => [s.id, s])), [speciesList]);
  // Eén QR-code hoort bij precies één instance — bij bulkaanmaak (N>1 losse
  // individuele exemplaren) is er geen eenduidige ontvanger, dus is QR-
  // koppeling dan niet beschikbaar. Wissel je terug naar N=1 nadat je al een
  // code had gescand, dan blijft de koppeling gewoon beschikbaar.
  const qrEligible = isBatch || parsedBulkCount === 1;
  useEffect(() => {
    if (!qrEligible && qrCode) setQrCode(null);
  }, [qrEligible, qrCode]);
  const existingCountForSpecies = speciesId
    ? allInstances.filter((i) => i.species_id === speciesId).length
    : 0;
  const selectedSpecies =
    speciesList.find((s) => s.id === speciesId) ?? preselectedSpecies ?? null;
  // All existing custom_names for this species (active + archived) — used by
  // resolveInstanceNames to find the highest existing auto-number and avoid gaps.
  const existingNamesForSpecies: string[] = speciesId
    ? allInstances.filter((i) => i.species_id === speciesId).map((i) => i.custom_name ?? "")
    : [];
  // Pre-computed names for de bulk-individuele-aanmaak (niet van toepassing
  // op batch, die is altijd precies 1 registratie).
  const bulkNames: string[] =
    !isBatch && validBulkCount && parsedBulkCount > 1 && selectedSpecies
      ? resolveInstanceNames(selectedSpecies.name, existingNamesForSpecies, parsedBulkCount)
      : [];

  function selectSpecies(s: Plant) {
    setSpeciesId(s.id);
    if (!nameTouched) {
      const count = allInstances.filter((i) => i.species_id === s.id).length;
      setCustomName(isBatch ? suggestBatchName(s.name, seasonStartedAt) : suggestInstanceName(s.name, count));
    }
  }

  // Herberekent de voorgestelde naam wanneer de gebruiker van modus wisselt
  // (maar alleen als die nog niet zelf een naam heeft ingetikt) — zodat
  // "Courgette #2" meteen "Courgette — 12 aug" wordt zodra Batch gekozen
  // wordt, i.p.v. dat de gebruiker dat zelf moet aanpassen.
  function selectTrackingMode(mode: TrackingMode) {
    setTrackingMode(mode);
    if (!nameTouched && selectedSpecies) {
      setCustomName(
        mode === "batch"
          ? suggestBatchName(selectedSpecies.name, seasonStartedAt)
          : suggestInstanceName(selectedSpecies.name, existingCountForSpecies),
      );
    }
  }

  function resetForm() {
    setSpeciesId(preselectedSpecies?.id ?? null);
    setLocked(!!preselectedSpecies);
    setTrackingMode("individual");
    setCustomName(
      preselectedSpecies
        ? suggestInstanceName(preselectedSpecies.name, allInstances.filter((i) => i.species_id === preselectedSpecies.id).length)
        : "",
    );
    setNameTouched(false);
    setBulkCount("1");
    setLocation("");
    setCultivationType("");
    setIndoorOutdoor("");
    setPotSizeLiters("");
    setPotMaterial("");
    setPotColor("");
    setSoilType("");
    setSoilMixNotes("");
    setPlantedAt(new Date().toISOString().slice(0, 10));
    setAcquiredAt("");
    setSource("");
    setPrice("");
    setSeasonStartedAt(new Date().toISOString().slice(0, 10));
    setSeasonLabel("");
    setStartHeightInput("");
    setFormError(null);
    setBatchSaving(false);
    setQrCode(null);
    if (onClose) {
      onClose();
    } else {
      setOpen(!!preselectedSpecies);
    }
  }

  // De QR-koppeling zelf gebeurt bewust NA het aanmaken van de instance (pas
  // dan bestaat er een instance_id om aan te koppelen) — via dezelfde
  // assign_qr_label-RPC als Deel D, dus dezelfde databasegaranties tegen
  // dubbele koppelingen gelden hier ook. Mislukt de koppeling (bv. een race
  // met een andere sessie) dan bestaat het exemplaar al gewoon — de QR kan
  // daarna alsnog via het detailvenster gekoppeld worden.
  async function linkScannedQrIfAny(instanceId: string) {
    if (!qrCode) return;
    await assignLabel({ code: qrCode, instanceId });
  }

  async function handleSave() {
    if (isSavingRef.current) return;
    setFormError(null);
    if (!speciesId) { setFormError("Kies eerst een plantsoort."); return; }
    if (!seasonStartedAt) { setFormError("Vul een startdatum in."); return; }
    // Het bulkaantal is alleen van toepassing bij individuele registraties —
    // een batch is per definitie altijd precies 1 registratie, ongeacht
    // hoeveel fysieke planten erin blijken te zitten (dat wordt later apart
    // geteld, zie "Aantal bijwerken" in het detailvenster).
    if (!isBatch && !validBulkCount) {
      setFormError("Aantal moet een geheel getal zijn tussen 1 en 50.");
      return;
    }

    const trimmedHeight = startHeightInput.trim();
    const parsedStartHeight = trimmedHeight === "" ? 0 : Number(trimmedHeight);
    if (!Number.isFinite(parsedStartHeight) || parsedStartHeight < 0) {
      setFormError("Starthoogte moet 0 of een positief getal zijn.");
      return;
    }

    isSavingRef.current = true;

    const baseInput = {
      speciesId,
      plantName: selectedSpecies!.name,
      location: location.trim() || null,
      cultivationType: cultivationType || null,
      indoorOutdoor: indoorOutdoor || null,
      potSizeLiters: potSizeLiters ? Number(potSizeLiters) : null,
      potMaterial: potMaterial.trim() || null,
      potColor: potColor.trim() || null,
      soilType: soilType.trim() || null,
      soilMixNotes: soilMixNotes.trim() || null,
      plantedAt: plantedAt ? new Date(plantedAt).toISOString() : null,
      acquiredAt: acquiredAt || null,
      source: source.trim() || null,
      price: price ? Number(price) : null,
      seasonStartedAt,
      seasonLabel: seasonLabel.trim() || null,
      startHeightCm: parsedStartHeight,
    };

    if (isBatch) {
      // Eén registratie, quantity blijft bewust null ("nog niet geteld") —
      // de gebruiker hoeft bij het zaaien geen aantal zaailingen te kiezen,
      // dat gebeurt pas later via "Aantal bijwerken" in het detailvenster.
      let result: { instance_id: string } | undefined;
      try {
        result = await createInstanceWithSeason({
          ...baseInput,
          customName: customName.trim() || null,
          trackingMode: "batch",
          quantity: null,
        });
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Opslaan mislukt.");
        isSavingRef.current = false;
        return;
      }
      try {
        await linkScannedQrIfAny(result.instance_id);
      } catch (err) {
        toast.error(
          `Batch aangemaakt, maar QR-koppeling mislukt: ${err instanceof Error ? err.message : "onbekende fout"}. Je kunt de QR-code later alsnog koppelen via het exemplaar.`,
        );
        isSavingRef.current = false;
        resetForm();
        onCreated?.();
        return;
      }
      resetForm();
      onCreated?.();
      isSavingRef.current = false;
      return;
    }

    if (parsedBulkCount === 1) {
      let result: { instance_id: string } | undefined;
      try {
        result = await createInstanceWithSeason({
          ...baseInput,
          customName: customName.trim() || null,
          trackingMode: "individual",
          quantity: 1,
        });
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Opslaan mislukt.");
        isSavingRef.current = false;
        return;
      }
      try {
        await linkScannedQrIfAny(result.instance_id);
      } catch (err) {
        toast.error(
          `Exemplaar aangemaakt, maar QR-koppeling mislukt: ${err instanceof Error ? err.message : "onbekende fout"}. Je kunt de QR-code later alsnog koppelen via het exemplaar.`,
        );
        isSavingRef.current = false;
        resetForm();
        onCreated?.();
        return;
      }
      resetForm();
      onCreated?.();
      isSavingRef.current = false;
      return;
    }

    // Bulkaanmaak: maak N losse INDIVIDUELE exemplaren aan, ieder met een
    // eigen auto-naam en eigen UUID/groeiseizoen. bulkNames is pre-computed
    // (same array as the preview) so names are guaranteed identical between
    // what the user saw and what gets saved. Bestaande functionaliteit,
    // ongewijzigd t.o.v. vóór batch-tracking.
    setBatchSaving(true);
    let succeeded = 0;
    const bulkErrors: string[] = [];
    for (let i = 0; i < parsedBulkCount; i++) {
      try {
        await createInstanceWithSeason({
          ...baseInput,
          customName: bulkNames[i] ?? null,
          trackingMode: "individual",
          quantity: 1,
        });
        succeeded++;
      } catch (err) {
        bulkErrors.push(err instanceof Error ? err.message : "Onbekende fout");
      }
    }
    setBatchSaving(false);
    isSavingRef.current = false;

    if (bulkErrors.length > 0) {
      setFormError(
        `${succeeded} van ${parsedBulkCount} exemplaren aangemaakt. ${bulkErrors.length} mislukt: ${bulkErrors.slice(0, 2).join(" · ")}${bulkErrors.length > 2 ? " ..." : ""}`,
      );
      return;
    }

    resetForm();
    onCreated?.();
  }

  const isControlled = controlledOpen !== undefined;
  const effectiveOpen = isControlled ? controlledOpen! : open;

  if (isControlled && !effectiveOpen) return null;

  return (
    <div className={preselectedSpecies ? "space-y-3" : "sv-panel p-4 space-y-3"}>
      {!isControlled && !preselectedSpecies && !effectiveOpen ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="sv-button w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" /> Nieuw exemplaar planten
        </button>
      ) : (
        <div className="space-y-4">
          {!preselectedSpecies && <p className="sv-heading text-xl">Nieuw exemplaar planten</p>}

          <div className="space-y-1">
            <label className="text-xs sv-muted block mb-1">Plantsoort</label>
            {locked && preselectedSpecies ? (
              <div className="sv-inset rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  {preselectedSpecies.photo_url ? (
                    <img src={preselectedSpecies.photo_url} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                  ) : (
                    <Sprout className="h-4 w-4 shrink-0 sv-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm truncate">{preselectedSpecies.name}</p>
                    {(preselectedSpecies.species || preselectedSpecies.category) && (
                      <p className="text-xs sv-muted truncate">
                        {[preselectedSpecies.species, preselectedSpecies.category].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocked(false);
                    setSpeciesId(null);
                  }}
                  className="text-xs sv-muted underline shrink-0"
                >
                  Wijzig
                </button>
              </div>
            ) : (
              <SpeciesCombobox
                speciesList={speciesList}
                value={speciesId}
                onSelect={selectSpecies}
                autoFocusOpen={!!preselectedSpecies}
              />
            )}
          </div>

          {speciesId && (
            <>
              <div className="space-y-1.5">
                <p className="text-xs sv-muted font-medium uppercase tracking-wide">Registratietype</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => selectTrackingMode("individual")} className={chipClass(!isBatch)}>
                    Individuele plant
                  </button>
                  <button type="button" onClick={() => selectTrackingMode("batch")} className={chipClass(isBatch)}>
                    Batch (meerdere planten samen)
                  </button>
                </div>
                {isBatch && (
                  <p className="text-xs sv-muted">
                    Voor gewassen die je met veel tegelijk zaait (veldsla, rucola, radijs, kruiden...). Dit wordt
                    één registratie — het aantal opgekomen planten vul je later in, zodra je geteld hebt.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs sv-muted font-medium uppercase tracking-wide">QR-code (optioneel)</p>
                {qrEligible ? (
                  <QrScanAndLinkControl
                    value={qrCode}
                    onChange={setQrCode}
                    instancesById={instancesByIdForQr}
                    speciesById={speciesByIdForQr}
                  />
                ) : (
                  <p className="text-xs sv-muted">
                    Alleen beschikbaar als je precies 1 exemplaar aanmaakt — zet "Aantal exemplaren" op 1 om een
                    QR-code te koppelen.
                  </p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                {isBatch ? (
                  <div />
                ) : (
                  <div>
                    <label className="text-xs sv-muted block mb-1">Aantal exemplaren</label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      step="1"
                      value={bulkCount}
                      onChange={(e) => setBulkCount(e.target.value)}
                      className="text-sm"
                    />
                    {!validBulkCount && bulkCount !== "" && (
                      <p className="text-xs sv-destructive-text mt-1">Geheel getal tussen 1 en 50.</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs sv-muted block mb-1">Locatie</label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="bijv. Kas, dakterras..."
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs sv-muted block mb-1">
                    {!isBatch && parsedBulkCount > 1 ? "Namen (automatisch)" : "Herkenningsnaam"}
                  </label>
                  {!isBatch && parsedBulkCount > 1 && validBulkCount ? (
                    <div className="sv-inset rounded-lg px-3 py-2 text-sm sv-muted leading-snug">
                      {bulkNames.slice(0, 3).join(", ")}
                      {parsedBulkCount > 3 && ` ... ${bulkNames[bulkNames.length - 1]}`}
                    </div>
                  ) : (
                    <Input
                      value={customName}
                      onChange={(e) => {
                        setCustomName(e.target.value);
                        setNameTouched(true);
                      }}
                      className="text-sm"
                    />
                  )}
                </div>
                <div />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs sv-muted font-medium uppercase tracking-wide">Locatie</p>
                  <div className="flex flex-wrap gap-2">
                    {INDOOR_OUTDOOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setIndoorOutdoor((v) => (v === opt.value ? "" : opt.value))}
                        className={chipClass(indoorOutdoor === opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs sv-muted font-medium uppercase tracking-wide">Teeltwijze</p>
                  <div className="flex flex-wrap gap-2">
                    {CULTIVATION_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCultivationType((v) => (v === opt.value ? "" : opt.value))}
                        className={chipClass(cultivationType === opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {cultivationType === "pot" && (
                <div className="grid sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs sv-muted block mb-1">Potgrootte (L)</label>
                    <Input type="number" min="0" step="0.5" value={potSizeLiters} onChange={(e) => setPotSizeLiters(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs sv-muted block mb-1">Potmateriaal</label>
                    <Input value={potMaterial} onChange={(e) => setPotMaterial(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs sv-muted block mb-1">Potkleur</label>
                    <Input value={potColor} onChange={(e) => setPotColor(e.target.value)} className="text-sm" />
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs sv-muted block mb-1">Grondsoort</label>
                  <Input value={soilType} onChange={(e) => setSoilType(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs sv-muted block mb-1">Grondmengsel notities</label>
                  <Input value={soilMixNotes} onChange={(e) => setSoilMixNotes(e.target.value)} className="text-sm" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs sv-muted block mb-1">Plantdatum</label>
                  <Input type="date" value={plantedAt} onChange={(e) => setPlantedAt(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs sv-muted block mb-1">Aankoopdatum</label>
                  <Input type="date" value={acquiredAt} onChange={(e) => setAcquiredAt(e.target.value)} className="text-sm" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs sv-muted block mb-1">Herkomst</label>
                  <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="bijv. tuincentrum..." className="text-sm" />
                </div>
                <div>
                  <label className="text-xs sv-muted block mb-1">Prijs (€)</label>
                  <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs sv-muted font-medium uppercase tracking-wide">Eerste seizoen</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs sv-muted block mb-1">Startdatum</label>
                    <Input type="date" value={seasonStartedAt} onChange={(e) => setSeasonStartedAt(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs sv-muted block mb-1">Seizoenslabel (optioneel)</label>
                    <Input
                      value={seasonLabel}
                      onChange={(e) => setSeasonLabel(e.target.value)}
                      placeholder={`Seizoen ${new Date(seasonStartedAt).getFullYear()}`}
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs sv-muted block mb-1">
                      {isBatch ? "Gem. starthoogte batch (cm)" : "Starthoogte (cm)"}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={startHeightInput}
                      onChange={(e) => setStartHeightInput(e.target.value)}
                      placeholder="bijv. 25"
                      className="text-sm"
                    />
                    <p className="text-xs sv-muted mt-0.5">Laat leeg om automatisch met 0 cm te starten.</p>
                    {(startHeightInput.trim() === "" || startHeightInput.trim() === "0") && (
                      <p className="text-xs sv-muted mt-1">
                        🌿 Wordt aangemaakt als zaailing
                        {isBatch
                          ? " — vul het aantal opgekomen planten later in via \"Aantal bijwerken\"."
                          : " — later om te zetten naar definitieve exemplaren."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {formError && <p className="text-xs sv-destructive-text">{formError}</p>}

          <div className="flex gap-2 items-center flex-wrap">
            <Button
              size="sm"
              className="sv-button"
              onClick={handleSave}
              disabled={isSaving || !speciesId || (!isBatch && !validBulkCount)}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isBatch ? (
                "Batch opslaan"
              ) : parsedBulkCount > 1 ? (
                `${parsedBulkCount} exemplaren opslaan`
              ) : (
                "Opslaan"
              )}
            </Button>
            <Button
              size="sm"
              className="sv-button sv-button-ghost"
              onClick={() => {
                resetForm();
                if (preselectedSpecies) onCreated?.();
              }}
              disabled={isSaving}
            >
              Annuleer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Teelt afronden ─────────────────────────────────────────────────────────

const SEASON_CLOSING_REASONS = [
  "Seizoen afgelopen",
  "Oogst afgerond",
  "Plant afgestorven",
  "Ziekte of plaag",
  "Plant verwijderd",
  "Anders",
];

function CompleteSeasonPanel({
  season,
  instance,
  species,
  onClose,
}: {
  season: GrowingSeason;
  instance: PlantInstance;
  species?: Plant;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"completed" | "failed">("completed");
  const [endedAt, setEndedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [nextStep, setNextStep] = useState<"new_season" | "archive" | "dormant" | "later">("later");
  const [error, setError] = useState<string | null>(null);
  const { completeSeason, isCompletingSeason, startNewSeason, archiveInstance, setInstanceDormant } = usePlantInstances();

  async function handleConfirm() {
    setError(null);
    try {
      await completeSeason({
        seasonId: season.id,
        status,
        endedAt,
        closingReason: reason || null,
        closingNotes: notes.trim() || null,
      });
      if (nextStep === "new_season") {
        await startNewSeason({ plantInstanceId: instance.id, startedAt: new Date().toISOString().slice(0, 10), label: null });
      } else if (nextStep === "archive") {
        await archiveInstance(instance.id);
      } else if (nextStep === "dormant") {
        await setInstanceDormant(instance.id);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Afronden mislukt.");
    }
  }

  return (
    <div className="sv-inset p-4 space-y-3 rounded-xl">
      <p className="sv-heading text-lg">Teelt afronden — {season.label ?? `Seizoen ${season.year}`}</p>

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs sv-muted block mb-1">Einddatum</label>
          <Input type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs sv-muted block mb-1">Eindstatus</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStatus("completed")} className={chipClass(status === "completed")}>Afgerond</button>
            <button type="button" onClick={() => setStatus("failed")} className={chipClass(status === "failed")}>Mislukt</button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs sv-muted block mb-1">Reden</p>
        <div className="flex flex-wrap gap-2">
          {SEASON_CLOSING_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason((v) => (v === r ? "" : r))} className={chipClass(reason === r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <Textarea placeholder="Eindnotitie (optioneel)..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm resize-none" />

      <div className="space-y-1.5">
        <p className="text-xs sv-muted block mb-1">Wat gebeurt er met dit exemplaar?</p>
        {species?.lifecycle === "Meerjarig" && (
          <p className="text-xs sv-muted sv-inset rounded-lg px-3 py-2">
            💡 <strong>Advies:</strong> Dit is een meerjarige plant. In de meeste gevallen blijft hetzelfde exemplaar leven en kun je na een rustperiode een nieuw teeltseizoen starten.
          </p>
        )}
        {species?.lifecycle === "Eenjarig" && (
          <p className="text-xs sv-muted sv-inset rounded-lg px-3 py-2">
            💡 <strong>Advies:</strong> Dit is een eenjarige plant. Na afloop van het seizoen wordt het exemplaar meestal gearchiveerd. Start alleen een nieuw seizoen wanneer dit daadwerkelijk dezelfde levende plant betreft.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setNextStep("new_season")} className={chipClass(nextStep === "new_season")}>Nieuw seizoen starten</button>
          <button type="button" onClick={() => setNextStep("archive")} className={chipClass(nextStep === "archive")}>Exemplaar archiveren</button>
          <button type="button" onClick={() => setNextStep("dormant")} className={chipClass(nextStep === "dormant")}>Plant in rust zetten</button>
          <button type="button" onClick={() => setNextStep("later")} className={chipClass(nextStep === "later")}>Later beslissen</button>
        </div>
      </div>

      {error && <p className="text-xs sv-destructive-text">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" className="sv-button" onClick={handleConfirm} disabled={isCompletingSeason}>
          {isCompletingSeason ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bevestigen"}
        </Button>
        <Button size="sm" className="sv-button sv-button-ghost" onClick={onClose} disabled={isCompletingSeason}>
          Annuleer
        </Button>
      </div>
    </div>
  );
}

// ─── InstanceSettingsSection component ─────────────────────────────────────
// Full instance edit form (name, location, pot/soil, dates, status, health,
// reminders) — everything on plant_instances that a user might reasonably
// want to correct after creation, all written via the same generic
// patchInstance() used everywhere else in this dialog. There is no
// per-instance water/feeding interval override field on plant_instances
// (intervals come from the species advice, see plantInstanceStatus.ts), so
// that part of the spec's optional list is intentionally not present here.

function InstanceSettingsSection({
  instance,
  onSave,
  isSaving,
}: {
  instance: PlantInstance;
  onSave: (patch: Record<string, unknown>) => void;
  isSaving: boolean;
}) {
  const [customName, setCustomName] = useState(instance.custom_name ?? "");
  const [location, setLocation] = useState(instance.location ?? "");
  const [cultivationType, setCultivationType] = useState<CultivationType | "">(instance.cultivation_type ?? "");
  const [indoorOutdoor, setIndoorOutdoor] = useState<IndoorOutdoorType | "">(instance.indoor_outdoor ?? "");
  const [potSizeLiters, setPotSizeLiters] = useState(instance.pot_size_liters?.toString() ?? "");
  const [potMaterial, setPotMaterial] = useState(instance.pot_material ?? "");
  const [potColor, setPotColor] = useState(instance.pot_color ?? "");
  const [soilType, setSoilType] = useState(instance.soil_type ?? "");
  const [soilMixNotes, setSoilMixNotes] = useState(instance.soil_mix_notes ?? "");
  const [plantedAt, setPlantedAt] = useState(instance.planted_at ? instance.planted_at.slice(0, 10) : "");
  const [acquiredAt, setAcquiredAt] = useState(instance.acquired_at ?? "");
  const [source, setSource] = useState(instance.source ?? "");
  const [price, setPrice] = useState(instance.price?.toString() ?? "");
  const [status, setStatus] = useState(instance.status);
  const [healthStatus, setHealthStatus] = useState(instance.health_status ?? "");
  const [remindersEnabled, setRemindersEnabled] = useState(instance.reminders_enabled);
  const [feedingRemindersEnabled, setFeedingRemindersEnabled] = useState(instance.feeding_reminders_enabled);

  function handleSave() {
    onSave({
      custom_name: customName.trim() || null,
      location: location.trim() || null,
      cultivation_type: cultivationType || null,
      indoor_outdoor: indoorOutdoor || null,
      pot_size_liters: potSizeLiters.trim() ? Number(potSizeLiters) : null,
      pot_material: potMaterial.trim() || null,
      pot_color: potColor.trim() || null,
      soil_type: soilType.trim() || null,
      soil_mix_notes: soilMixNotes.trim() || null,
      planted_at: plantedAt ? new Date(plantedAt).toISOString() : null,
      acquired_at: acquiredAt || null,
      source: source.trim() || null,
      price: price.trim() ? Number(price) : null,
      status,
      health_status: healthStatus || null,
      reminders_enabled: remindersEnabled,
      feeding_reminders_enabled: feedingRemindersEnabled,
    });
  }

  return (
    <div className="sv-inset p-4 space-y-4 rounded-xl">
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs sv-muted block mb-1">Herkenningsnaam</label>
          <Input value={customName} onChange={(e) => setCustomName(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs sv-muted block mb-1">Locatie</label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} className="text-sm" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-xs sv-muted font-medium uppercase tracking-wide">Locatie</p>
          <div className="flex flex-wrap gap-2">
            {INDOOR_OUTDOOR_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setIndoorOutdoor((v) => (v === opt.value ? "" : opt.value))} className={chipClass(indoorOutdoor === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs sv-muted font-medium uppercase tracking-wide">Teeltwijze</p>
          <div className="flex flex-wrap gap-2">
            {CULTIVATION_TYPE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setCultivationType((v) => (v === opt.value ? "" : opt.value))} className={chipClass(cultivationType === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        <div>
          <label className="text-xs sv-muted block mb-1">Potgrootte (L)</label>
          <Input type="number" min="0" value={potSizeLiters} onChange={(e) => setPotSizeLiters(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs sv-muted block mb-1">Potmateriaal</label>
          <Input value={potMaterial} onChange={(e) => setPotMaterial(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs sv-muted block mb-1">Potkleur</label>
          <Input value={potColor} onChange={(e) => setPotColor(e.target.value)} className="text-sm" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs sv-muted block mb-1">Grondsoort</label>
          <Input value={soilType} onChange={(e) => setSoilType(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs sv-muted block mb-1">Grondmengsel notitie</label>
          <Input value={soilMixNotes} onChange={(e) => setSoilMixNotes(e.target.value)} className="text-sm" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs sv-muted block mb-1">Geplant / gezaaid op</label>
          <Input type="date" value={plantedAt} onChange={(e) => setPlantedAt(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs sv-muted block mb-1">Verkregen op</label>
          <Input type="date" value={acquiredAt} onChange={(e) => setAcquiredAt(e.target.value)} className="text-sm" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs sv-muted block mb-1">Bron</label>
          <Input value={source} onChange={(e) => setSource(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs sv-muted block mb-1">Prijs (€)</label>
          <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs sv-muted font-medium uppercase tracking-wide">Status</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(INSTANCE_STATUS_LABELS) as PlantInstance["status"][]).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={chipClass(status === s)}>
              {INSTANCE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs sv-muted font-medium uppercase tracking-wide">Gezondheid</p>
        <div className="flex flex-wrap gap-2">
          {HEALTH_STATUS_OPTIONS.map((opt) => (
            <button key={opt} type="button" onClick={() => setHealthStatus((v) => (v === opt ? "" : opt))} className={chipClass(healthStatus === opt)}>
              {HEALTH_STATUS_EMOJI[opt]} {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs sv-muted font-medium uppercase tracking-wide">Herinneringen</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRemindersEnabled((v) => !v)} className={chipClass(remindersEnabled)}>
            💧 Waterherinneringen {remindersEnabled ? "aan" : "uit"}
          </button>
          <button type="button" onClick={() => setFeedingRemindersEnabled((v) => !v)} className={chipClass(feedingRemindersEnabled)}>
            🌿 Voedingsherinneringen {feedingRemindersEnabled ? "aan" : "uit"}
          </button>
        </div>
      </div>

      <Button size="sm" className="sv-button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Instellingen opslaan"}
      </Button>
    </div>
  );
}

// ─── Seedling conversion dialog ─────────────────────────────────────────────

function SeedlingConversionDialog({
  instance,
  species,
  onClose,
  onConverted,
}: {
  instance: PlantInstance;
  species: Plant | undefined;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [count, setCount] = useState("1");
  const [seasonStartedAt, setSeasonStartedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [startHeightInput, setStartHeightInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: allInstances = [] } = useQuery({
    queryKey: ["plant_instances", "all"],
    queryFn: fetchPlantInstances,
  });
  const { convertSeedling, isConverting } = usePlantInstances();

  const parsedCount = parseInt(count, 10);
  const validCount = Number.isInteger(parsedCount) && parsedCount >= 1;
  const parsedHeight = startHeightInput.trim() === "" ? 0 : Number(startHeightInput.trim());
  const validHeight = Number.isFinite(parsedHeight) && parsedHeight >= 0;

  const existingNamesForSpecies = useMemo(
    () =>
      allInstances
        .filter((i) => i.species_id === instance.species_id && i.id !== instance.id)
        .map((i) => i.custom_name ?? ""),
    [allInstances, instance.species_id, instance.id],
  );

  const batchNames = useMemo(() => {
    if (!validCount || !species) return [];
    return resolveInstanceNames(species.name, existingNamesForSpecies, parsedCount);
  }, [validCount, species, existingNamesForSpecies, parsedCount]);

  async function handleConvert() {
    if (!validCount || !validHeight || !species) return;
    setError(null);
    try {
      await convertSeedling({
        seedlingId: instance.id,
        customNames: batchNames,
        plantName: species.name,
        seasonStartedAt,
        startHeightCm: parsedHeight,
      });
      onConverted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Omzetten mislukt.");
    }
  }

  const displayName = plantInstanceDisplayName(instance, species);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={PLANT_DIALOG_CONTENT_CLASS}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            {species?.photo_url ? (
              <img src={species.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 sv-icon-slot" />
            ) : (
              <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
                <Sprout className="h-5 w-5" strokeWidth={1.6} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className={`${PLANT_DIALOG_TITLE_CLASS} truncate`}>{displayName}</DialogTitle>
              <p className="text-sm sv-muted">Zaailing uitplanten</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm sv-muted">
            Dit exemplaar wordt omgezet naar definitieve plantexemplaren. De zaailing zelf wordt verwijderd.
          </p>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs sv-muted block mb-1">Aantal nieuwe exemplaren</label>
              <Input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs sv-muted block mb-1">Seizoen startdatum</label>
              <Input
                type="date"
                value={seasonStartedAt}
                onChange={(e) => setSeasonStartedAt(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs sv-muted block mb-1">Starthoogte nieuwe exemplaren (cm)</label>
            <Input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={startHeightInput}
              onChange={(e) => setStartHeightInput(e.target.value)}
              placeholder="0"
              className="text-sm"
            />
          </div>

          {validCount && batchNames.length > 0 && (
            <div className="sv-inset rounded-xl p-3 space-y-1">
              <p className="text-xs sv-muted font-medium">Nieuwe namen:</p>
              {batchNames.map((n) => (
                <p key={n} className="text-sm">{n}</p>
              ))}
            </div>
          )}

          {error && <p className="text-xs sv-destructive-text">{error}</p>}
        </div>

        <DialogFooter>
          <Button size="sm" variant="ghost" className="sv-button sv-button-ghost" onClick={onClose} disabled={isConverting}>
            Annuleren
          </Button>
          <Button
            size="sm"
            className="sv-button"
            onClick={handleConvert}
            disabled={isConverting || !validCount || !validHeight}
          >
            {isConverting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `${validCount ? parsedCount : 1} exemplaar${parsedCount !== 1 ? "en" : ""} uitplanten`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Batch quantity dialog ──────────────────────────────────────────────────
// Enige plek in de UI die plant_instances.quantity wijzigt — altijd via
// updateInstanceQuantity (usePlantInstances.ts), dat atomisch ook een
// growth_log_entries-historierij wegschrijft. Geen tweede opslagroute: niet
// de generieke Instellingen-patch, geen losse Supabase-call hier.
function BatchQuantityDialog({
  instance,
  species,
  activeSeason,
  onClose,
}: {
  instance: PlantInstance;
  species: Plant | undefined;
  activeSeason: GrowingSeason | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState(instance.quantity !== null ? String(instance.quantity) : "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { updateInstanceQuantity, isUpdatingQuantity } = usePlantInstances();

  const trimmed = value.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 0);

  async function handleSave() {
    if (!valid) {
      setError("Aantal moet leeg zijn (nog niet geteld) of een geheel getal van 0 of hoger.");
      return;
    }
    setError(null);
    try {
      await updateInstanceQuantity({
        instanceId: instance.id,
        quantity: parsed,
        notes: notes.trim() || null,
        growingSeasonId: activeSeason?.id ?? null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bijwerken mislukt.");
    }
  }

  const displayName = plantInstanceDisplayName(instance, species);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={PLANT_DIALOG_CONTENT_CLASS}>
        <DialogHeader>
          <DialogTitle className={PLANT_DIALOG_TITLE_CLASS}>{displayName}</DialogTitle>
          <p className="text-sm sv-muted">Aantal planten bijwerken · nu: {describeInstanceQuantity(instance)}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs sv-muted block mb-1">Aantal planten</label>
            <Input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="bijv. 21"
              className="text-sm"
            />
            <p className="text-xs sv-muted mt-1">Laat leeg als je het aantal nog niet hebt geteld.</p>
          </div>
          <div>
            <label className="text-xs sv-muted block mb-1">Notitie (optioneel)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="bijv. na dunnen, uitval door slakken..."
              className="text-sm"
            />
          </div>
          {error && <p className="text-xs sv-destructive-text">{error}</p>}
        </div>

        <DialogFooter>
          <Button size="sm" variant="ghost" className="sv-button sv-button-ghost" onClick={onClose} disabled={isUpdatingQuantity}>
            Annuleren
          </Button>
          <Button size="sm" className="sv-button" onClick={handleSave} disabled={isUpdatingQuantity || !valid}>
            {isUpdatingQuantity ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Instance detail dialog ─────────────────────────────────────────────────

function PlantInstanceDetailDialog({
  instance,
  species,
  activeSeason,
  allInstances,
  speciesById,
  onClose,
}: {
  instance: PlantInstance;
  species: Plant | undefined;
  activeSeason: GrowingSeason | null;
  allInstances: PlantInstance[];
  speciesById: Map<string, Plant>;
  onClose: () => void;
}) {
  const [closingSeason, setClosingSeason] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [pruningOpen, setPruningOpen] = useState(false);
  const [repotOpen, setRepotOpen] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [groeifotosOpen, setGroeifotosOpen] = useState(false);
  const [quickPhotoCaptureOpen, setQuickPhotoCaptureOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const name = plantInstanceDisplayName(instance, species);
  const { patchInstance } = usePlantInstances();
  const { recordWatering, recordFeeding, recordingWaterId, recordingFeedId, error: careError } = useRecordInstanceCare({ patchInstance });
  const queryClient = useQueryClient();

  const { data: seasons = [] } = useQuery({
    queryKey: ["growing_seasons", instance.id],
    queryFn: () => fetchGrowingSeasons(instance.id),
  });
  const { getEntriesForGrowingSeason, getEntriesForPlantInstance } = useGrowthLog();
  const { getPhotosForInstance, deletePhoto: deleteGrowthPhoto } = useGrowthPhotos();
  const {
    getActiveAssignmentForInstance,
    getLabelById,
    assignLabel,
    releaseLabel,
    isAssigningLabel,
    isReleasingLabel,
  } = useQrLabels();
  const [qrLinkFormOpen, setQrLinkFormOpen] = useState(false);
  const [pendingQrCode, setPendingQrCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [confirmUnlinkQrOpen, setConfirmUnlinkQrOpen] = useState(false);
  const activeQrAssignment = getActiveAssignmentForInstance(instance.id);
  const activeQrLabel = activeQrAssignment ? getLabelById(activeQrAssignment.qr_label_id) : null;
  const instancesByIdForQr = useMemo(() => new Map(allInstances.map((i) => [i.id, i])), [allInstances]);

  // Werkt zowel voor "eerste keer koppelen" als "vervangen": eerst een
  // eventuele bestaande actieve koppeling vrijgeven (no-op als er nog geen
  // was) en dan pas de nieuwe koppeling leggen — nooit in één stap
  // "overschrijven", want assign_qr_label weigert een tweede actieve label
  // op dezelfde instance (databaseconstraint), dus vervangen moet altijd via
  // release-dan-assign, precies zoals hier.
  async function handleLinkPendingQr() {
    if (!pendingQrCode) return;
    setQrError(null);
    try {
      if (activeQrAssignment) await releaseLabel(instance.id);
      await assignLabel({ code: pendingQrCode, instanceId: instance.id });
      setPendingQrCode(null);
      setQrLinkFormOpen(false);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "Koppelen mislukt.");
    }
  }

  async function handleUnlinkQr() {
    setQrError(null);
    setConfirmUnlinkQrOpen(false);
    try {
      await releaseLabel(instance.id);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "Ontkoppelen mislukt.");
    }
  }

  const { data: harvestLogs = [] } = useQuery({
    queryKey: ["plant_harvest_logs", "instance", instance.id],
    queryFn: () => fetchHarvestLogsForInstance(instance.id),
  });
  const { data: pruningLogs = [] } = useQuery({
    queryKey: ["plant_pruning_logs", "instance", instance.id],
    queryFn: () => fetchPruningLogsForInstance(instance.id),
  });
  const { data: repotLogs = [] } = useQuery({
    queryKey: ["plant_repot_logs", "instance", instance.id],
    queryFn: () => fetchRepotLogsForInstance(instance.id),
  });
  const { data: inspectionLogs = [] } = useQuery({
    queryKey: ["plant_inspection_logs", "instance", instance.id],
    queryFn: () => fetchInspectionLogsForInstance(instance.id),
  });

  const addHarvestLog = useMutation({
    mutationFn: async (row: { plant_id: string; plant_instance_id?: string; growing_season_id?: string | null; harvested_at: string; weight_grams: number | null; quantity: number | null; unit: string | null; notes: string | null }) => {
      const { error } = await supabase.from("plant_harvest_logs").insert(row);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plant_harvest_logs", "instance", instance.id] }),
  });
  const deleteHarvestLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plant_harvest_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plant_harvest_logs", "instance", instance.id] }),
  });

  const addPruningLog = useMutation({
    mutationFn: async (row: { plant_id: string; plant_instance_id?: string; growing_season_id?: string | null; pruned_at: string; pruning_type: string | null; notes: string | null }) => {
      const { error } = await supabase.from("plant_pruning_logs").insert(row);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plant_pruning_logs", "instance", instance.id] }),
  });
  const deletePruningLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plant_pruning_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plant_pruning_logs", "instance", instance.id] }),
  });

  const addRepotLog = useMutation({
    mutationFn: async (row: { plant_id: string; plant_instance_id?: string; growing_season_id?: string | null; repotted_at: string; old_pot_size_liters: number | null; new_pot_size_liters: number | null; pot_material: string | null; soil_type: string | null; notes: string | null }) => {
      const { error } = await supabase.from("plant_repot_logs").insert(row);
      if (error) throw error;
      if (row.new_pot_size_liters !== null) {
        await patchInstance({ id: instance.id, patch: { last_repotted_at: row.repotted_at, pot_size_liters: row.new_pot_size_liters } });
      } else {
        await patchInstance({ id: instance.id, patch: { last_repotted_at: row.repotted_at } });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plant_repot_logs", "instance", instance.id] }),
  });
  const deleteRepotLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plant_repot_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plant_repot_logs", "instance", instance.id] }),
  });

  const addInspectionLog = useMutation({
    mutationFn: async (row: { plant_instance_id: string; growing_season_id?: string | null; checked_at: string; health_status: string | null; notes: string | null; issues: string | null; action_taken: string | null; photo_url: string | null }) => {
      const { error } = await supabase.from("plant_inspection_logs").insert(row);
      if (error) throw error;
      if (row.health_status) {
        await patchInstance({ id: instance.id, patch: { health_status: row.health_status, last_checked_at: row.checked_at } });
      } else {
        await patchInstance({ id: instance.id, patch: { last_checked_at: row.checked_at } });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plant_inspection_logs", "instance", instance.id] }),
  });
  const deleteInspectionLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plant_inspection_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plant_inspection_logs", "instance", instance.id] }),
  });

  const pastSeasons = seasons.filter((s) => s.id !== activeSeason?.id);

  return (
    <>
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={PLANT_DIALOG_CONTENT_CLASS}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            {species?.photo_url ? (
              <img src={species.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 sv-icon-slot" />
            ) : (
              <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
                <Sprout className="h-5 w-5" strokeWidth={1.6} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className={`${PLANT_DIALOG_TITLE_CLASS} truncate`}>{name}</DialogTitle>
              {species && species.name !== name && <p className="text-sm sv-muted truncate">{species.name}</p>}
            </div>
            {instance.health_status && (
              <span className="sv-heading inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full sv-badge-ok shrink-0">
                {HEALTH_STATUS_EMOJI[instance.health_status]} {instance.health_status}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {instance.location && <p className="text-sm sv-muted">📍 {instance.location}</p>}

          {activeSeason && (
            <p className="text-sm sv-muted">
              Actief seizoen: <span className="text-foreground">{activeSeason.label ?? `Seizoen ${activeSeason.year}`}</span>
              {" · "}
              {activeSeason.status === "active" ? "Actief" : activeSeason.status === "completed" ? "Afgerond" : "Mislukt"}
            </p>
          )}

          {instance.tracking_mode === "batch" && (
            <>
              <div className="sv-panel p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="sv-heading text-lg flex items-center gap-1.5">
                    <Layers className="h-4 w-4" aria-hidden /> {TRACKING_MODE_LABELS.batch}
                  </p>
                  <p className="text-sm sv-muted">{describeInstanceQuantity(instance)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="sv-button sv-button-thin-border"
                  onClick={() => setQuantityDialogOpen(true)}
                >
                  Aantal bijwerken
                </Button>
              </div>
              {quantityDialogOpen && (
                <BatchQuantityDialog
                  instance={instance}
                  species={species}
                  activeSeason={activeSeason}
                  onClose={() => setQuantityDialogOpen(false)}
                />
              )}
            </>
          )}

          {instance.health_status === "Zaailing" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="sv-button sv-button-thin-border w-full"
                onClick={() => setConvertOpen(true)}
              >
                <Sprout className="h-3.5 w-3.5" /> Zaailing uitplanten
              </Button>
              {convertOpen && (
                <SeedlingConversionDialog
                  instance={instance}
                  species={species}
                  onClose={() => setConvertOpen(false)}
                  onConverted={() => { setConvertOpen(false); onClose(); }}
                />
              )}
            </>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="sv-button sv-button-thin-border text-xl"
              onClick={() => patchInstance({ id: instance.id, patch: { last_checked_at: new Date().toISOString().slice(0, 10) } })}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />{" "}
              {checkedLabel(instance.last_checked_at) ?? "Plant gecontroleerd"}
            </Button>
            <FirstEventButton
              label="Eerste bloem"
              emoji="🌸"
              value={instance.first_flower_at}
              isSaving={false}
              onSave={(date) => patchInstance({ id: instance.id, patch: { first_flower_at: date } })}
              onDelete={() => patchInstance({ id: instance.id, patch: { first_flower_at: null } })}
            />
            <FirstEventButton
              label="Eerste vrucht"
              emoji="🍅"
              value={instance.first_fruit_at}
              isSaving={false}
              onSave={(date) => patchInstance({ id: instance.id, patch: { first_fruit_at: date } })}
              onDelete={() => patchInstance({ id: instance.id, patch: { first_fruit_at: null } })}
            />
          </div>

          {careError && <p className="text-xs sv-destructive-text">{careError}</p>}

          {species && (
            <>
              <WaterSection
                plant={species}
                instanceState={{
                  id: instance.id,
                  name,
                  last_watered_at: instance.last_watered_at,
                  last_fed_at: instance.last_fed_at,
                  water_skip_until: instance.water_skip_until,
                  cultivation_type: instance.cultivation_type,
                }}
                onRecordWatering={(note) => recordWatering(instance, name, activeSeason?.id ?? null, note)}
                isUpdating={false}
                isRecording={recordingWaterId === instance.id}
              />

              <FeedingSection
                plant={species}
                instanceState={{
                  id: instance.id,
                  name,
                  last_watered_at: instance.last_watered_at,
                  last_fed_at: instance.last_fed_at,
                  water_skip_until: instance.water_skip_until,
                  cultivation_type: instance.cultivation_type,
                }}
                onRecordFeeding={(note) => recordFeeding(instance, name, activeSeason?.id ?? null, note)}
                isUpdating={false}
                isRecording={recordingFeedId === instance.id}
              />
            </>
          )}

          {activeSeason && (
            <PlantLogboek
              plantName={name}
              plantInstanceId={instance.id}
              growingSeasonId={activeSeason.id}
              isBatch={instance.tracking_mode === "batch"}
            />
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setHarvestOpen((o) => !o)}
              className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2"><Apple className="h-4 w-4" /> Oogst</span>
              {harvestOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {harvestOpen && (
              <HarvestLogSection
                plantId={instance.species_id}
                plantInstanceId={instance.id}
                growingSeasonId={activeSeason?.id ?? null}
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
              <span className="flex items-center gap-2"><Scissors className="h-4 w-4" /> Snoeien</span>
              {pruningOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {pruningOpen && (
              <PruningLogSection
                plantId={instance.species_id}
                plantInstanceId={instance.id}
                growingSeasonId={activeSeason?.id ?? null}
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
              <span className="flex items-center gap-2"><Boxes className="h-4 w-4" /> Verpotten</span>
              {repotOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {repotOpen && (
              <RepotLogSection
                plant={instance}
                plantInstanceId={instance.id}
                growingSeasonId={activeSeason?.id ?? null}
                legacyPlantId={instance.species_id}
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
              onClick={() => setInspectionOpen((o) => !o)}
              className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Inspecties</span>
              {inspectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {inspectionOpen && (
              <InspectionLogSection
                plantInstanceId={instance.id}
                growingSeasonId={activeSeason?.id ?? null}
                logs={inspectionLogs}
                onAdd={(row) => addInspectionLog.mutate(row)}
                onDelete={(id) => deleteInspectionLog.mutate(id)}
                isSaving={addInspectionLog.isPending}
              />
            )}
          </div>

          <div className="space-y-3">
            {quickPhotoCaptureOpen ? (
              <div className="sv-inset p-4 rounded-xl">
                <QuickGrowthPhotoCapture
                  instance={instance}
                  species={species}
                  growingSeasonId={activeSeason?.id ?? null}
                  onSaved={() => {
                    setQuickPhotoCaptureOpen(false);
                    setGroeifotosOpen(true);
                  }}
                />
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                className="sv-button w-full"
                onClick={() => setQuickPhotoCaptureOpen(true)}
              >
                <Camera className="h-4 w-4" /> Groeifoto maken
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setGroeifotosOpen((o) => !o)}
              className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2"><Camera className="h-4 w-4" /> Groeifoto's</span>
              {groeifotosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {groeifotosOpen && (
              <div className="sv-inset p-4 rounded-xl space-y-2">
                {instance.derived_from_instance_id && (
                  <p className="text-xs sv-muted">
                    Inclusief foto's en metingen uit de zaailingfase (vóór uitplanten).
                  </p>
                )}
                <GrowthPhotoTimeline
                  entries={[
                    ...getEntriesForPlantInstance(instance.id),
                    ...(instance.derived_from_instance_id
                      ? getEntriesForPlantInstance(instance.derived_from_instance_id)
                      : []),
                  ]}
                  photos={[
                    ...getPhotosForInstance(instance.id),
                    ...(instance.derived_from_instance_id
                      ? getPhotosForInstance(instance.derived_from_instance_id)
                      : []),
                  ]}
                  onDeletePhoto={(photo) => deleteGrowthPhoto(photo)}
                  showLightbox
                  sortDir="desc"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs sv-muted font-medium uppercase tracking-wide flex items-center gap-2">
              <QrCode className="h-3.5 w-3.5" /> QR-code
            </p>
            {activeQrLabel ? (
              <div className="sv-inset rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{activeQrLabel.note ?? "Gekoppeld QR-label"}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setQrError(null);
                        setQrLinkFormOpen((o) => !o);
                      }}
                      className="text-xs sv-muted underline"
                    >
                      Vervangen
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmUnlinkQrOpen(true)}
                      className="text-xs sv-destructive-text underline"
                    >
                      Ontkoppelen
                    </button>
                  </div>
                </div>
                {qrLinkFormOpen && (
                  <div className="space-y-2 pt-2 border-t border-black/10">
                    <p className="text-xs sv-muted">Scan de nieuwe QR-code om de huidige koppeling te vervangen.</p>
                    <QrScanAndLinkControl
                      value={pendingQrCode}
                      onChange={setPendingQrCode}
                      instancesById={instancesByIdForQr}
                      speciesById={speciesById}
                      ignoreLinkedToInstanceId={instance.id}
                      disabled={isAssigningLabel || isReleasingLabel}
                    />
                    {pendingQrCode && (
                      <div className="flex gap-2">
                        <Button size="sm" className="sv-button" onClick={handleLinkPendingQr} disabled={isAssigningLabel || isReleasingLabel}>
                          {isAssigningLabel || isReleasingLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vervangen bevestigen"}
                        </Button>
                        <Button size="sm" variant="ghost" className="sv-button sv-button-ghost" onClick={() => { setPendingQrCode(null); setQrLinkFormOpen(false); }}>
                          Annuleren
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : qrLinkFormOpen ? (
              <div className="sv-inset rounded-xl p-3 space-y-2">
                <QrScanAndLinkControl
                  value={pendingQrCode}
                  onChange={setPendingQrCode}
                  instancesById={instancesByIdForQr}
                  speciesById={speciesById}
                  disabled={isAssigningLabel}
                />
                {pendingQrCode && (
                  <div className="flex gap-2">
                    <Button size="sm" className="sv-button" onClick={handleLinkPendingQr} disabled={isAssigningLabel}>
                      {isAssigningLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Koppelen bevestigen"}
                    </Button>
                    <Button size="sm" variant="ghost" className="sv-button sv-button-ghost" onClick={() => { setPendingQrCode(null); setQrLinkFormOpen(false); }}>
                      Annuleren
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="sv-button sv-button-thin-border w-full"
                onClick={() => { setQrError(null); setQrLinkFormOpen(true); }}
              >
                <QrCode className="h-4 w-4" /> QR-code koppelen
              </Button>
            )}
            {qrError && <p className="text-xs sv-destructive-text">{qrError}</p>}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Geschiedenis</span>
              {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {historyOpen && (
              <div className="sv-inset p-4 rounded-xl space-y-3">
                {seasons.length === 0 ? (
                  <p className="text-sm sv-muted">Nog geen seizoenen.</p>
                ) : (
                  [...seasons]
                    .sort((a, b) => b.started_at.localeCompare(a.started_at))
                    .map((s) => {
                      const seasonEntries = getEntriesForGrowingSeason(s.id);
                      const seasonRangeEnd = s.ended_at ?? new Date().toISOString().slice(0, 10);
                      const flowerInSeason =
                        instance.first_flower_at && instance.first_flower_at >= s.started_at && instance.first_flower_at <= seasonRangeEnd
                          ? instance.first_flower_at
                          : null;
                      const fruitInSeason =
                        instance.first_fruit_at && instance.first_fruit_at >= s.started_at && instance.first_fruit_at <= seasonRangeEnd
                          ? instance.first_fruit_at
                          : null;
                      const stats = computeSeasonStats({
                        startedAt: s.started_at,
                        endedAt: s.ended_at,
                        growthEntries: seasonEntries,
                        harvestWeights: harvestLogs.filter((h) => h.growing_season_id === s.id).map((h) => h.weight_grams),
                        fruitMeasurements: seasonEntries.map((e) => ({ length: e.fruit_length_cm, width: e.fruit_width_cm })),
                      });
                      return (
                        <div key={s.id} className="sv-panel p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="sv-heading text-base">{s.label ?? `Seizoen ${s.year}`}</p>
                            <span className={`sv-badge-ok text-xs px-2 py-0.5 rounded-full${s.status !== "active" ? " opacity-70" : ""}`}>
                              {s.status === "active" ? "Actief" : s.status === "completed" ? "Afgerond" : "Mislukt"}
                            </span>
                          </div>
                          <p className="text-xs sv-muted">
                            {new Date(s.started_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                            {s.ended_at && ` — ${new Date(s.ended_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`}
                          </p>
                          {s.closing_reason && <p className="text-xs sv-muted">Reden: {s.closing_reason}</p>}
                          {s.closing_notes && <p className="text-sm">{s.closing_notes}</p>}
                          <p className="text-xs sv-muted">{seasonEntries.length} registratie{seasonEntries.length !== 1 ? "s" : ""} in dit seizoen</p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs pt-2 mt-1 border-t border-black/10">
                            <p className="sv-muted">Duur: <span className="text-foreground">{stats.durationDays} dagen</span></p>
                            <p className="sv-muted">Max. hoogte: <span className="text-foreground">{stats.maxHeightCm !== null ? `${formatMeasurement(stats.maxHeightCm)} cm` : "Nog niet geregistreerd"}</span></p>
                            <p className="sv-muted">Groei/week: <span className="text-foreground">{stats.growthPerWeekCm !== null ? `${formatMeasurement(stats.growthPerWeekCm)} cm` : "Nog niet geregistreerd"}</span></p>
                            <p className="sv-muted">Eerste bloem: <span className="text-foreground">{flowerInSeason ? new Date(flowerInSeason).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "Niet beschikbaar"}</span></p>
                            <p className="sv-muted">Eerste vrucht: <span className="text-foreground">{fruitInSeason ? new Date(fruitInSeason).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "Niet beschikbaar"}</span></p>
                            <p className="sv-muted">Totale oogst: <span className="text-foreground">{stats.totalHarvestWeightGrams !== null ? `${stats.totalHarvestWeightGrams} g` : "Geen gegevens"}</span></p>
                            <p className="sv-muted">Aantal oogsten: <span className="text-foreground">{stats.harvestCount > 0 ? stats.harvestCount : "Geen gegevens"}</span></p>
                            <p className="sv-muted">Gem. vruchtgrootte: <span className="text-foreground">{formatFruitSize(stats.avgFruitLengthCm, stats.avgFruitWidthCm) ?? "Geen gegevens"}</span></p>
                            <p className="sv-muted">Water gegeven: <span className="text-foreground">{stats.waterCount > 0 ? `${stats.waterCount}x` : "Geen gegevens"}</span></p>
                            <p className="sv-muted">Voeding gegeven: <span className="text-foreground">{stats.feedingCount > 0 ? `${stats.feedingCount}x` : "Geen gegevens"}</span></p>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className="sv-button sv-button-thin-border w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Instellingen</span>
              {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {settingsOpen && (
              <InstanceSettingsSection
                instance={instance}
                onSave={(patch) => patchInstance({ id: instance.id, patch })}
                isSaving={false}
              />
            )}
          </div>

          {activeSeason && !closingSeason && (
            <Button size="sm" variant="outline" className="sv-button sv-button-thin-border w-full" onClick={() => setClosingSeason(true)}>
              Teelt afronden
            </Button>
          )}
          {activeSeason && closingSeason && (
            <CompleteSeasonPanel season={activeSeason} instance={instance} species={species} onClose={() => setClosingSeason(false)} />
          )}
        </div>

        <DialogFooter>
          <Button size="sm" variant="ghost" className="sv-button sv-button-ghost" onClick={onClose}>
            Sluiten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmUnlinkQrOpen} onOpenChange={setConfirmUnlinkQrOpen}>
      <AlertDialogContent className="tuinieren-theme sv-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>QR-code ontkoppelen?</AlertDialogTitle>
          <AlertDialogDescription>
            De sticker zelf blijft bestaan en wordt "Vrij" — je kunt 'm later weer aan een andere plant of batch
            koppelen. {name} blijft gewoon bestaan, alleen zonder QR-koppeling.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={handleUnlinkQr}>Ontkoppelen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ─── Mijn geplante exemplaren ───────────────────────────────────────────────

const INSTANCE_HEALTH_FILTER_OPTIONS = ["water_needed", "feeding_needed"] as const;

type InstanceSortKey = "slim" | "name_asc" | "name_desc" | "newest" | "oldest" | "health" | "location";

const INSTANCE_SORT_OPTIONS: { key: InstanceSortKey; label: string }[] = [
  { key: "slim",     label: "🎯 Slim" },
  { key: "name_asc", label: "🔤 Naam A–Z" },
  { key: "name_desc",label: "🔤 Naam Z–A" },
  { key: "health",   label: "❤️ Gezondheid" },
  { key: "location", label: "📍 Locatie" },
];

const HEALTH_SORT_ORDER: Record<string, number> = {
  Stress: 0, Ziek: 1, Afgestorven: 2, "In bloei": 3, Vruchten: 4, Gezond: 5, "Net geplant": 6, Zaailing: 7,
};

function sortInstances(
  instances: PlantInstance[],
  sortKey: InstanceSortKey,
  speciesById: Map<string, Plant>,
): PlantInstance[] {
  const nameOf = (i: PlantInstance) =>
    plantInstanceDisplayName(i, speciesById.get(i.species_id)).toLowerCase();

  const byName = (a: PlantInstance, b: PlantInstance) =>
    nameOf(a).localeCompare(nameOf(b), "nl");

  switch (sortKey) {
    case "name_asc":
      return [...instances].sort(byName);

    case "name_desc":
      return [...instances].sort((a, b) => -byName(a, b));

    case "newest":
      return [...instances].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    case "oldest":
      return [...instances].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

    case "health": {
      return [...instances].sort((a, b) => {
        const ai = a.health_status != null ? (HEALTH_SORT_ORDER[a.health_status] ?? 99) : 99;
        const bi = b.health_status != null ? (HEALTH_SORT_ORDER[b.health_status] ?? 99) : 99;
        return ai !== bi ? ai - bi : byName(a, b);
      });
    }

    case "location": {
      return [...instances].sort((a, b) => {
        const al = a.location ?? "";
        const bl = b.location ?? "";
        if (!al && !bl) return byName(a, b);
        if (!al) return 1;
        if (!bl) return -1;
        return al.localeCompare(bl, "nl") || byName(a, b);
      });
    }

    case "slim":
    default: {
      const priority = (i: PlantInstance): number => {
        const species = speciesById.get(i.species_id);
        if (species && instanceWaterStatus(i, species)?.overdue) return 0;
        if (species && instanceFeedingStatus(i, species)?.overdue) return 1;
        if (i.health_status && i.health_status !== "Gezond") return 2;
        return 3;
      };
      return [...instances].sort((a, b) => {
        const pa = priority(a), pb = priority(b);
        return pa !== pb ? pa - pb : byName(a, b);
      });
    }
  }
}

// Slim banner shown above "Mijn geplante exemplaren" when at least one active
// instance needs water. Purely presentational — the actual "who needs water"
// selection lives in BulkWateringDialog (and reuses the exact same
// instanceWaterStatus() call), so the count shown here can never disagree
// with what the dialog itself lists.
function BulkWateringBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count === 0) return null;
  return (
    <div className="sv-panel p-4 flex items-center justify-between gap-3 flex-wrap">
      <p className="sv-heading text-xl flex items-center gap-2">
        <Droplet className="h-5 w-5" aria-hidden />
        {count} exemplaar{count === 1 ? "" : "en"} {count === 1 ? "heeft" : "hebben"} water nodig
      </p>
      <Button className="sv-button text-xl" onClick={onOpen}>
        <Droplet className="h-4 w-4" /> Water geven
      </Button>
    </div>
  );
}

// Gezamenlijke waterronde: één dialoog die alle actieve exemplaren toont die
// water nodig hebben (dezelfde selectie/labels als de individuele "water
// nodig"-badge — instanceWaterStatus wordt hier niet opnieuw berekend, enkel
// hergebruikt), en bij opslaan simpelweg dezelfde recordWatering(...) aanroept
// die ook de individuele "Water gegeven"-knop gebruikt. Geen nieuwe
// opslagroute, geen nieuwe tabellen.
function BulkWateringDialog({
  open,
  onOpenChange,
  instances,
  speciesById,
  activeSeasonByInstance,
  recordWatering,
  careError,
  getEntriesForPlantInstance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: PlantInstance[];
  speciesById: Map<string, Plant>;
  activeSeasonByInstance: Map<string, GrowingSeason>;
  recordWatering: (instance: PlantInstance, plantName: string, growingSeasonId: string | null) => Promise<boolean>;
  careError: string | null;
  getEntriesForPlantInstance: (id: string) => LogEntry[];
}) {
  const eligible = useMemo(() => {
    const list = instances.filter((i) => {
      const species = speciesById.get(i.species_id);
      return species ? instanceWaterStatus(i, species)?.overdue === true : false;
    });
    return sortInstances(list, "name_asc", speciesById);
  }, [instances, speciesById]);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const isSavingRef = useRef(false);

  // Every time the dialog is (re)opened, default back to "everything checked".
  useEffect(() => {
    if (open) setChecked(new Set(eligible.map((i) => i.id)));
    // Only re-run on open — re-checking everything while the user is
    // unticking items (e.g. because eligible's identity changes after a
    // background refetch) would undo their in-progress selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);
    const targets = eligible.filter((i) => checked.has(i.id));
    let success = 0;
    for (const instance of targets) {
      const species = speciesById.get(instance.species_id);
      const name = plantInstanceDisplayName(instance, species);
      const seasonId = activeSeasonByInstance.get(instance.id)?.id ?? null;
      // Exact same call the individual "Water gegeven" button makes — no
      // separate bulk-save function, so growth_log/last_watered_at/kalender/
      // statistieken/tijdlijn/meldingen all stay correct automatically.
      const ok = await recordWatering(instance, name, seasonId);
      if (ok) success++;
    }
    setSaving(false);
    isSavingRef.current = false;
    if (success > 0) {
      toast.success(`✅ Water geregistreerd voor ${success} exemplaar${success === 1 ? "" : "en"}`);
    }
    if (success < targets.length) {
      toast.error(`${targets.length - success} exemplaar${targets.length - success === 1 ? "" : "en"} kon niet worden geregistreerd.`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={PLANT_DIALOG_CONTENT_CLASS}>
        <DialogHeader>
          <DialogTitle className={PLANT_DIALOG_TITLE_CLASS}>Water geven</DialogTitle>
          <DialogDescription className="sv-muted">
            Selecteer welke exemplaren je zojuist water hebt gegeven.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-1">
          {eligible.length === 0 ? (
            <p className="text-sm sv-muted px-1">Niemand heeft op dit moment water nodig.</p>
          ) : (
            eligible.map((instance) => {
              const species = speciesById.get(instance.species_id);
              const name = plantInstanceDisplayName(instance, species);
              const status = species ? instanceWaterStatus(instance, species) : null;
              const heightEntry = getEntriesForPlantInstance(instance.id).find((e) => e.height_cm !== null);
              const infoLine = [
                instance.location,
                heightEntry ? `📏 ${formatMeasurement(heightEntry.height_cm as number)} cm` : null,
              ].filter(Boolean).join(" · ");

              return (
                <label
                  key={instance.id}
                  className="sv-panel flex items-center gap-3 p-3 cursor-pointer"
                >
                  <Checkbox
                    checked={checked.has(instance.id)}
                    onCheckedChange={() => toggle(instance.id)}
                    aria-label={`${name} water gegeven`}
                  />
                  {species?.photo_url ? (
                    <img src={species.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0 sv-icon-slot" />
                  ) : (
                    <div className="h-10 w-10 sv-icon-slot flex items-center justify-center shrink-0">
                      <Sprout className="h-4 w-4" strokeWidth={1.6} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="sv-heading text-lg leading-snug truncate">
                      {instance.health_status && `${HEALTH_STATUS_EMOJI[instance.health_status] ?? ""} `}
                      {name}
                    </p>
                    {infoLine && <p className="text-xs sv-muted truncate">{infoLine}</p>}
                  </div>
                  {status && (
                    <span
                      className={`sv-heading inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit shrink-0 ${status.overdue ? "sv-badge-overdue" : "sv-badge-ok"}`}
                    >
                      <Droplet className="h-3 w-3" aria-hidden /> {status.label}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        {careError && <p className="text-xs sv-destructive-text px-1">{careError}</p>}

        <DialogFooter>
          <Button
            className="sv-button text-xl"
            onClick={handleSave}
            disabled={saving || checked.size === 0}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Water geregistreerd voor {checked.size} exemplaar{checked.size === 1 ? "" : "en"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MyPlantInstances({
  speciesList,
  initialSearch,
  initialNeedFilter,
}: {
  speciesList: Plant[];
  initialSearch?: string;
  initialNeedFilter?: "" | (typeof INSTANCE_HEALTH_FILTER_OPTIONS)[number];
}) {
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["plant_instances", "active"],
    queryFn: fetchActivePlantInstances,
  });
  const { data: seasons = [] } = useQuery({
    queryKey: ["growing_seasons", "all"],
    queryFn: fetchAllGrowingSeasons,
  });
  const [detailInstanceId, setDetailInstanceId] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch ?? "");
  const [needFilter, setNeedFilter] = useState<"" | (typeof INSTANCE_HEALTH_FILTER_OPTIONS)[number]>(initialNeedFilter ?? "");
  const [sortKey, setSortKey] = useState<InstanceSortKey>("slim");
  const [expandedSpeciesIds, setExpandedSpeciesIds] = useState<Set<string>>(new Set());
  const { recordWatering, recordFeeding, error: careError } = useRecordInstanceCare();
  const { getEntriesForPlantInstance } = useGrowthLog();
  const [bulkWaterOpen, setBulkWaterOpen] = useState(false);

  const speciesById = useMemo(() => new Map(speciesList.map((s) => [s.id, s])), [speciesList]);
  const activeSeasonByInstance = useMemo(() => {
    const map = new Map<string, GrowingSeason>();
    for (const s of seasons) if (s.status === "active") map.set(s.plant_instance_id, s);
    return map;
  }, [seasons]);

  // Same instanceWaterStatus() call as everywhere else — deliberately over
  // ALL active instances (not filteredInstances), since the banner/dialog is
  // meant to cover a full watering round regardless of the current
  // search/filter the user happens to have set on the list below.
  const waterNeededCount = useMemo(
    () => instances.filter((i) => {
      const species = speciesById.get(i.species_id);
      return species ? instanceWaterStatus(i, species)?.overdue === true : false;
    }).length,
    [instances, speciesById],
  );

  const filteredInstances = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = instances.filter((instance) => {
      const species = speciesById.get(instance.species_id);
      const name = plantInstanceDisplayName(instance, species);
      if (q && !name.toLowerCase().includes(q) && !(species?.name.toLowerCase().includes(q))) return false;
      if (needFilter === "water_needed" && !(species && instanceWaterStatus(instance, species)?.overdue)) return false;
      if (needFilter === "feeding_needed" && !(species && instanceFeedingStatus(instance, species)?.overdue)) return false;
      return true;
    });
    return sortInstances(filtered, sortKey, speciesById);
  }, [instances, speciesById, search, needFilter, sortKey]);

  // Group by species_id, preserving the sort order of filteredInstances.
  // The group for a species appears at the position of its first instance.
  const groupedInstances = useMemo(() => {
    const seen = new Map<string, PlantInstance[]>();
    const order: string[] = [];
    for (const inst of filteredInstances) {
      if (!seen.has(inst.species_id)) {
        seen.set(inst.species_id, []);
        order.push(inst.species_id);
      }
      seen.get(inst.species_id)!.push(inst);
    }
    return order.map((id) => ({ speciesId: id, instances: seen.get(id)! }));
  }, [filteredInstances]);

  function toggleGroup(speciesId: string) {
    setExpandedSpeciesIds((prev) => {
      const next = new Set(prev);
      if (next.has(speciesId)) next.delete(speciesId);
      else next.add(speciesId);
      return next;
    });
  }

  // Stable per-instance callbacks for water/feed so SpeciesGroupCard and
  // the flat PlantInstanceCard use the same call signature.
  function handleWater(i: PlantInstance) {
    recordWatering(i, plantInstanceDisplayName(i, speciesById.get(i.species_id)), activeSeasonByInstance.get(i.id)?.id ?? null);
  }
  function handleFeed(i: PlantInstance) {
    recordFeeding(i, plantInstanceDisplayName(i, speciesById.get(i.species_id)), activeSeasonByInstance.get(i.id)?.id ?? null);
  }

  const detailInstance = instances.find((i) => i.id === detailInstanceId) ?? null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 sv-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="sv-panel p-12 text-center">
        <Sprout className="h-10 w-10 mx-auto" strokeWidth={1.4} />
        <p className="sv-heading text-2xl mt-4">Nog geen exemplaren geplant</p>
        <p className="text-sm sv-muted mt-1">
          Gebruik "Nieuw exemplaar planten" hierboven om je eerste exemplaar toe te voegen.
        </p>
      </div>
    );
  }

  return (
    <>
      <BulkWateringBanner count={waterNeededCount} onOpen={() => setBulkWaterOpen(true)} />

      <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
        {INSTANCE_SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortKey(opt.key)}
            className={chipClass(sortKey === opt.key)}
          >
            {opt.label}
          </button>
        ))}
        <Input
          placeholder="Zoek op naam of soort..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm max-w-xs"
        />
      </div>

      {filteredInstances.length === 0 ? (
        <p className="text-sm sv-muted px-1">Geen exemplaren gevonden voor deze zoekopdracht/filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groupedInstances.map(({ speciesId, instances: groupInstances }) => {
            const species = speciesById.get(speciesId);
            if (groupInstances.length === 1) {
              const instance = groupInstances[0];
              return (
                <PlantInstanceCard
                  key={instance.id}
                  instance={instance}
                  species={species}
                  activeSeason={activeSeasonByInstance.get(instance.id) ?? null}
                  onOpen={(i) => setDetailInstanceId(i.id)}
                  onWater={handleWater}
                  onFeed={handleFeed}
                />
              );
            }
            return (
              <div key={speciesId} className={expandedSpeciesIds.has(speciesId) ? "col-span-full" : undefined}>
                <SpeciesGroupCard
                  species={species}
                  instances={groupInstances}
                  isExpanded={expandedSpeciesIds.has(speciesId)}
                  onToggle={() => toggleGroup(speciesId)}
                  onOpen={(i) => setDetailInstanceId(i.id)}
                  onWater={handleWater}
                  onFeed={handleFeed}
                  activeSeasonByInstance={activeSeasonByInstance}
                />
              </div>
            );
          })}
        </div>
      )}

      {detailInstance && (
        <PlantInstanceDetailDialog
          instance={detailInstance}
          species={speciesById.get(detailInstance.species_id)}
          activeSeason={activeSeasonByInstance.get(detailInstance.id) ?? null}
          allInstances={instances}
          speciesById={speciesById}
          onClose={() => setDetailInstanceId(null)}
        />
      )}

      <BulkWateringDialog
        open={bulkWaterOpen}
        onOpenChange={setBulkWaterOpen}
        instances={instances}
        speciesById={speciesById}
        activeSeasonByInstance={activeSeasonByInstance}
        recordWatering={recordWatering}
        careError={careError}
        getEntriesForPlantInstance={getEntriesForPlantInstance}
      />
    </>
  );
}

export default function Tuinieren() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlantDraft>(emptyDraft);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [view, setView] = useState<Plant | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<PlantDraft>(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoUrlDraft, setPhotoUrlDraft] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const gardenBackupInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!importMsg) return;
    const t = setTimeout(() => setImportMsg(null), 5000);
    return () => clearTimeout(t);
  }, [importMsg]);

  // "JSON ophalen" — kopieert de actuele ChatGPT-importprompt naar het
  // klembord. De prompt zelf komt volledig uit buildPlantImportChatGptPrompt()
  // (plantImportPrompt.ts), die op zijn beurt PLANT_IMPORT_FIELDS
  // (plantImportSchema.ts) leest — dezelfde bron als validatePlantImportEntry
  // hieronder. Er wordt hier dus nooit een los, verouderbaar schema getoond.
  async function handleCopyImportPrompt() {
    try {
      const prompt = buildPlantImportChatGptPrompt();
      await navigator.clipboard.writeText(prompt);
      toast.success("JSON-prompt gekopieerd");
    } catch {
      toast.error("JSON-prompt kopiëren mislukt");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      const rawList: unknown[] = Array.isArray(data) ? data : [data];
      if (rawList.length === 0) {
        setImportMsg("Het bestand bevat geen planten.");
        e.target.value = "";
        return;
      }
      let imported = 0;
      const errors: string[] = [];
      for (const entry of rawList) {
        const validation = validatePlantImportEntry(entry);
        if (!validation.ok) {
          const label = typeof (entry as Record<string, unknown>)?.name === "string"
            ? `"${(entry as Record<string, unknown>).name}"`
            : "onbekende plant";
          errors.push(`${label}: ${validation.errors.join(" · ")}`);
          continue;
        }
        const p = validation.data;
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
          pot_min_depth_cm: p.pot_min_depth_cm ? Number(p.pot_min_depth_cm) : null,
          pot_recommended_depth_cm: p.pot_recommended_depth_cm ? Number(p.pot_recommended_depth_cm) : null,
          pot_water_notes: p.pot_water_notes || null,
          planted: p.planted ?? false,
          planted_at: p.planted_at ? new Date(p.planted_at).toISOString() : null,
          health_status: p.health_status || null,
          last_checked_at: p.last_checked_at || null,
          water_skip_until: p.water_skip_until || null,
          first_flower_at: p.first_flower_at || null,
          first_fruit_at: p.first_fruit_at || null,
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
        if (error) errors.push(`"${row.name}": ${error.message}`);
        else imported++;
      }
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      setImportMsg(errors.length > 0
        ? `${imported} toegevoegd, ${errors.length} overgeslagen: ${errors.join(" · ")}`
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

  const [pageViewMode, setPageViewMode] = useState<"species" | "instances">("species");
  const [instanceFormOpen, setInstanceFormOpen] = useState(false);
  const [quickPhotoOpen, setQuickPhotoOpen] = useState(false);
  const [instancesInitialSearch, setInstancesInitialSearch] = useState("");
  const [instancesInitialNeedFilter, setInstancesInitialNeedFilter] = useState<"" | "water_needed" | "feeding_needed">("");
  const [createInstanceForSpecies, setCreateInstanceForSpecies] = useState<Plant | null>(null);

  // All instances (active + historical), used only to compute the next
  // auto-name suggestion number so it's never reused after archiving.
  const { data: allPlantInstances = [] } = useQuery({
    queryKey: ["plant_instances", "all"],
    queryFn: fetchPlantInstances,
  });

  // ── QR: scannen → direct het bijbehorende exemplaar openen (Deel E) ──────
  // Bewust "dom" gehouden: QrScanner geeft alleen ruwe teksdata terug,
  // resolveQrScan (useQrLabels — de gedeelde resolver-laag) vertaalt dat naar
  // een concrete plant_instance, en DEZE flow bepaalt zelf dat het resultaat
  // "open het detailvenster" betekent. Geen cameraflow, geen extra keuze —
  // dat blijft voorbehouden aan de aparte groeifoto-QR-flow in
  // QuickGrowthPhotoDialog, die dezelfde resolver gebruikt maar er iets
  // anders mee doet.
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrLabelsManagerOpen, setQrLabelsManagerOpen] = useState(false);
  const [qrOpenInstanceId, setQrOpenInstanceId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoadingLabels, isLoadingAssignments, resolveQrScan } = useQrLabels();
  const speciesByIdTop = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const instancesByIdTop = useMemo(() => new Map(allPlantInstances.map((i) => [i.id, i])), [allPlantInstances]);

  async function resolveAndOpenQrScan(rawText: string) {
    const result = await resolveQrScan(rawText, instancesByIdTop);
    switch (result.status) {
      case "invalid":
        toast.error("Geen geldige Tuingids QR-code");
        return;
      case "deleted":
        toast.error("Dit QR-label is verwijderd en niet meer in gebruik.");
        return;
      case "unlinked":
        toast(
          `Deze QR-code is nog niet gekoppeld${result.label.note ? ` (${result.label.note})` : ""}. Koppel 'm bij het aanmaken of bewerken van een exemplaar.`,
        );
        return;
      case "inactive":
        toast.error(`Deze QR-code hoort bij een niet-actieve registratie (${INSTANCE_STATUS_LABELS[result.instance.status]}).`);
        return;
      case "resolved":
        setQrOpenInstanceId(result.instance.id);
        return;
    }
  }

  // Deeplink: een QR-sticker gescand met de gewone telefooncamera (buiten de
  // app om) opent "…/#/tuinieren?qr=<code>" — dezelfde afhandeling als een
  // in-app scan, alleen ligt de code al klaar in de URL i.p.v. via de
  // camera. Login blijft gewoon vereist (deze pagina zit al achter de
  // bestaande auth-guard); de code zelf is puur een opzoeksleutel, geen
  // authenticatiemiddel. Wacht tot labels/assignments geladen zijn zodat een
  // nog-lege cache niet ten onrechte als "onbekende QR-code" wordt gelezen,
  // en verwijdert de queryparam na afhandeling zodat verversen niet opnieuw
  // dezelfde melding/opening triggert.
  const qrDeeplinkHandledRef = useRef(false);
  useEffect(() => {
    if (qrDeeplinkHandledRef.current) return;
    if (isLoadingLabels || isLoadingAssignments) return;
    const code = searchParams.get("qr");
    if (!code) return;
    qrDeeplinkHandledRef.current = true;
    void resolveAndOpenQrScan(code);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("qr");
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingLabels, isLoadingAssignments, searchParams]);

  const { data: qrOpenInstance } = useQuery({
    queryKey: ["plant_instances", "single", qrOpenInstanceId],
    queryFn: () => fetchPlantInstance(qrOpenInstanceId!),
    enabled: !!qrOpenInstanceId,
  });
  const { data: qrOpenSeason = null } = useQuery({
    queryKey: ["growing_seasons", "active", qrOpenInstanceId],
    queryFn: () => fetchActiveGrowingSeason(qrOpenInstanceId!),
    enabled: !!qrOpenInstanceId,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["plant_photos", view?.id],
    queryFn: () => fetchPhotos(view!.id),
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

  type FilterState = {
    category: string[];
    sun_needs: string[];
    greenhouse_pref: string[];
    lifecycle: string[];
    winter_hardiness: string[];
    toxic: string[];
    health_status: string[];
    // Replaces the old boolean `plants.planted` filter (phase 4): whether a
    // species has any active plant_instances row is now the only source of
    // truth for "does the user have this in the garden".
    instanceStatus: "all" | "has_active" | "no_active";
    sow_months: string[];
    bloom_months: string[];
    harvest_months: string[];
    feeding_months: string[];
    // Instance-based (phase 4): counts active instances that need water/
    // feeding right now, never a species-level last_watered_at/last_fed_at.
    water: "all" | "needed" | "on_schedule";
    feeding: "all" | "needed" | "on_schedule";
    sort: "naam" | "categorie" | "active_instances" | "water_needed" | "feeding_needed";
  };

  const initialFilters: FilterState = {
    category: [],
    sun_needs: [],
    greenhouse_pref: [],
    lifecycle: [],
    winter_hardiness: [],
    toxic: [],
    health_status: [],
    instanceStatus: "all",
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

  // Per-species summary of its ACTIVE instances' water/feeding urgency —
  // the single computation both the filter/sort logic below and the species
  // popup's summary block read from, so there is only one place that ever
  // calls instanceWaterStatus/instanceFeedingStatus per species.
  const speciesInstanceSummary = useMemo(() => {
    const map = new Map<string, { activeCount: number; archivedCount: number; waterNeeded: number; waterOk: number; feedingNeeded: number; feedingOk: number }>();
    for (const p of plants) {
      const activeInstances = getActiveInstancesForSpecies(p.id, allPlantInstances);
      const archivedCount = allPlantInstances.filter((i) => i.species_id === p.id && i.status !== "active").length;
      let waterNeeded = 0, waterOk = 0, feedingNeeded = 0, feedingOk = 0;
      for (const inst of activeInstances) {
        const ws = instanceWaterStatus(inst, p);
        if (ws) { if (ws.overdue) waterNeeded++; else waterOk++; }
        const fs = instanceFeedingStatus(inst, p);
        if (fs) { if (fs.overdue) feedingNeeded++; else feedingOk++; }
      }
      map.set(p.id, { activeCount: activeInstances.length, archivedCount, waterNeeded, waterOk, feedingNeeded, feedingOk });
    }
    return map;
  }, [plants, allPlantInstances]);

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

    if (filters.instanceStatus !== "all") {
      result = result.filter((p) => {
        const hasActive = (speciesInstanceSummary.get(p.id)?.activeCount ?? 0) > 0;
        return filters.instanceStatus === "has_active" ? hasActive : !hasActive;
      });
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

    if (filters.water === "needed") {
      result = result.filter((p) => (speciesInstanceSummary.get(p.id)?.waterNeeded ?? 0) > 0);
    } else if (filters.water === "on_schedule") {
      result = result.filter((p) => {
        const s = speciesInstanceSummary.get(p.id);
        return !!s && s.activeCount > 0 && s.waterNeeded === 0;
      });
    }

    if (filters.feeding === "needed") {
      result = result.filter((p) => (speciesInstanceSummary.get(p.id)?.feedingNeeded ?? 0) > 0);
    } else if (filters.feeding === "on_schedule") {
      result = result.filter((p) => {
        const s = speciesInstanceSummary.get(p.id);
        return !!s && s.activeCount > 0 && s.feedingNeeded === 0;
      });
    }

    if (filters.sort === "active_instances") {
      result = [...result].sort((a, b) =>
        (speciesInstanceSummary.get(b.id)?.activeCount ?? 0) - (speciesInstanceSummary.get(a.id)?.activeCount ?? 0)
        || a.name.localeCompare(b.name, "nl"));
    } else if (filters.sort === "water_needed") {
      result = [...result].sort((a, b) =>
        (speciesInstanceSummary.get(b.id)?.waterNeeded ?? 0) - (speciesInstanceSummary.get(a.id)?.waterNeeded ?? 0)
        || a.name.localeCompare(b.name, "nl"));
    } else if (filters.sort === "feeding_needed") {
      result = [...result].sort((a, b) =>
        (speciesInstanceSummary.get(b.id)?.feedingNeeded ?? 0) - (speciesInstanceSummary.get(a.id)?.feedingNeeded ?? 0)
        || a.name.localeCompare(b.name, "nl"));
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
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "nl"));
    }

    return result;
  }, [plants, filters, speciesInstanceSummary]);

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
    (filters.instanceStatus !== "all" ? 1 : 0) +
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
      pot_min_depth_cm: p.pot_min_depth_cm,
      pot_recommended_depth_cm: p.pot_recommended_depth_cm,
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
      humidity_notes: p.humidity_notes,
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
      reminders_enabled: p.reminders_enabled,
      feeding_reminders_enabled: p.feeding_reminders_enabled,
      water_skip_until: p.water_skip_until,
      health_status: p.health_status,
      last_checked_at: p.last_checked_at,
      pot_size_liters: p.pot_size_liters,
      pot_material: p.pot_material,
      pot_color: p.pot_color,
      soil_type: p.soil_type,
      soil_mix_notes: p.soil_mix_notes,
      last_repotted_at: p.last_repotted_at,
      acquired_at: p.acquired_at,
      source: p.source,
      price: p.price,
      first_flower_at: p.first_flower_at,
      first_fruit_at: p.first_fruit_at,
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

  // ─── "Mijn tuin" back-up (separate from the species-catalog export above)
  // Covers user/instance data: plant_instances, growing_seasons and every
  // registration linked to them. Deliberately a different JSON shape
  // (garden_backup) so it's never confused with the species-only export.
  async function handleExportGardenBackup() {
    const [instancesRes, seasonsRes, logsRes, harvestRes, pruningRes, repotRes, inspectionsRes, photosRes, growthPhotosRes, plansRes, planItemsRes, qrLabelsRes] = await Promise.all([
      supabase.from("plant_instances").select("*"),
      supabase.from("growing_seasons").select("*"),
      supabase.from("growth_log_entries").select("*"),
      supabase.from("plant_harvest_logs").select("*"),
      supabase.from("plant_pruning_logs").select("*"),
      supabase.from("plant_repot_logs").select("*"),
      supabase.from("plant_inspection_logs").select("*"),
      supabase.from("plant_photos").select("*"),
      supabase.from("growth_log_photos").select("*"),
      supabase.from("cultivation_plans").select("*"),
      supabase.from("cultivation_plan_items").select("*"),
      // qr_labels wél in de back-up (het zijn duurzame, fysieke stickers —
      // die wil je niet kwijtraken bij een restore). plant_instance_qr_
      // assignments (de koppeling label↔instance) bewust NIET: dat is
      // "live" fysieke-wereld-state die op het moment van restore kan
      // afwijken van de werkelijkheid (sticker is intussen verplaatst/
      // hergebruikt), en de import hieronder doet geen constraint-bewuste
      // samenvoeging — een oude, inmiddels achterhaalde actieve koppeling
      // terugzetten zou een label ten onrechte weer "in gebruik" kunnen
      // tonen, of zelfs botsen met de partiële unique-index als het label
      // intussen al aan iets anders hangt. Labels overleven een restore dus
      // gewoon, gekoppeld zijn ze daarna niet meer — dat koppel je bewust
      // opnieuw, exact zoals bij een gewone hergebruikte sticker.
      // `select("*")`/`insert(label)` hieronder nemen deleted_at automatisch
      // mee (zie 20260907000000_qr_label_management.sql) — een label dat
      // vóór de back-up al verwijderd was, komt dat na herstel ook weer.
      supabase.from("qr_labels").select("*"),
    ]);
    const speciesById = new Map(plants.map((p) => [p.id, p.name]));
    const backup = {
      version: 2,
      type: "garden_backup",
      exported_at: new Date().toISOString().slice(0, 10),
      // species_name is denormalized purely so an import into a different
      // database can re-match instances to species by name when the
      // original species_id UUID doesn't exist there.
      plant_instances: (instancesRes.data ?? []).map((i) => ({ ...i, species_name: speciesById.get(i.species_id) ?? null })),
      growing_seasons: seasonsRes.data ?? [],
      growth_log_entries: logsRes.data ?? [],
      harvest_logs: harvestRes.data ?? [],
      pruning_logs: pruningRes.data ?? [],
      repot_logs: repotRes.data ?? [],
      inspection_logs: inspectionsRes.data ?? [],
      plant_photos: photosRes.data ?? [],
      // NOTE: growth_log_photos bevat verwijzingen en metadata, maar niet de
      // daadwerkelijke afbeeldingsbestanden uit Supabase Storage.
      growth_log_photos: growthPhotosRes.data ?? [],
      cultivation_plans: plansRes.data ?? [],
      cultivation_plan_items: planItemsRes.data ?? [],
      qr_labels: qrLabelsRes.data ?? [],
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mijn-tuin-backup-${backup.exported_at}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImportGardenBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.type !== "garden_backup" || typeof backup.version !== "number") {
        setImportMsg("Ongeldig back-upbestand (verwacht een 'Mijn tuin'-back-up).");
        e.target.value = "";
        return;
      }

      const speciesIdByName = new Map(plants.map((p) => [p.name, p.id]));
      const validSpeciesIds = new Set(plants.map((p) => p.id));
      let instancesImported = 0, instancesSkipped = 0;
      const importedInstanceIds = new Set<string>();

      for (const inst of backup.plant_instances ?? []) {
        const { data: existing } = await supabase.from("plant_instances").select("id").eq("id", inst.id).maybeSingle();
        if (existing) { importedInstanceIds.add(inst.id); instancesSkipped++; continue; }
        let speciesId: string | null = validSpeciesIds.has(inst.species_id) ? inst.species_id : null;
        if (!speciesId && inst.species_name) speciesId = speciesIdByName.get(inst.species_name) ?? null;
        if (!speciesId) { instancesSkipped++; continue; }
        const { species_name: _speciesName, ...row } = inst;
        const { error } = await supabase.from("plant_instances").insert({ ...row, species_id: speciesId });
        if (!error) { importedInstanceIds.add(inst.id); instancesImported++; }
        else instancesSkipped++;
      }

      let seasonsImported = 0, seasonsSkipped = 0;
      const importedSeasonIds = new Set<string>();
      for (const season of backup.growing_seasons ?? []) {
        const { data: existing } = await supabase.from("growing_seasons").select("id").eq("id", season.id).maybeSingle();
        if (existing) { importedSeasonIds.add(season.id); seasonsSkipped++; continue; }
        if (!importedInstanceIds.has(season.plant_instance_id)) { seasonsSkipped++; continue; }
        const { error } = await supabase.from("growing_seasons").insert(season);
        if (!error) { importedSeasonIds.add(season.id); seasonsImported++; }
        else seasonsSkipped++;
      }

      async function importLinkedRows(
        table: string,
        rows: Array<Record<string, unknown>>,
        requireSpeciesPlantId: boolean,
        // Inspection logs have no plant_id (species) fallback at all — unlike
        // harvest/pruning/repot logs, plant_instance_id is NOT NULL on
        // plant_inspection_logs, so a row whose instance wasn't imported must
        // be skipped entirely rather than falling back to a null instance id.
        requireInstanceId = false,
      ) {
        let imported = 0, skipped = 0;
        for (const row of rows) {
          const { data: existing } = await supabase.from(table).select("id").eq("id", row.id as string).maybeSingle();
          if (existing) { skipped++; continue; }
          const plantInstanceId = row.plant_instance_id as string | null;
          const growingSeasonId = row.growing_season_id as string | null;
          const plantId = row.plant_id as string | null | undefined;
          if (requireSpeciesPlantId && (!plantId || !validSpeciesIds.has(plantId))) { skipped++; continue; }
          const resolvedInstanceId = plantInstanceId && importedInstanceIds.has(plantInstanceId) ? plantInstanceId : null;
          if (requireInstanceId && !resolvedInstanceId) { skipped++; continue; }
          const safeRow = {
            ...row,
            plant_instance_id: resolvedInstanceId,
            growing_season_id: growingSeasonId && importedSeasonIds.has(growingSeasonId) ? growingSeasonId : null,
          };
          const { error } = await supabase.from(table).insert(safeRow);
          if (!error) imported++;
          else skipped++;
        }
        return { imported, skipped };
      }

      const logsResult = await importLinkedRows("growth_log_entries", backup.growth_log_entries ?? [], false);
      const harvestResult = await importLinkedRows("plant_harvest_logs", backup.harvest_logs ?? [], true);
      const pruningResult = await importLinkedRows("plant_pruning_logs", backup.pruning_logs ?? [], true);
      const repotResult = await importLinkedRows("plant_repot_logs", backup.repot_logs ?? [], true);
      const inspectionResult = await importLinkedRows("plant_inspection_logs", backup.inspection_logs ?? [], false, true);
      const photosResult = await importLinkedRows("plant_photos", backup.plant_photos ?? [], true);

      // Import growth_log_photos: plant_instance_id is NOT NULL.
      // Strategy: derive plant_instance_id from the actual DB entry that was
      // already imported (with its own FK resolution). Never use the value
      // from the backup row directly — it may point to a different database.
      // Skip a photo row when:
      //   - it already exists (duplicate);
      //   - its growth_log_entry_id is not in the DB;
      //   - the DB entry's plant_instance_id is null (entry was imported without
      //     an instance because the instance itself wasn't importable);
      //   - the DB entry's plant_instance_id is not among the imported instances.
      // This ensures we never attempt an insert with plant_instance_id = null.
      let growthPhotosImported = 0, growthPhotosSkipped = 0;
      if ((backup.growth_log_photos ?? []).length > 0) {
        // Fetch entry_id → plant_instance_id from the DB *after* entries have
        // been imported so we see the resolved (possibly nulled) FK values.
        const { data: entryRows } = await supabase
          .from("growth_log_entries")
          .select("id, plant_instance_id");
        const entryInstanceMap = new Map<string, string | null>(
          (entryRows ?? []).map((r: { id: string; plant_instance_id: string | null }) => [r.id, r.plant_instance_id]),
        );

        for (const row of backup.growth_log_photos as Array<Record<string, unknown>>) {
          const { data: existing } = await supabase.from("growth_log_photos").select("id").eq("id", row.id as string).maybeSingle();
          if (existing) { growthPhotosSkipped++; continue; }

          const entryId = row.growth_log_entry_id as string;

          // Entry must exist in the DB
          if (!entryInstanceMap.has(entryId)) { growthPhotosSkipped++; continue; }

          // Derive plant_instance_id from the DB entry — never from the backup row
          const derivedInstanceId = entryInstanceMap.get(entryId) ?? null;

          // NOT NULL constraint: skip if the entry has no linked instance
          if (!derivedInstanceId) { growthPhotosSkipped++; continue; }

          // Cross-check: the instance must be one we know about
          if (!importedInstanceIds.has(derivedInstanceId)) { growthPhotosSkipped++; continue; }

          const { error } = await supabase.from("growth_log_photos").insert({
            ...row,
            growth_log_entry_id: entryId,          // explicit for clarity
            plant_instance_id: derivedInstanceId,   // always from DB entry, never null
          });
          if (!error) growthPhotosImported++;
          else growthPhotosSkipped++;
        }
      }

      // Import cultivation_plans — plans first, then items (FK dependency).
      let plansImported = 0, plansSkipped = 0;
      const importedPlanIds = new Set<string>();
      for (const plan of backup.cultivation_plans ?? []) {
        const { data: existing } = await supabase.from("cultivation_plans").select("id").eq("id", plan.id).maybeSingle();
        if (existing) { importedPlanIds.add(plan.id); plansSkipped++; continue; }
        const { error } = await supabase.from("cultivation_plans").insert(plan);
        if (!error) { importedPlanIds.add(plan.id); plansImported++; }
        else plansSkipped++;
      }

      let planItemsImported = 0, planItemsSkipped = 0;
      for (const item of backup.cultivation_plan_items ?? []) {
        // Skip items whose plan wasn't imported (not in our DB)
        if (!importedPlanIds.has(item.cultivation_plan_id)) { planItemsSkipped++; continue; }
        // Require species to exist in this database
        if (!validSpeciesIds.has(item.species_id)) { planItemsSkipped++; continue; }
        const { data: existing } = await supabase.from("cultivation_plan_items").select("id").eq("id", item.id).maybeSingle();
        if (existing) { planItemsSkipped++; continue; }
        const { error } = await supabase.from("cultivation_plan_items").insert({
          ...item,
          // Old exports (version 2 without backup_quantity) default to 0.
          backup_quantity: item.backup_quantity ?? 0,
        });
        if (!error) planItemsImported++;
        else planItemsSkipped++;
      }

      // QR-labels: alleen de labels zelf (duurzame stickers), nooit hun
      // koppelingen — zie de toelichting bij handleExportGardenBackup. Een
      // hersteld label is dus altijd "Vrij", ook als het backup-moment een
      // actieve koppeling liet zien.
      let qrLabelsImported = 0, qrLabelsSkipped = 0;
      for (const label of backup.qr_labels ?? []) {
        const { data: existing } = await supabase.from("qr_labels").select("id").eq("id", label.id).maybeSingle();
        if (existing) { qrLabelsSkipped++; continue; }
        const { error } = await supabase.from("qr_labels").insert(label);
        if (!error) qrLabelsImported++;
        else qrLabelsSkipped++;
      }

      queryClient.invalidateQueries({ queryKey: ["plant_instances"] });
      queryClient.invalidateQueries({ queryKey: ["growing_seasons"] });
      queryClient.invalidateQueries({ queryKey: ["growth_log_entries"] });
      queryClient.invalidateQueries({ queryKey: ["plant_harvest_logs"] });
      queryClient.invalidateQueries({ queryKey: ["plant_pruning_logs"] });
      queryClient.invalidateQueries({ queryKey: ["plant_repot_logs"] });
      queryClient.invalidateQueries({ queryKey: ["plant_inspection_logs"] });
      queryClient.invalidateQueries({ queryKey: ["plant_photos"] });
      queryClient.invalidateQueries({ queryKey: ["growth_log_photos"] });
      queryClient.invalidateQueries({ queryKey: ["cultivation_plans"] });
      queryClient.invalidateQueries({ queryKey: ["qr_labels"] });

      setImportMsg(
        `Tuin-backup geïmporteerd: ${instancesImported} exemplaren, ${seasonsImported} seizoenen, ${logsResult.imported} logboekregels, ` +
        `${harvestResult.imported} oogsten, ${pruningResult.imported} snoeimomenten, ${repotResult.imported} verpotmomenten, ${inspectionResult.imported} inspecties, ${photosResult.imported} foto's, ${growthPhotosImported} groeifoto's, ${plansImported} teeltplannen, ${planItemsImported} planregels, ${qrLabelsImported} QR-labels (zonder koppeling) toegevoegd. ` +
        `Overgeslagen (al aanwezig of niet te koppelen): ${instancesSkipped + seasonsSkipped + logsResult.skipped + harvestResult.skipped + pruningResult.skipped + repotResult.skipped + inspectionResult.skipped + photosResult.skipped + growthPhotosSkipped + plansSkipped + planItemsSkipped + qrLabelsSkipped}.`
      );
    } catch {
      setImportMsg("Ongeldig JSON-bestand.");
    }
    e.target.value = "";
  }

  return (
    <div className="tuinieren-theme space-y-8">
      <Toaster />
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
        <Button
          className="sv-button text-2xl h-11 px-3 sm:px-6"
          onClick={handleCopyImportPrompt}
        >
          <ClipboardCopy className="h-4 w-4" /><span className="hidden sm:inline">JSON ophalen</span>
        </Button>
        <Button
          className="sv-button text-2xl h-11 px-3 sm:px-6"
          onClick={handleExportGardenBackup}
        >
          <Download className="h-4 w-4" /><span className="hidden sm:inline">Mijn tuin back-up</span>
        </Button>
        <Button
          className="sv-button text-2xl h-11 px-3 sm:px-6"
          onClick={() => gardenBackupInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" /><span className="hidden sm:inline">Tuin herstellen</span>
        </Button>
        <input
          ref={gardenBackupInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportGardenBackup}
        />

        <Link to="/tuingids/teeltplanner">
          <Button className="sv-button text-2xl h-11 px-3 sm:px-6">
            <Sprout className="h-4 w-4" /><span className="hidden sm:inline">Teeltplanner</span>
          </Button>
        </Link>

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

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex sv-inset rounded-full p-1 gap-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setPageViewMode("species")}
            className={calendarFilterButtonClass(pageViewMode === "species")}
          >
            Alle plantsoorten
          </button>
          <button
            type="button"
            onClick={() => setPageViewMode("instances")}
            className={calendarFilterButtonClass(pageViewMode === "instances")}
          >
            Mijn geplante exemplaren
          </button>
        </div>
        {pageViewMode === "instances" && (
          <div className="flex items-stretch gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setInstanceFormOpen(true)}
              className="sv-button flex items-center gap-2 px-4 py-2.5 text-base"
            >
              <Plus className="h-4 w-4" /> Nieuw exemplaar planten
            </button>
            <button
              type="button"
              onClick={() => setQuickPhotoOpen(true)}
              className="sv-button flex items-center gap-2 px-4 py-2.5 text-base"
            >
              <Camera className="h-4 w-4" /> Groeifoto maken
            </button>
            <button
              type="button"
              onClick={() => setQrScannerOpen(true)}
              className="sv-button flex items-center gap-2 px-4 py-2.5 text-base"
            >
              <QrCode className="h-4 w-4" /> QR scannen
            </button>
            <button
              type="button"
              onClick={() => setQrLabelsManagerOpen(true)}
              className="sv-button flex items-center justify-center w-14 py-2.5 text-base"
              aria-label="QR-labels beheren"
              title="QR-labels beheren"
            >
              <QrCode className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {pageViewMode === "instances" && (
        <NewPlantInstanceForm
          speciesList={plants}
          allInstances={allPlantInstances}
          controlledOpen={instanceFormOpen}
          onClose={() => setInstanceFormOpen(false)}
        />
      )}

      {pageViewMode === "instances" && (
        <QuickGrowthPhotoDialog
          speciesList={plants}
          open={quickPhotoOpen}
          onClose={() => setQuickPhotoOpen(false)}
        />
      )}

      {pageViewMode === "instances" && (
        <QrScanner
          open={qrScannerOpen}
          onClose={() => setQrScannerOpen(false)}
          onDetected={(text) => {
            setQrScannerOpen(false);
            void resolveAndOpenQrScan(text);
          }}
          title="QR-code scannen"
          description="Richt de camera op het QR-label om direct de plant of batch te openen."
        />
      )}

      {pageViewMode === "instances" && (
        <QrLabelsManagerDialog
          open={qrLabelsManagerOpen}
          onClose={() => setQrLabelsManagerOpen(false)}
          instancesById={instancesByIdTop}
          speciesById={speciesByIdTop}
        />
      )}

      {qrOpenInstanceId && qrOpenInstance && (
        <PlantInstanceDetailDialog
          instance={qrOpenInstance}
          species={speciesByIdTop.get(qrOpenInstance.species_id)}
          activeSeason={qrOpenSeason}
          allInstances={allPlantInstances}
          speciesById={speciesByIdTop}
          onClose={() => setQrOpenInstanceId(null)}
        />
      )}

      {pageViewMode === "species" ? (
        isLoading ? (
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
                  {group.plants.map((p) => <PlantCard key={p.id} p={p} onOpen={setView} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredPlants.map((p) => <PlantCard key={p.id} p={p} onOpen={setView} />)}
          </div>
        )
      ) : (
        <MyPlantInstances speciesList={plants} initialSearch={instancesInitialSearch} initialNeedFilter={instancesInitialNeedFilter} />
      )}

      <Dialog open={!!createInstanceForSpecies} onOpenChange={(o) => !o && setCreateInstanceForSpecies(null)}>
        <DialogContent className="tuinieren-theme sv-dialog w-full max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className={PLANT_DIALOG_TITLE_CLASS}>Nieuw exemplaar planten</DialogTitle>
          </DialogHeader>
          {createInstanceForSpecies && (
            <NewPlantInstanceForm
              speciesList={plants}
              allInstances={allPlantInstances}
              preselectedSpecies={createInstanceForSpecies}
              onCreated={() => setCreateInstanceForSpecies(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <SeasonalOverview plants={plants} />

      <Dialog
        open={!!view}
        onOpenChange={(o) => {
          if (!o) {
            setView(null);
            setConfirmDelete(false);
            setEditMode(false);
          }
        }}
      >
        <DialogContent className={PLANT_DIALOG_CONTENT_CLASS}>
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
                  <DialogTitle className={PLANT_DIALOG_TITLE_CLASS}>
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

              {/* Exemplaren van deze soort */}
              <div className="sv-inset rounded-xl p-4 space-y-3">
                {(() => {
                  const summary = speciesInstanceSummary.get(view.id) ?? { activeCount: 0, archivedCount: 0, waterNeeded: 0, waterOk: 0, feedingNeeded: 0, feedingOk: 0 };
                  const goToInstances = (needFilter?: "water_needed" | "feeding_needed") => {
                    setInstancesInitialSearch(view.name);
                    setInstancesInitialNeedFilter(needFilter ?? "");
                    setPageViewMode("instances");
                    setView(null);
                  };
                  return (
                    <>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm sv-muted">
                          {summary.activeCount === 0
                            ? "Nog geen actieve exemplaren van deze soort."
                            : summary.activeCount === 1
                              ? "1 actief exemplaar van deze soort."
                              : `${summary.activeCount} actieve exemplaren van deze soort.`}
                          {summary.archivedCount > 0 && ` (${summary.archivedCount} gearchiveerd)`}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" variant="outline" className="sv-button sv-button-thin-border text-xl" onClick={() => goToInstances()}>
                            Bekijk mijn exemplaren
                          </Button>
                          <Button size="sm" className="sv-button text-xl" onClick={() => setCreateInstanceForSpecies(view)}>
                            <Plus className="h-3.5 w-3.5" /> Nieuw exemplaar planten
                          </Button>
                        </div>
                      </div>
                      {summary.activeCount > 0 && (
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                          <div className="space-y-1">
                            <p className="sv-muted text-xs font-medium uppercase tracking-wide">Water</p>
                            {summary.waterNeeded > 0 && (
                              <button type="button" onClick={() => goToInstances("water_needed")} className="block text-left underline sv-destructive-text">
                                💧 {summary.waterNeeded} {summary.waterNeeded === 1 ? "heeft" : "hebben"} water nodig
                              </button>
                            )}
                            {summary.waterOk > 0 && <p>💧 {summary.waterOk} {summary.waterOk === 1 ? "is" : "zijn"} op schema</p>}
                            {summary.waterNeeded === 0 && summary.waterOk === 0 && <p className="sv-muted">Geen waterinterval bekend</p>}
                          </div>
                          <div className="space-y-1">
                            <p className="sv-muted text-xs font-medium uppercase tracking-wide">Voeding</p>
                            {summary.feedingNeeded > 0 && (
                              <button type="button" onClick={() => goToInstances("feeding_needed")} className="block text-left underline sv-destructive-text">
                                🌿 {summary.feedingNeeded} {summary.feedingNeeded === 1 ? "heeft" : "hebben"} voeding nodig
                              </button>
                            )}
                            {summary.feedingOk > 0 && <p>🌿 {summary.feedingOk} {summary.feedingOk === 1 ? "is" : "zijn"} op schema</p>}
                            {summary.feedingNeeded === 0 && summary.feedingOk === 0 && <p className="sv-muted">Geen voedingsinterval bekend</p>}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
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
                <InfoRow
                  label="Potgrootte (advies)"
                  value={[
                    view.pot_min_liters ? `min. ${view.pot_min_liters} L` : null,
                    view.pot_recommended_liters ? `aanbevolen ${view.pot_recommended_liters} L` : null,
                    view.pot_min_depth_cm ? `min. ${view.pot_min_depth_cm} cm diep` : null,
                    view.pot_recommended_depth_cm ? `aanbevolen ${view.pot_recommended_depth_cm} cm diep` : null,
                  ].filter(Boolean).join(" · ") || null}
                />
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
                    { value: "categorie", label: "Categorie" },
                    { value: "active_instances", label: "Meeste actieve exemplaren" },
                    { value: "water_needed", label: "Meeste water nodig" },
                    { value: "feeding_needed", label: "Meeste voeding nodig" },
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
                    { value: "needed", label: "Minstens 1 exemplaar heeft water nodig" },
                    { value: "on_schedule", label: "Alle exemplaren op schema" },
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
                    { value: "needed", label: "Minstens 1 exemplaar heeft voeding nodig" },
                    { value: "on_schedule", label: "Alle exemplaren op schema" },
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
              <SectionHeading>Exemplaren</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: "all", label: "Alles" },
                    { value: "has_active", label: "Heeft actieve exemplaren" },
                    { value: "no_active", label: "Geen actieve exemplaren" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchFilter({ instanceStatus: value })}
                    className={chipClass(filters.instanceStatus === value)}
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
