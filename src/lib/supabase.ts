import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://lrqivcfuiuskqkpmyxfo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycWl2Y2Z1aXVza3FrcG15eGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzQyMzEsImV4cCI6MjA5NDAxMDIzMX0.vG0Gm6ycQNV20QurnGMVPElsMhQ7bi60uDdimL6vIrM",
);

export type GroceryItem = {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
};

export type WeekPlanRow = {
  day: string;
  meal: string;
  recipe_id: string | null;
};

export type Recipe = {
  id: string;
  title: string;
  time: string;
  servings: string;
  ingredients: string;
  steps: string;
  category: string;
  created_at: string;
};

export type DailyPrompt = {
  id: string;
  prompt: string;
  hour: number;
  minute: number;
  updated_at: string;
};

export type DailyPromptRun = {
  id: string;
  run_date: string;
  prompt: string;
  response: string;
  created_at: string;
};

export type Plant = {
  id: string;
  name: string;
  species: string | null;
  fun_fact: string | null;
  location: string | null;
  lifecycle: string | null;
  size_cm: number | null;
  spacing_cm: number | null;
  growth_habit: string[];
  sun_needs: string | null;
  season_notes: string | null;
  water_notes: string | null;
  water_tags: string[];
  watering_method: string[];
  watering_soak_minutes: number | null;
  growing_method: string | null;
  pot_min_liters: number | null;
  pot_recommended_liters: number | null;
  pot_min_depth_cm: number | null;
  pot_recommended_depth_cm: number | null;
  pot_water_notes: string | null;
  water_interval_days: number | null;
  pot_water_interval_days: number | null;
  last_watered_at: string | null;
  last_water_reminder_sent_at: string | null;
  water_skip_until: string | null;
  feeding_notes: string | null;
  feeding_interval_days: number | null;
  last_fed_at: string | null;
  last_feeding_reminder_sent_at: string | null;
  feeding_reminders_enabled: boolean;
  feeding_months: string[];
  soil_notes: string | null;
  soil_ph_min: number | null;
  soil_ph_max: number | null;
  temperature_notes: string | null;
  humidity_notes: string | null;
  winter_hardiness: string | null;
  winter_notes: string | null;
  pruning_notes: string | null;
  pest_notes: string | null;
  toxic_to_humans: boolean;
  toxic_to_cats: boolean;
  toxicity_notes: string | null;
  general_notes: string | null;
  sow_months: string[];
  sow_week: string | null;
  sow_notes: string | null;
  bloom_months: string[];
  bloom_week: string | null;
  bloom_notes: string | null;
  propagation_methods: string[];
  propagation_notes: string | null;
  harvest_notes: string | null;
  harvest_months: string[];
  harvest_week: string | null;
  greenhouse_notes: string | null;
  category: string | null;
  photo_url: string | null;
  planted: boolean;
  planted_at: string | null;
  reminders_enabled: boolean;
  // Individual-plant reality (distinct from the botanical advice fields
  // above, e.g. pot_recommended_liters / soil_notes / size_cm).
  health_status: PlantHealthStatus | null;
  last_checked_at: string | null;
  pot_size_liters: number | null;
  pot_material: PotMaterial | null;
  pot_color: string | null;
  soil_type: string | null;
  soil_mix_notes: string | null;
  last_repotted_at: string | null;
  acquired_at: string | null;
  source: string | null;
  price: number | null;
  first_flower_at: string | null;
  first_fruit_at: string | null;
  created_at: string;
};

/**
 * Shape of one entry in a plant-catalog import JSON (array or single object).
 * Differs from `Plant` in three ways:
 *   1. `sun_needs` may be a string array (new format) or a comma string (legacy export).
 *   2. `greenhouse_pref` is a separate field that the importer merges into `greenhouse_notes`.
 *   3. Numeric fields may arrive as strings because JSON from ChatGPT sometimes quotes numbers.
 * Database-generated fields (id, created_at, water_tags, *_reminder_sent_at) are absent.
 */
export type PlantImportData = {
  name: string;
  species?: string | null;
  fun_fact?: string | null;
  location?: string | null;
  category?: string | null;
  lifecycle?: string | null;
  size_cm?: string | number | null;
  spacing_cm?: string | number | null;
  growth_habit?: string[];
  sun_needs?: string | string[] | null;
  season_notes?: string | null;
  water_notes?: string | null;
  watering_method?: string[];
  watering_soak_minutes?: string | number | null;
  growing_method?: string | null;
  pot_min_liters?: string | number | null;
  pot_recommended_liters?: string | number | null;
  pot_min_depth_cm?: string | number | null;
  pot_recommended_depth_cm?: string | number | null;
  pot_water_notes?: string | null;
  water_interval_days?: string | number | null;
  pot_water_interval_days?: string | number | null;
  last_watered_at?: string | null;
  reminders_enabled?: boolean;
  greenhouse_pref?: string | null;
  greenhouse_notes?: string | null;
  feeding_notes?: string | null;
  feeding_interval_days?: string | number | null;
  last_fed_at?: string | null;
  feeding_reminders_enabled?: boolean;
  feeding_months?: string[];
  soil_notes?: string | null;
  soil_ph_min?: string | number | null;
  soil_ph_max?: string | number | null;
  temperature_notes?: string | null;
  humidity_notes?: string | null;
  winter_hardiness?: string | null;
  winter_notes?: string | null;
  pruning_notes?: string | null;
  pest_notes?: string | null;
  toxic_to_humans?: boolean;
  toxic_to_cats?: boolean;
  toxicity_notes?: string | null;
  sow_months?: string[];
  sow_week?: string | null;
  sow_notes?: string | null;
  bloom_months?: string[];
  bloom_week?: string | null;
  bloom_notes?: string | null;
  propagation_methods?: string[];
  propagation_notes?: string | null;
  harvest_months?: string[];
  harvest_week?: string | null;
  harvest_notes?: string | null;
  general_notes?: string | null;
  photo_url?: string | null;
  planted?: boolean;
  planted_at?: string | null;
  health_status?: string | null;
  last_checked_at?: string | null;
  water_skip_until?: string | null;
  first_flower_at?: string | null;
  first_fruit_at?: string | null;
  pot_size_liters?: string | number | null;
  pot_material?: string | null;
  pot_color?: string | null;
  soil_type?: string | null;
  soil_mix_notes?: string | null;
  last_repotted_at?: string | null;
  acquired_at?: string | null;
  source?: string | null;
  price?: string | number | null;
};

export type PlantHealthStatus =
  | "Zaailing"
  | "Net geplant"
  | "Gezond"
  | "In bloei"
  | "Vruchten"
  | "Stress"
  | "Ziek"
  | "Afgestorven";

export type PotMaterial =
  | "Terracotta"
  | "Kunststof"
  | "Keramiek"
  | "Metaal"
  | "Hout"
  | "Textiel"
  | "Steen"
  | "Biologisch afbreekbaar"
  | "Anders";

// ─── Species / instance / season split ─────────────────────────────────────
// `Plant` (above) is the permanent species catalog (botanical + care advice).
// `PlantInstance` is one physical planted specimen of a species — multiple
// instances may share the same species_id. `GrowingSeason` is one
// cultivation round for one instance. Deleting/completing an instance or
// season never touches the species row (species_id uses on delete restrict).

export type CultivationType = "pot" | "open_ground" | "raised_bed";
export type IndoorOutdoorType = "outdoor" | "indoor";

export type PlantInstanceStatus = "active" | "dormant" | "archived" | "dead" | "removed";

export type GrowingSeasonStatus = "active" | "completed" | "failed";

// individual = deze rij stelt precies 1 fysieke plant voor (quantity is dan
// altijd 1, afgedwongen door een DB check-constraint). batch = deze rij
// stelt een groep samen bijgehouden planten voor, bv. een bak veldsla —
// water/voeding/groeifoto's blijven ongewijzigd één actie per rij, ongeacht
// tracking_mode (zie usePlantCareActions.ts). Zie migratie
// 20260905000000_plant_instance_batch_tracking.sql voor de volledige
// semantiek van quantity.
export type TrackingMode = "individual" | "batch";

export type PlantInstance = {
  id: string;
  species_id: string;
  custom_name: string | null;
  location: string | null;
  cultivation_type: CultivationType | null;
  indoor_outdoor: IndoorOutdoorType | null;
  pot_size_liters: number | null;
  pot_material: string | null;
  pot_color: string | null;
  soil_type: string | null;
  soil_mix_notes: string | null;
  planted_at: string | null;
  acquired_at: string | null;
  source: string | null;
  price: number | null;
  health_status: PlantHealthStatus | null;
  last_checked_at: string | null;
  last_repotted_at: string | null;
  first_flower_at: string | null;
  first_fruit_at: string | null;
  reminders_enabled: boolean;
  feeding_reminders_enabled: boolean;
  last_watered_at: string | null;
  last_fed_at: string | null;
  last_water_reminder_sent_at: string | null;
  last_feeding_reminder_sent_at: string | null;
  water_skip_until: string | null;
  status: PlantInstanceStatus;
  legacy_plant_id: string | null;
  // Set when this instance was created via "Plant nu" from a cultivation plan
  // item. ON DELETE SET NULL so deleting a plan never removes instances.
  cultivation_plan_item_id: string | null;
  tracking_mode: TrackingMode;
  // Huidig aantal levende/groeiende planten in deze registratie. Altijd 1
  // bij tracking_mode "individual". Bij "batch": null = nog niet geteld
  // (NOOIT 0 voor "onbekend" — 0 betekent letterlijk nul planten over).
  quantity: number | null;
  // Verwijst naar de zaailing-instance waaruit dit exemplaar ontstond via
  // "Zaailing uitplanten" (plant_seedling_to_instances). Puur relationeel —
  // gebruikt om de fotohistorie van vóór de split erbij te tonen (zie
  // useAncestorGrowthHistory). Null voor exemplaren die niet uit een split
  // ontstonden. Zie 20260906000000_qr_labels_and_photo_lineage.sql.
  derived_from_instance_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowingSeason = {
  id: string;
  plant_instance_id: string;
  year: number;
  label: string | null;
  started_at: string;
  ended_at: string | null;
  status: GrowingSeasonStatus;
  closing_reason: string | null;
  closing_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlantInstanceWithSpecies = PlantInstance & { species: Plant };

export type PlantPhoto = {
  id: string;
  plant_id: string;
  photo_url: string;
  note: string | null;
  taken_at: string;
  // Nullable, additive instance/season linkage (see
  // 20260802060000_plant_photos_instance_columns.sql) — null means a
  // legacy/general species-level photo, exactly as before this column
  // existed; set means the photo belongs to one concrete instance.
  plant_instance_id: string | null;
  growing_season_id: string | null;
};

export type PlantHarvestLog = {
  id: string;
  plant_id: string;
  // Nullable, additive instance/season linkage — populated whenever a
  // harvest is logged from the instance detail dialog; null for legacy
  // species-level rows created before instances existed (see
  // 20260802040000_logs_instance_season_columns.sql).
  plant_instance_id: string | null;
  growing_season_id: string | null;
  harvested_at: string;
  weight_grams: number | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
};

export type PlantPruningLog = {
  id: string;
  plant_id: string;
  plant_instance_id: string | null;
  growing_season_id: string | null;
  pruned_at: string;
  pruning_type: string | null;
  notes: string | null;
  created_at: string;
};

export type PlantRepotLog = {
  id: string;
  plant_id: string;
  plant_instance_id: string | null;
  growing_season_id: string | null;
  repotted_at: string;
  old_pot_size_liters: number | null;
  new_pot_size_liters: number | null;
  pot_material: string | null;
  soil_type: string | null;
  notes: string | null;
  created_at: string;
};

// Instance-aware inspection history (phase 3) — always tied to a concrete
// plant_instance_id, unlike the legacy species-level *_logs tables above.
export type PlantInspectionLog = {
  id: string;
  plant_instance_id: string;
  growing_season_id: string | null;
  checked_at: string;
  health_status: PlantHealthStatus | null;
  notes: string | null;
  issues: string | null;
  action_taken: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Teeltplanner ────────────────────────────────────────────────────────────

export type CultivationPlanStatus = "draft" | "active" | "completed" | "archived";

export type CultivationPlan = {
  id: string;
  name: string;
  plan_year: number;
  status: CultivationPlanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CultivationPlanItem = {
  id: string;
  cultivation_plan_id: string;
  species_id: string;
  planned_quantity: number;
  backup_quantity: number;
  planted_quantity: number;
  planned_location: string | null;
  notes: string | null;
  pot_liters_override: number | null;
  created_at: string;
  updated_at: string;
};

export type CultivationPlanWithItems = CultivationPlan & {
  items: CultivationPlanItem[];
};

// Storage-backed photo linked to a growth_log_entry. One entry can have
// zero, one, or multiple photos. plant_instance_id is denormalized from
// the parent entry for fast per-instance queries.
export type GrowthLogPhoto = {
  id: string;
  growth_log_entry_id: string;
  plant_instance_id: string; // NOT NULL: always mirrors the parent entry's plant_instance_id
  storage_path: string;
  photo_url: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

// ─── QR-labels ───────────────────────────────────────────────────────────
// Een label is een permanente, herbruikbare rij (staat voor de fysieke
// sticker); de koppeling naar een plant_instance is losstaand en
// historisch bijgehouden zodat een sticker na vrijgeven opnieuw te
// gebruiken is. Zie 20260906000000_qr_labels_and_photo_lineage.sql.
export type QrLabel = {
  id: string;
  code: string;
  note: string | null;
  created_at: string;
  // Soft-delete/archief-tijdstip. Null = normaal actief label. Niet-null =
  // "verwijderd" — verdwijnt uit de standaard beheerlijst, kan nooit meer
  // gekoppeld worden, maar de rij (en zijn assignmenthistorie) blijft
  // bestaan. Zie 20260907000000_qr_label_management.sql.
  deleted_at: string | null;
};

export type PlantInstanceQrAssignment = {
  id: string;
  qr_label_id: string;
  plant_instance_id: string;
  assigned_at: string;
  // null = deze koppeling is momenteel actief.
  released_at: string | null;
};

