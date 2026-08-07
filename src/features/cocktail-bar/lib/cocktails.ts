import { supabase } from "@/lib/supabase";
import type {
  Cocktail,
  CocktailFull,
  CocktailVariantFull,
  CocktailVariantType,
} from "@/features/cocktail-bar/types";

const COCKTAIL_COLUMNS =
  "id, name, tagline, backstory, photo_storage_path, is_published, created_by, created_at, updated_at";

// Eén geneste query i.p.v. losse fetches per tabel — RLS filtert de
// geëmbedde variants/ingrediënten voor cocktail_guest al vanzelf tot alleen
// gepubliceerde cocktails (zie 20260818020000_cocktail_bar_core.sql), dus
// deze functie hoeft daar zelf niets voor te doen.
// glass_type/glass_type_2 verwijzen allebei naar cocktail_glass_types, dus
// PostgREST kan de relatie niet meer automatisch raden zodra er twee FK's
// naar dezelfde tabel zijn — vandaar de expliciete !constraint_name-hints.
const COCKTAIL_FULL_COLUMNS = `
  ${COCKTAIL_COLUMNS},
  variants:cocktail_variants(
    id, cocktail_id, variant_type, glass_type_id, glass_note, glass_type_id_2, glass_note_2,
    shake_with_ice, dry_shake_first, build_in_glass,
    spirit_id, garnish_id,
    abv_percent, preparation_steps, photo_storage_path, created_at, updated_at,
    flavour_profile:cocktail_flavour_profiles(variant_id, sweet_score, sour_score, bitter_score, fresh_score, strong_score, updated_at),
    ingredients:cocktail_variant_ingredients(
      id, variant_id, ingredient_id, amount, unit, note, sort_order,
      ingredient:cocktail_ingredients(name)
    ),
    spirit:cocktail_spirits(id, name, sort_order, active),
    glass_type:cocktail_glass_types!cocktail_variants_glass_type_id_fkey(id, name, sort_order, active),
    glass_type_2:cocktail_glass_types!cocktail_variants_glass_type_id_2_fkey(id, name, sort_order, active),
    garnish:cocktail_garnishes(id, name, created_at)
  )
`;

// Ruwe vorm zoals PostgREST 'm teruggeeft voor de geneste query hierboven —
// wordt door mapCocktailFullRow() omgezet naar het schone CocktailFull-type
// uit types.ts (o.a. ingredient.name -> ingredient_name plattrekken).
type RawCocktailFullRow = Cocktail & {
  variants: (Omit<
    CocktailVariantFull,
    | "flavour_profile"
    | "ingredients"
    | "spirit"
    | "glass_type"
    | "glass_type_2"
    | "garnish"
  > & {
    flavour_profile: CocktailVariantFull["flavour_profile"] | null;
    ingredients: (Omit<
      CocktailVariantFull["ingredients"][number],
      "ingredient_name"
    > & {
      ingredient: { name: string } | null;
    })[];
    spirit: CocktailVariantFull["spirit"] | null;
    glass_type: CocktailVariantFull["glass_type"] | null;
    glass_type_2: CocktailVariantFull["glass_type_2"] | null;
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
      glass_type_2: v.glass_type_2 ?? null,
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

export async function fetchCocktailFull(
  cocktailId: string,
): Promise<CocktailFull | null> {
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
  return ((data ?? []) as unknown as RawCocktailFullRow[]).map(
    mapCocktailFullRow,
  );
}

// ─── Beheer (owner-only, fase 4) ────────────────────────────────────────────

export async function createCocktail(input: {
  name: string;
  tagline: string;
  backstory: string | null;
}): Promise<Cocktail> {
  const { data, error } = await supabase
    .from("cocktails")
    .insert({
      name: input.name,
      tagline: input.tagline,
      backstory: input.backstory,
      is_published: false,
    })
    .select(COCKTAIL_COLUMNS)
    .single();
  if (error) throw error;
  return data as Cocktail;
}

export async function updateCocktail(
  cocktailId: string,
  patch: Partial<
    Pick<
      Cocktail,
      "name" | "tagline" | "backstory" | "photo_storage_path" | "is_published"
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from("cocktails")
    .update(patch)
    .eq("id", cocktailId);
  if (error) throw error;
}

export async function setCocktailPublished(
  cocktailId: string,
  isPublished: boolean,
): Promise<void> {
  await updateCocktail(cocktailId, { is_published: isPublished });
}

// cocktail_orders.cocktail_id staat op "on delete restrict" — een cocktail
// verwijderen mag dus altijd, ook als er nog (test)bestellingen naar
// verwijzen: die worden hier eerst verwijderd. cocktail_highlights.cocktail_id/
// order_id staan al op "on delete set null" (zie migraties), dus gekoppelde
// presentaties blijven bestaan en verliezen alleen de koppeling.
export async function deleteCocktail(cocktailId: string): Promise<void> {
  const { error: ordersError } = await supabase
    .from("cocktail_orders")
    .delete()
    .eq("cocktail_id", cocktailId);
  if (ordersError) throw ordersError;

  const { error } = await supabase
    .from("cocktails")
    .delete()
    .eq("id", cocktailId);
  if (error) throw error;
}

export type SaveCocktailVariantInput = {
  cocktailId: string;
  variantType: CocktailVariantType;
  glassTypeId: string | null;
  glassNote: string | null;
  glassTypeId2: string | null;
  glassNote2: string | null;
  shakeWithIce: boolean;
  dryShakeFirst: boolean;
  buildInGlass: boolean;
  spiritId: string | null;
  garnishId: string | null;
  abvPercent: number;
  preparationSteps: string;
  photoStoragePath: string | null;
  sweetScore: number;
  sourScore: number;
  bitterScore: number;
  freshScore: number;
  strongScore: number;
  ingredients: {
    ingredientId: string;
    amount: number;
    unit: string;
    note: string | null;
    sortOrder: number;
  }[];
};

// Wrapper om de save_cocktail_variant-RPC (atomair: variant + smaakprofiel +
// volledige ingrediëntenlijst in één transactie, zie
// 20260818030000_cocktail_bar_save_variant_rpc.sql) — de wizard stuurt
// steeds de complete actuele ingrediëntenlijst mee.
export async function saveCocktailVariant(
  input: SaveCocktailVariantInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("save_cocktail_variant", {
    p_cocktail_id: input.cocktailId,
    p_variant_type: input.variantType,
    p_glass_type_id: input.glassTypeId,
    p_glass_note: input.glassNote,
    p_glass_type_id_2: input.glassTypeId2,
    p_glass_note_2: input.glassNote2,
    p_shake_with_ice: input.shakeWithIce,
    p_dry_shake_first: input.dryShakeFirst,
    p_build_in_glass: input.buildInGlass,
    p_spirit_id: input.spiritId,
    p_garnish_id: input.garnishId,
    p_abv_percent: input.abvPercent,
    p_preparation_steps: input.preparationSteps,
    p_photo_storage_path: input.photoStoragePath,
    p_sweet_score: input.sweetScore,
    p_sour_score: input.sourScore,
    p_bitter_score: input.bitterScore,
    p_fresh_score: input.freshScore,
    p_strong_score: input.strongScore,
    p_ingredients: input.ingredients.map((i) => ({
      ingredient_id: i.ingredientId,
      amount: i.amount,
      unit: i.unit,
      note: i.note,
      sort_order: i.sortOrder,
    })),
  });
  if (error) throw error;
  return data as string;
}

// De "hoofd"-variant voor kaartweergave/filtering: de alcoholische variant
// als die bestaat, anders de 2e variant, anders de alcoholvrije (voor
// cocktails die uitsluitend als mocktail zijn aangemaakt). Puur een keuze
// voor WELKE variant een kaart toont als representatief — verandert niets
// aan de opslag, en alle varianten blijven altijd los bekijkbaar in het
// detailvenster.
export function getPrimaryVariant(
  cocktail: CocktailFull,
): CocktailVariantFull | null {
  return (
    cocktail.variants.find((v) => v.variant_type === "alcoholic") ??
    cocktail.variants.find((v) => v.variant_type === "alcoholic_variant") ??
    cocktail.variants.find((v) => v.variant_type === "alcohol_free") ??
    null
  );
}
