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

// Comparison unit van een bestaand canoniek product bewerken v1 — een
// gewone update op products, binnen de bestaande owner-only RLS-policy
// ("products: owner only", for all to authenticated using/with check
// is_owner(), zie 20260827000000). Geen RPC nodig: dit is een simpele,
// enkelvoudige kolomwijziging op één rij, geen meerdere tabellen/geen
// afhankelijke schrijfacties die atomair samen moeten slagen — precies het
// soort wijziging waarvoor de bestaande RLS al voldoende is.
export async function updateProductComparisonUnit(
  productId: string,
  comparisonUnit: ComparisonUnit,
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ comparison_unit: comparisonUnit })
    .eq("id", productId);
  if (error) throw error;
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

// Bestaande varianten van één product — gebruikt door de bewerkflow om
// "bestaande variant kiezen" aan te bieden i.p.v. altijd een nieuwe variant
// te moeten aanmaken (zie EditReceiptItemMatchDialog).
export async function fetchProductVariants(
  productId: string,
): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, product_id, brand, variant_name, store_id, package_size, package_unit",
    )
    .eq("product_id", productId)
    .order("variant_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
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

// Retroactieve matching — beide functies herleiden store/tekst/koppeling
// server-side uit het net bevestigde receipt_item_id, nooit uit een lijst
// regel-id's die de client zou moeten meesturen (zie migratiebestand voor de
// volledige redenering). find(...) telt alleen; apply(...) past pas iets toe
// na expliciete "Ook koppelen"-bevestiging door de gebruiker.
export async function findHistoricalAliasMatchCount(
  receiptItemId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "find_historical_alias_match_count_v1",
    {
      p_receipt_item_id: receiptItemId,
    },
  );
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function applyHistoricalAliasMatches(
  receiptItemId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "apply_historical_alias_matches_v1",
    {
      p_receipt_item_id: receiptItemId,
    },
  );
  if (error) throw error;
  return (data as number) ?? 0;
}

// --- Bestaande productkoppeling bewerken v1 ---------------------------
//
// receipt_item_prices (de view achter Productdetail) bevat bewust geen
// raw_*-velden (dat is een prijsanalyse-view, geen edit-databron) — de
// bewerkflow haalt de nodige read-only boncontext daarom hier apart en
// alleen op het moment dat de gebruiker "Bewerken" klikt (1 gerichte query
// per open, geen achtergrond-N+1 over een lijst).
export type ReceiptItemEditContext = {
  id: string;
  raw_name: string;
  raw_brand: string | null;
  quantity: number | null;
  weight: number | null;
  weight_unit: string | null;
  paid_line_total: number | null;
  product_id: string | null;
  product_variant_id: string | null;
  matching_status: string;
  store_id: string | null;
  store_name: string | null;
  purchase_date: string;
  currency: string;
};

type RawReceiptItemEditRow = {
  id: string;
  raw_name: string;
  raw_brand: string | null;
  quantity: number | null;
  weight: number | null;
  weight_unit: string | null;
  paid_line_total: number | null;
  product_id: string | null;
  product_variant_id: string | null;
  matching_status: string;
  shopping_receipts: {
    store_id: string | null;
    purchase_date: string;
    currency: string;
    stores: { canonical_name: string } | null;
  } | null;
};

export async function fetchReceiptItemEditContext(
  receiptItemId: string,
): Promise<ReceiptItemEditContext> {
  const { data, error } = await supabase
    .from("shopping_receipt_items")
    .select(
      "id, raw_name, raw_brand, quantity, weight, weight_unit, paid_line_total, product_id, product_variant_id, matching_status, shopping_receipts(store_id, purchase_date, currency, stores(canonical_name))",
    )
    .eq("id", receiptItemId)
    .single();
  if (error) throw error;
  const row = data as unknown as RawReceiptItemEditRow;
  return {
    id: row.id,
    raw_name: row.raw_name,
    raw_brand: row.raw_brand,
    quantity: row.quantity,
    weight: row.weight,
    weight_unit: row.weight_unit,
    paid_line_total: row.paid_line_total,
    product_id: row.product_id,
    product_variant_id: row.product_variant_id,
    matching_status: row.matching_status,
    store_id: row.shopping_receipts?.store_id ?? null,
    store_name: row.shopping_receipts?.stores?.canonical_name ?? null,
    purchase_date: row.shopping_receipts?.purchase_date ?? "",
    currency: row.shopping_receipts?.currency ?? "EUR",
  };
}

// Puur lezend — bepaalt of er voor deze regel (raw_name + store) al een
// winkel-specifieke alias bestaat, zodat de UI de alias-keuzestap alleen
// toont als die daadwerkelijk relevant is. Zelfde tweetraps-patroon als
// findHistoricalAliasMatchCount hierboven.
export async function findExistingAliasForReceiptItem(
  receiptItemId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "find_existing_alias_for_receipt_item_v1",
    { p_receipt_item_id: receiptItemId },
  );
  if (error) throw error;
  return (data as boolean) ?? false;
}

// Atomisch: werkt de kassabonregel altijd bij (koppeling + matching-
// metadata), en de bestaande alias alleen als updateAlias = true — maakt
// zelf nooit een nieuwe alias aan. Zie migratie
// 20260902000000_edit_receipt_item_match_v1_rpc.sql voor de volledige
// redenering waarom dit een eigen RPC is i.p.v. confirmReceiptItemMatch.
export async function editReceiptItemMatch(input: {
  receiptItemId: string;
  productId: string;
  productVariantId: string | null;
  updateAlias: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("edit_receipt_item_match_v1", {
    p_receipt_item_id: input.receiptItemId,
    p_product_id: input.productId,
    p_product_variant_id: input.productVariantId,
    p_update_alias: input.updateAlias,
  });
  if (error) throw error;
}

// --- Aliasbeheer v2 (automatische herkenning) -------------------------
//
// ALIAS (product_aliases) is de automatische herkenningsregel voor
// TOEKOMSTIGE kassabonnen. RECEIPT ITEM MATCH (shopping_receipt_items.
// product_id/product_variant_id) is wat een specifieke, al opgeslagen
// aankoop daadwerkelijk was. Deze twee mogen bewust van elkaar afwijken
// (zie EditReceiptItemMatchDialog's "alleen deze aankoop"-keuze) — geen van
// de functies hieronder raakt ooit shopping_receipt_items.
//
// Schema (geverifieerd tegen 20260827000000_receipt_price_analysis_
// foundation.sql, niet aangenomen):
//   product_aliases(id, raw_alias not null, normalized_alias not null,
//     product_id not null references products(id) on delete restrict,
//     product_variant_id references product_variants(id) on delete set
//     null, store_id references stores(id) on delete set null,
//     source, usage_count, last_used_at, created_at)
// Unieke sleutel: (normalized_alias, store_id) als store_id NOT NULL
// (partial unique index product_aliases_store_scoped_key), en
// (normalized_alias) alleen als store_id IS NULL (partial unique index
// product_aliases_global_key) — het schema ONDERSTEUNT dus expliciet
// winkel-loze/globale aliases, al ontstaan die in de praktijk nooit via de
// huidige matchingflows (confirm_receipt_item_match_v1 vereist altijd een
// bekende store_id). raw_alias bestaat wél apart van normalized_alias, dus
// de leesbare oorspronkelijke bontekst is gewoon beschikbaar — geen
// noodgreep op normalized_alias nodig.
//
// RLS: "product_aliases: owner only" (for all to authenticated using/with
// check is_owner()) dekt UPDATE/DELETE al — geen RPC nodig voor een
// enkelvoudige update van twee kolommen op één rij. De bestaande trigger
// trg_product_aliases_variant_matches_product (before insert OR UPDATE)
// bewaakt op databaseniveau dat product_variant_id altijd bij product_id
// hoort, ook bij deze updates — een extra migratie voor die integriteit is
// dus niet nodig, wel een client-side voorcheck voor een nette UI-fout
// i.p.v. een rauwe Postgres-exception.
export type ProductAlias = {
  id: string;
  raw_alias: string;
  normalized_alias: string;
  product_id: string;
  product_variant_id: string | null;
  store_id: string | null;
  usage_count: number;
  last_used_at: string | null;
  product_name: string;
  variant_name: string | null;
  store_name: string | null;
};

type RawProductAliasRow = {
  id: string;
  raw_alias: string;
  normalized_alias: string;
  product_id: string;
  product_variant_id: string | null;
  store_id: string | null;
  usage_count: number;
  last_used_at: string | null;
  products: { canonical_name: string } | null;
  product_variants: { variant_name: string } | null;
  stores: { canonical_name: string } | null;
};

// Eén request met embeds voor product/variant/winkelnaam — geen aparte
// query per alias.
export async function fetchProductAliases(): Promise<ProductAlias[]> {
  const { data, error } = await supabase
    .from("product_aliases")
    .select(
      "id, raw_alias, normalized_alias, product_id, product_variant_id, store_id, usage_count, last_used_at, products(canonical_name), product_variants(variant_name), stores(canonical_name)",
    );
  if (error) throw error;
  return ((data ?? []) as unknown as RawProductAliasRow[]).map((row) => ({
    id: row.id,
    raw_alias: row.raw_alias,
    normalized_alias: row.normalized_alias,
    product_id: row.product_id,
    product_variant_id: row.product_variant_id,
    store_id: row.store_id,
    usage_count: row.usage_count,
    last_used_at: row.last_used_at,
    product_name: row.products?.canonical_name ?? "Onbekend product",
    variant_name: row.product_variants?.variant_name ?? null,
    store_name: row.stores?.canonical_name ?? null,
  }));
}

// Deterministisch: winkelnaam, dan aliastekst, dan id als laatste,
// stabiele fallback.
export function sortProductAliases(aliases: ProductAlias[]): ProductAlias[] {
  return [...aliases].sort((a, b) => {
    const storeA = a.store_name ?? "Onbekende winkel";
    const storeB = b.store_name ?? "Onbekende winkel";
    const storeCompare = storeA.localeCompare(storeB, "nl");
    if (storeCompare !== 0) return storeCompare;
    const aliasCompare = a.raw_alias.localeCompare(b.raw_alias, "nl");
    if (aliasCompare !== 0) return aliasCompare;
    return a.id.localeCompare(b.id);
  });
}

// Wijzigt uitsluitend product_id/product_variant_id — normalized_alias en
// store_id komen hier bewust niet in de update-payload voor, dus kunnen ook
// nooit per ongeluk wijzigen (en dus nooit de unieke (normalized_alias,
// store_id)-sleutel raken). usage_count/last_used_at blijven ongewijzigd
// (niet in de payload = niet aangeraakt).
export async function updateProductAliasTarget(input: {
  aliasId: string;
  productId: string;
  productVariantId: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("product_aliases")
    .update({
      product_id: input.productId,
      product_variant_id: input.productVariantId,
    })
    .eq("id", input.aliasId);
  if (error) throw error;
}

// Verwijdert alleen de aliasrij zelf — geen enkele shopping_receipt_items-
// rij wordt aangeraakt (er is geen FK vanuit shopping_receipt_items naar
// product_aliases). Toekomstige identieke kassabontekst matcht simpelweg
// niet meer automatisch via apply_exact_store_alias_matches_v1, die
// product_aliases live leest en dus zonder wijziging al correct reageert
// op zowel een gewijzigde target als een verwijderde alias.
export async function deleteProductAlias(aliasId: string): Promise<void> {
  const { error } = await supabase
    .from("product_aliases")
    .delete()
    .eq("id", aliasId);
  if (error) throw error;
}
