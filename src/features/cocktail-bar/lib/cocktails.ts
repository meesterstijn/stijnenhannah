import { supabase } from "@/lib/supabase";
import type {
  Cocktail,
  CocktailFull,
  CocktailVariantFull,
} from "@/features/cocktail-bar/types";

const COCKTAIL_COLUMNS = "id, name, tagline, backstory, photo_storage_path, is_published, created_by, created_at, updated_at";

// Eén geneste query i.p.v. losse fetches per tabel — RLS filtert de
// geëmbedde variants/ingrediënten voor cocktail_guest al vanzelf tot alleen
// gepubliceerde cocktails (zie 20260818020000_cocktail_bar_core.sql), dus
// deze functie hoeft daar zelf niets voor te doen.
const COCKTAIL_FULL_COLUMNS = `
  ${COCKTAIL_COLUMNS},
  variants:cocktail_variants(
    id, cocktail_id, variant_type, glass_type_id, spirit_id, garnish_id,
    abv_percent, preparation_steps, photo_storage_path, created_at, updated_at,
    flavour_profile:cocktail_flavour_profiles(variant_id, sweet_score, sour_score, bitter_score, fresh_score, strong_score, updated_at),
    ingredients:cocktail_variant_ingredients(
      id, variant_id, ingredient_id, amount, unit, note, sort_order,
      ingredient:cocktail_ingredients(name)
    ),
    spirit:cocktail_spirits(id, name, sort_order, active),
    glass_type:cocktail_glass_types(id, name, sort_order, active),
    garnish:cocktail_garnishes(id, name, created_at)
  )
`;

// Ruwe vorm zoals PostgREST 'm teruggeeft voor de geneste query hierboven —
// wordt door mapCocktailFullRow() omgezet naar het schone CocktailFull-type
// uit types.ts (o.a. ingredient.name -> ingredient_name plattrekken).
type RawCocktailFullRow = Cocktail & {
  variants: (Omit<CocktailVariantFull, "flavour_profile" | "ingredients" | "spirit" | "glass_type" | "garnish"> & {
    flavour_profile: CocktailVariantFull["flavour_profile"] | null;
    ingredients: (Omit<CocktailVariantFull["ingredients"][number], "ingredient_name"> & {
      ingredient: { name: string } | null;
    })[];
    spirit: CocktailVariantFull["spirit"] | null;
    glass_type: CocktailVariantFull["glass_type"] | null;
    garnish: CocktailVariantFull["garnish"] | null;
  })[];
};

function mapCocktailFullRow(row: RawCocktailFullRow): CocktailFull {
  return {
    ...row,
    variants: row.variants.map((v) => ({
      ...v,
      flavour_profile: v.flavour_profile ?? null,
      ingredients: v.ingredients
        .map((i) => ({ ...i, ingredient_name: i.ingredient?.name ?? "" }))
        .sort((a, b) => a.sort_order - b.sort_order),
      spirit: v.spirit ?? null,
      glass_type: v.glass_type ?? null,
      garnish: v.garnish ?? null,
    })),
  };
}

export async function fetchPublishedCocktails(): Promise<Cocktail[]> {
  const { data, error } = await supabase
    .from("cocktails")
    .select(COCKTAIL_COLUMNS)
    .eq("is_published", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Cocktail[];
}

// Owner-only lijstweergave (beheer) — toont ALLE cocktails, gepubliceerd én
// concept, in tegenstelling tot fetchPublishedCocktails().
export async function fetchAllCocktails(): Promise<Cocktail[]> {
  const { data, error } = await supabase
    .from("cocktails")
    .select(COCKTAIL_COLUMNS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Cocktail[];
}

export async function fetchCocktailFull(cocktailId: string): Promise<CocktailFull | null> {
  const { data, error } = await supabase
    .from("cocktails")
    .select(COCKTAIL_FULL_COLUMNS)
    .eq("id", cocktailId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapCocktailFullRow(data as unknown as RawCocktailFullRow);
}

// Voor de showcase/tablet-kaartenoverzicht: één query die meteen de
// smaakscores/basisdrank/ingrediënten van elke variant meebrengt, i.p.v. per
// kaart een losse fetchCocktailFull()-aanroep (N+1).
export async function fetchPublishedCocktailsFull(): Promise<CocktailFull[]> {
  const { data, error } = await supabase
    .from("cocktails")
    .select(COCKTAIL_FULL_COLUMNS)
    .eq("is_published", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RawCocktailFullRow[]).map(mapCocktailFullRow);
}

// De "hoofd"-variant voor kaartweergave/filtering: de alcoholische variant
// als die bestaat, anders de alcoholvrije (voor cocktails die uitsluitend
// als mocktail zijn aangemaakt). Puur een keuze voor WELKE variant een kaart
// toont als representatief — verandert niets aan de opslag, en de volledige
// alcoholvrije variant blijft altijd los bekijkbaar in het detailvenster.
export function getPrimaryVariant(cocktail: CocktailFull): CocktailVariantFull | null {
  return (
    cocktail.variants.find((v) => v.variant_type === "alcoholic") ??
    cocktail.variants.find((v) => v.variant_type === "alcohol_free") ??
    null
  );
}
