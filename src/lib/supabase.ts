import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
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
  created_at: string;
};
