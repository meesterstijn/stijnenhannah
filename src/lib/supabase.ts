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
