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
      .order("created_at", { ascending: true });
    if (error || !data || data.length === 0) return DEFAULT_CATEGORIES;
    return data;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function saveCategories(cats: Category[]) {
  await supabase.from("product_categories").delete().neq("id", "");
  if (cats.length > 0) {
    await supabase.from("product_categories").insert(cats);
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

export async function assignCategory(product: string, categoryId: string | null) {
  const key = product.toLowerCase();
  if (categoryId === null) {
    await supabase.from("product_assignments").delete().eq("product", key);
  } else {
    await supabase.from("product_assignments").upsert({ product: key, category_id: categoryId });
  }
}

export async function removeAssignmentsForCategory(categoryId: string) {
  await supabase.from("product_assignments").delete().eq("category_id", categoryId);
}

export async function getCategoryForProduct(product: string): Promise<string | null> {
  const { data } = await supabase
    .from("product_assignments")
    .select("category_id")
    .eq("product", product.toLowerCase())
    .single();
  return data?.category_id ?? null;
}
