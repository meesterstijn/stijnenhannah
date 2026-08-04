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

// "Maak aan, of geef de bestaande terug" — beide catalogi hebben een CI-
// unique index op naam (zie 20260818010000_cocktail_bar_reference_data.sql).
// Typt de wizard-gebruiker een naam die al bestaat (evt. andere hoofdletters),
// dan botst de insert (23505); i.p.v. dat als fout te tonen zoeken we de
// bestaande rij op en geven die terug — de gebruiker krijgt gewoon zijn
// ingrediënt/garnering, ongeacht of het nieuw was.
export async function createIngredient(name: string, defaultUnit: string | null): Promise<CocktailIngredient> {
  const { data, error } = await supabase
    .from("cocktail_ingredients")
    .insert({ name: name.trim(), default_unit: defaultUnit })
    .select("id, name, default_unit, created_at")
    .single();
  if (!error) return data as CocktailIngredient;
  if (error.code !== "23505") throw error;

  const { data: existing, error: fetchError } = await supabase
    .from("cocktail_ingredients")
    .select("id, name, default_unit, created_at")
    .ilike("name", name.trim())
    .single();
  if (fetchError) throw fetchError;
  return existing as CocktailIngredient;
}

export async function createGarnish(name: string): Promise<CocktailGarnish> {
  const { data, error } = await supabase.from("cocktail_garnishes").insert({ name: name.trim() }).select("id, name, created_at").single();
  if (!error) return data as CocktailGarnish;
  if (error.code !== "23505") throw error;

  const { data: existing, error: fetchError } = await supabase
    .from("cocktail_garnishes")
    .select("id, name, created_at")
    .ilike("name", name.trim())
    .single();
  if (fetchError) throw fetchError;
  return existing as CocktailGarnish;
}
