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
  sun_needs: string | null;
  season_notes: string | null;
  water_notes: string | null;
  water_tags: string[];
  water_interval_days: number | null;
  last_watered_at: string | null;
  last_water_reminder_sent_at: string | null;
  feeding_notes: string | null;
  soil_notes: string | null;
  temperature_notes: string | null;
  humidity_notes: string | null;
  winter_hardiness: string | null;
  winter_notes: string | null;
  pruning_notes: string | null;
  pest_notes: string | null;
  toxic_to_humans: boolean;
  toxic_to_cats: boolean;
  toxicity_notes: string | null;
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
  photo_url: string | null;
  reminders_enabled: boolean;
  created_at: string;
};

export type PlantPhoto = {
  id: string;
  plant_id: string;
  photo_url: string;
  note: string | null;
  taken_at: string;
};
