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
