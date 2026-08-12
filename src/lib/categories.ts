import { supabase } from "./supabase";

export type Category = { id: string; name: string };

const DEFAULT_CATEGORIES: Category[] = [
  { id: "groente-fruit", name: "Groente en fruit" },
  { id: "aardappelen-uien", name: "Aardappelen, uien en knoflook" },
  { id: "verse-sappen", name: "Verse sappen" },
  { id: "salades", name: "Salades voor brood" },
  { id: "kaas-worst", name: "Kaas en worst" },
  { id: "brood", name: "Brood" },
  { id: "zuivel", name: "Zuivel" },
  { id: "eieren", name: "Eieren" },
  { id: "koffie-thee", name: "Koffie en thee" },
  { id: "koeken", name: "Koeken" },
  { id: "ontbijt-granen", name: "Ontbijt en granen" },
  { id: "conserven-blik", name: "Conserven en blik" },
  { id: "buitenlandse-keuken", name: "Buitenlandse keuken" },
  { id: "sauzen", name: "Sauzen" },
  { id: "bier-wijn", name: "Bier en wijn" },
  { id: "borrelnoten", name: "Borrelnoten" },
  { id: "roomboter", name: "Roomboter" },
  { id: "siroop", name: "Siroop" },
  { id: "chips", name: "Chips" },
  { id: "frisdranken", name: "Frisdranken" },
  { id: "prik-water", name: "Prik water" },
  { id: "diepvriesproducten", name: "Diepvriesproducten" },
  { id: "chocolade-snoep", name: "Chocolade en snoep" },
  { id: "huishoudspullen", name: "Huishoudspullen" },
  { id: "schoonmaakspullen", name: "Schoonmaakspullen" },
];

export async function getCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from("product_categories")
      .select("id, name")
      .order("sort_order", { ascending: true });
    if (error || !data || data.length === 0) return DEFAULT_CATEGORIES;
    return data;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function saveCategories(cats: Category[]) {
  await supabase.from("product_categories").delete().neq("id", "");
  if (cats.length > 0) {
    await supabase
      .from("product_categories")
      .insert(cats.map((c, i) => ({ ...c, sort_order: i })));
  }
}

export async function getAssignments(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from("product_assignments")
      .select("product, category_id");
    if (error || !data) return {};
    return Object.fromEntries(data.map((r) => [r.product, r.category_id]));
  } catch {
    return {};
  }
}

export async function assignCategory(
  product: string,
  categoryId: string | null,
) {
  const key = product.toLowerCase();
  if (categoryId === null) {
    await supabase.from("product_assignments").delete().eq("product", key);
  } else {
    await supabase
      .from("product_assignments")
      .upsert({ product: key, category_id: categoryId });
  }
}

export async function removeAssignmentsForCategory(categoryId: string) {
  await supabase
    .from("product_assignments")
    .delete()
    .eq("category_id", categoryId);
}

export async function getCategoryForProduct(
  product: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("product_assignments")
    .select("category_id")
    .eq("product", product.toLowerCase())
    .single();
  return data?.category_id ?? null;
}

// Boodschappenproduct <-> canoniek product (V1). De koppeling leeft op
// product_assignments (het blijvende boodschappenproduct-record) en NIET op
// de tijdelijke groceries-regels — zie het onderzoek dat hieraan voorafging.
// Eén bulkquery met een embed naar products (via de nieuwe
// canonical_product_id-FK) i.p.v. een aparte query per product: geen N+1.
export type ProductAssignmentCatalogLink = {
  product: string;
  canonicalProductId: string | null;
  canonicalProductName: string | null;
};

export async function fetchProductAssignmentCatalogLinks(): Promise<
  ProductAssignmentCatalogLink[]
> {
  const { data, error } = await supabase
    .from("product_assignments")
    .select(
      "product, canonical_product_id, catalog_product:products(canonical_name)",
    );
  if (error) throw error;
  return (data ?? []).map((row) => {
    // Supabase's gegenereerde typing voor een geëmbedde relatie zonder
    // Database-schema-type gaat uit van een array, ook al levert PostgREST
    // hier altijd een los object (of null) terug voor deze many-to-one-
    // relatie (product_assignments.canonical_product_id -> products.id) —
    // vandaar deze defensieve normalisatie i.p.v. rechtstreeks .canonical_name.
    const catalogProduct = Array.isArray(row.catalog_product)
      ? row.catalog_product[0]
      : row.catalog_product;
    return {
      product: row.product,
      canonicalProductId: row.canonical_product_id,
      canonicalProductName: catalogProduct?.canonical_name ?? null,
    };
  });
}

// Wijzigt uitsluitend product_assignments.canonical_product_id van een al
// bestaande rij (een product zonder categorie heeft nog geen
// product_assignments-rij en dus ook geen catalogusknop in de UI — zie
// opleverrapport). canonicalProductId = null maakt de koppeling ongedaan
// zonder de assignment/categorie zelf aan te raken.
export async function updateProductAssignmentCanonicalProduct(
  product: string,
  canonicalProductId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("product_assignments")
    .update({ canonical_product_id: canonicalProductId })
    .eq("product", product.toLowerCase());
  if (error) throw error;
}
