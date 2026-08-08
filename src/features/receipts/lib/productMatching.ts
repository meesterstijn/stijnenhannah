// Productmatching v1 — alleen exacte winkel-specifieke aliasmatching +
// handmatige bevestiging (zie 20260829000000_receipt_matching_v1_rpc.sql).
// Geen fuzzy/AI-matching, geen automatische catalogus-aanmaak: products/
// product_variants worden hier alleen aangemaakt na expliciete
// gebruikersactie vanuit de review-UI.
import { supabase } from "@/lib/supabase";

export const COMPARISON_UNITS = ["kg", "liter", "piece", "none"] as const;
export type ComparisonUnit = (typeof COMPARISON_UNITS)[number];

export type Product = {
  id: string;
  canonical_name: string;
  category_id: string | null;
  comparison_unit: ComparisonUnit;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  brand: string | null;
  variant_name: string;
  store_id: string | null;
  package_size: number | null;
  package_unit: string | null;
};

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, canonical_name, category_id, comparison_unit")
    .order("canonical_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(input: {
  canonicalName: string;
  categoryId: string | null;
  comparisonUnit: ComparisonUnit;
}): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert({
      canonical_name: input.canonicalName.trim(),
      category_id: input.categoryId,
      comparison_unit: input.comparisonUnit,
    })
    .select("id, canonical_name, category_id, comparison_unit")
    .single();
  if (error) throw error;
  return data;
}

export async function createProductVariant(input: {
  productId: string;
  variantName: string;
  brand: string | null;
  storeId: string | null;
  packageSize: number | null;
  packageUnit: string | null;
}): Promise<ProductVariant> {
  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      product_id: input.productId,
      variant_name: input.variantName.trim(),
      brand: input.brand,
      store_id: input.storeId,
      package_size: input.packageSize,
      package_unit: input.packageUnit,
    })
    .select(
      "id, product_id, brand, variant_name, store_id, package_size, package_unit",
    )
    .single();
  if (error) throw error;
  return data;
}

export type UnmatchedReceiptItem = {
  id: string;
  receipt_id: string;
  raw_name: string;
  raw_brand: string | null;
  quantity: number | null;
  weight: number | null;
  weight_unit: string | null;
  paid_line_total: number | null;
  matching_status: string;
  receipt_store_id: string | null;
  receipt_store_name: string | null;
  purchase_date: string;
};

type RawUnmatchedRow = {
  id: string;
  receipt_id: string;
  raw_name: string;
  raw_brand: string | null;
  quantity: number | null;
  weight: number | null;
  weight_unit: string | null;
  paid_line_total: number | null;
  matching_status: string;
  shopping_receipts: {
    store_id: string | null;
    raw_store_name: string | null;
    purchase_date: string;
  } | null;
};

// Alleen echte productregels (nooit discount/deposit/service_or_other — die
// hebben geen productidentiteit om te matchen) die nog niet betrouwbaar
// gekoppeld zijn. Hints uit source_json worden in v1 bewust niet
// teruggehaald (zou een fragiele match-op-raw_name in een JSONB-array
// vereisen voor beperkte meerwaarde) — raw data is en blijft leidend voor
// review.
export async function fetchUnmatchedReceiptItems(): Promise<
  UnmatchedReceiptItem[]
> {
  const { data, error } = await supabase
    .from("shopping_receipt_items")
    .select(
      "id, receipt_id, raw_name, raw_brand, quantity, weight, weight_unit, paid_line_total, matching_status, shopping_receipts(store_id, raw_store_name, purchase_date)",
    )
    .eq("line_type", "product")
    .in("matching_status", ["unmatched", "needs_review"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as RawUnmatchedRow[]).map((row) => ({
    id: row.id,
    receipt_id: row.receipt_id,
    raw_name: row.raw_name,
    raw_brand: row.raw_brand,
    quantity: row.quantity,
    weight: row.weight,
    weight_unit: row.weight_unit,
    paid_line_total: row.paid_line_total,
    matching_status: row.matching_status,
    receipt_store_id: row.shopping_receipts?.store_id ?? null,
    receipt_store_name: row.shopping_receipts?.raw_store_name ?? null,
    purchase_date: row.shopping_receipts?.purchase_date ?? "",
  }));
}

// Lichte, losse telling (head:true, geen rijen) — zodat ReceiptImportCard
// het aantal kan tonen ("Onbekende producten · 38") zonder de volledige
// lijst op te hoeven halen wanneer de review-sheet nog dicht is.
export async function fetchUnmatchedReceiptItemCount(): Promise<number> {
  const { count, error } = await supabase
    .from("shopping_receipt_items")
    .select("id", { count: "exact", head: true })
    .eq("line_type", "product")
    .in("matching_status", ["unmatched", "needs_review"]);
  if (error) throw error;
  return count ?? 0;
}

export type MatchMethod = "manual" | "new_product" | "new_variant";

// Atomisch via RPC (bevestiging + alias in één transactie) — zie
// migratiebestand voor de conflict-afhandeling ("deze bonomschrijving is al
// gekoppeld aan een ander product").
export async function confirmReceiptItemMatch(input: {
  receiptItemId: string;
  productId: string;
  productVariantId: string | null;
  matchMethod: MatchMethod;
}): Promise<void> {
  const { error } = await supabase.rpc("confirm_receipt_item_match_v1", {
    p_receipt_item_id: input.receiptItemId,
    p_product_id: input.productId,
    p_product_variant_id: input.productVariantId,
    p_match_method: input.matchMethod,
  });
  if (error) throw error;
}

// Best-effort tweede stap na een geslaagde import — geeft het aantal
// automatisch gematchte regels terug. Faalt deze aanroep (bv. nog geen
// store_id), dan mag dat de al geslaagde receipt-import nooit ongedaan
// maken; de aanroeper (ReceiptImportCard) vangt dit dus altijd af.
export async function applyExactStoreAliasMatches(
  receiptId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "apply_exact_store_alias_matches_v1",
    {
      p_receipt_id: receiptId,
    },
  );
  if (error) throw error;
  return (data as number) ?? 0;
}
