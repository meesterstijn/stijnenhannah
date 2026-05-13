import { supabase } from "./supabase";

export type Category = { id: string; name: string };

const DEFAULT_CATEGORIES: Category[] = [
  { id: "groente-fruit", name: "Groente & Fruit" },
  { id: "vlees-vis", name: "Vlees & Vis" },
  { id: "zuivel", name: "Zuivel & Eieren" },
  { id: "brood", name: "Brood & Bakkerij" },
  { id: "dranken", name: "Dranken" },
  { id: "diepvries", name: "Diepvries" },
  { id: "huishouden", name: "Huishouden" },
  { id: "overig", name: "Overig" },
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
