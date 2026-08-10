import { supabase } from "@/lib/supabase";
import type { ReceiptData } from "./parseReceiptFile";

export type ShoppingReceiptSummary = {
  id: string;
  store: string;
  purchase_date: string;
  total: number | null;
  currency: string;
  created_at: string;
  item_count: number;
};

// Blijft op de legacy kolommen (store/total) werken — die worden door
// saveReceipt() hieronder nog altijd gevuld, dus deze query hoeft niet
// aangepast te worden voor de importgeschiedenis-dialoog.
export async function fetchReceiptHistory(): Promise<ShoppingReceiptSummary[]> {
  const { data, error } = await supabase
    .from("shopping_receipts")
    .select(
      "id, store, purchase_date, total, currency, created_at, shopping_receipt_items(count)",
    )
    .order("purchase_date", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    store: r.store,
    purchase_date: r.purchase_date,
    total: r.total,
    currency: r.currency,
    created_at: r.created_at,
    item_count:
      (r.shopping_receipt_items as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

// Importgeschiedenis-detail v1 — bewust GEEN gebruik van receipt_item_prices
// (die view filtert op line_type = 'product' AND matching_status IN
// ('matched_auto','matched_confirmed'), dus laat unmatched/discount/deposit-
// regels en gekoppelde regels zonder geldige comparison_paid_price weg).
// Deze detailweergave moet juist ALLE oorspronkelijke bonregels tonen, dus
// leest rechtstreeks van shopping_receipts/shopping_receipt_items, met
// product/variant-namen als PostgREST-embeds erbij (nullable FK's ->
// automatisch null als er nog geen koppeling is). Eén genest select-request
// voor de hele bon + regels + namen — geen aparte query per regel.
export type ReceiptDetailItemVariant = {
  variant_name: string;
  package_size: number | null;
  package_unit: string | null;
  store_name: string | null;
};

export type ReceiptDetailItem = {
  id: string;
  raw_name: string;
  raw_brand: string | null;
  line_type: string;
  quantity: number | null;
  weight: number | null;
  weight_unit: string | null;
  paid_line_total: number | null;
  product_id: string | null;
  product_variant_id: string | null;
  matching_status: string;
  product_name: string | null;
  variant: ReceiptDetailItemVariant | null;
};

export type ReceiptDetail = {
  id: string;
  store_name: string | null;
  branch_name: string | null;
  purchase_date: string;
  purchase_time: string | null;
  total_paid: number | null;
  currency: string;
  items: ReceiptDetailItem[];
};

type RawReceiptDetailRow = {
  id: string;
  purchase_date: string;
  purchase_time: string | null;
  total_paid: number | null;
  currency: string;
  stores: { canonical_name: string } | null;
  store_branches: { branch_name: string | null } | null;
  shopping_receipt_items: {
    id: string;
    raw_name: string;
    raw_brand: string | null;
    line_type: string;
    quantity: number | null;
    weight: number | null;
    weight_unit: string | null;
    paid_line_total: number | null;
    product_id: string | null;
    product_variant_id: string | null;
    matching_status: string;
    products: { canonical_name: string } | null;
    product_variants: {
      variant_name: string;
      package_size: number | null;
      package_unit: string | null;
      stores: { canonical_name: string } | null;
    } | null;
  }[];
};

// Geen expliciete ORDER BY op de geneste regels: het bestaande schema heeft
// geen line_number/sort_order-kolom (alleen created_at, dat voor alle regels
// van dezelfde bon identiek is — save_receipt_v1 is één transactie, en
// now() is binnen één transactie constant — dus dat zou geen betrouwbare
// sortering opleveren, en id is een willekeurige uuid). We laten de
// natuurlijke, door PostgREST/Postgres teruggegeven volgorde staan, wat in
// de praktijk voor een net-geïmporteerde, ongewijzigde tabel doorgaans de
// oorspronkelijke insert-/bonvolgorde benadert — maar dit is geen harde
// garantie. Zie opleverrapport.
export async function fetchReceiptDetail(
  receiptId: string,
): Promise<ReceiptDetail> {
  const { data, error } = await supabase
    .from("shopping_receipts")
    .select(
      "id, purchase_date, purchase_time, total_paid, currency, stores(canonical_name), store_branches(branch_name), shopping_receipt_items(id, raw_name, raw_brand, line_type, quantity, weight, weight_unit, paid_line_total, product_id, product_variant_id, matching_status, products(canonical_name), product_variants(variant_name, package_size, package_unit, stores(canonical_name)))",
    )
    .eq("id", receiptId)
    .single();
  if (error) throw error;
  const row = data as unknown as RawReceiptDetailRow;
  return {
    id: row.id,
    store_name: row.stores?.canonical_name ?? null,
    branch_name: row.store_branches?.branch_name ?? null,
    purchase_date: row.purchase_date,
    purchase_time: row.purchase_time,
    total_paid: row.total_paid,
    currency: row.currency,
    items: (row.shopping_receipt_items ?? []).map((item) => ({
      id: item.id,
      raw_name: item.raw_name,
      raw_brand: item.raw_brand,
      line_type: item.line_type,
      quantity: item.quantity,
      weight: item.weight,
      weight_unit: item.weight_unit,
      paid_line_total: item.paid_line_total,
      product_id: item.product_id,
      product_variant_id: item.product_variant_id,
      matching_status: item.matching_status,
      product_name: item.products?.canonical_name ?? null,
      variant: item.product_variants
        ? {
            variant_name: item.product_variants.variant_name,
            package_size: item.product_variants.package_size,
            package_unit: item.product_variants.package_unit,
            store_name: item.product_variants.stores?.canonical_name ?? null,
          }
        : null,
    })),
  };
}

export type ReceiptDuplicateMatch = {
  id: string;
  raw_store_name: string | null;
  purchase_date: string;
  total_paid: number | null;
};

// Geen harde blokkade, geen unique constraint op fingerprint — puur een
// signaal dat de UI vóór het importeren aan de gebruiker kan tonen.
export async function findReceiptDuplicate(
  fingerprint: string,
): Promise<ReceiptDuplicateMatch | null> {
  const { data, error } = await supabase
    .from("shopping_receipts")
    .select("id, raw_store_name, purchase_date, total_paid")
    .eq("fingerprint", fingerprint)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// Atomische opslag via de save_receipt_v1-RPC (bon + regels + btw-regels in
// één transactie, zie 20260828000000_save_receipt_v1_rpc.sql) i.p.v. losse
// inserts + compenserende delete — met nu drie tabellen zou dat patroon
// alleen maar complexer en foutgevoeliger worden.
//
// Matching gebeurt hier expliciet NIET: elke regel gaat de database in met
// product_id/product_variant_id = null en matching_status = 'unmatched'
// (afgedwongen in de RPC zelf, niet hier) — hints zijn alleen best-effort
// interpretatie en worden nooit als productcatalogus-waarheid behandeld.
export async function saveReceipt(
  userId: string | null,
  data: ReceiptData,
  fingerprint: string,
  sourceJson: unknown,
): Promise<string> {
  const items = data.items.map((item) => ({
    line_type: item.line_type,
    raw_name: item.raw.name,
    raw_brand: item.raw.brand,
    quantity: item.raw.quantity,
    weight: item.raw.weight,
    weight_unit: item.raw.weight_unit,
    regular_unit_price: item.raw.regular_unit_price,
    regular_line_total: item.raw.regular_line_total,
    discount_amount: item.raw.discount_amount,
    paid_line_total: item.raw.paid_line_total,
    promotion_type: item.raw.promotion_type,
    promotion_text: item.raw.promotion_text,
    package_size_hint: item.hints.package_size,
    package_unit_hint: item.hints.package_unit,
    // Legacy `category`-kolom mag tijdelijk de hint bevatten (puur
    // backwards-compatible weergave) — dit is GEEN nieuwe categoriebron.
    hint_category: item.hints.category,
  }));

  const { data: receiptId, error } = await supabase.rpc("save_receipt_v1", {
    p_user_id: userId,
    p_store_name: data.store_name,
    p_branch_name: data.branch_name,
    p_store_number: data.store_number,
    p_purchase_date: data.purchase_date,
    p_purchase_time: data.purchase_time,
    p_currency: data.currency,
    p_subtotal: data.subtotal,
    p_discount_total: data.discount_total,
    p_deposit_total: data.deposit_total,
    p_total_paid: data.total_paid,
    p_fingerprint: fingerprint,
    p_source_json: sourceJson,
    p_items: items,
    p_tax_lines: data.tax_lines,
  });
  if (error) throw error;
  return receiptId as string;
}
