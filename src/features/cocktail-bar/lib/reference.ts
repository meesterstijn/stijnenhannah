import { supabase } from "@/lib/supabase";
import type { CocktailGarnish, CocktailGlassType, CocktailIngredient, CocktailSpirit } from "@/features/cocktail-bar/types";

export async function fetchCocktailSpirits(): Promise<CocktailSpirit[]> {
  const { data, error } = await supabase
    .from("cocktail_spirits")
    .select("id, name, sort_order, active")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CocktailSpirit[];
}

export async function fetchCocktailGlassTypes(): Promise<CocktailGlassType[]> {
  const { data, error } = await supabase
    .from("cocktail_glass_types")
    .select("id, name, sort_order, active")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CocktailGlassType[];
}

export async function fetchCocktailGarnishes(): Promise<CocktailGarnish[]> {
  const { data, error } = await supabase
    .from("cocktail_garnishes")
    .select("id, name, created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CocktailGarnish[];
}

export async function fetchCocktailIngredients(): Promise<CocktailIngredient[]> {
  const { data, error } = await supabase
    .from("cocktail_ingredients")
    .select("id, name, default_unit, created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CocktailIngredient[];
}
