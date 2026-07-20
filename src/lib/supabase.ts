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
  created_at: string;
};

export type PlantHealthStatus =
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

export type PlantPhoto = {
  id: string;
  plant_id: string;
  photo_url: string;
  note: string | null;
  taken_at: string;
};

export type PlantHarvestLog = {
  id: string;
  plant_id: string;
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
  pruned_at: string;
  pruning_type: string | null;
  notes: string | null;
  created_at: string;
};

export type PlantRepotLog = {
  id: string;
  plant_id: string;
  repotted_at: string;
  old_pot_size_liters: number | null;
  new_pot_size_liters: number | null;
  pot_material: string | null;
  soil_type: string | null;
  notes: string | null;
  created_at: string;
};

