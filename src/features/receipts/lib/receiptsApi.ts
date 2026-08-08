import { supabase } from "@/lib/supabase";
import type { ReceiptInput } from "./parseReceiptFile";

export type ShoppingReceiptSummary = {
  id: string;
  store: string;
  purchase_date: string;
  total: number | null;
  currency: string;
  created_at: string;
  item_count: number;
};

export async function fetchReceiptHistory(): Promise<ShoppingReceiptSummary[]> {
  const { data, error } = await supabase
    .from("shopping_receipts")
    .select("id, store, purchase_date, total, currency, created_at, shopping_receipt_items(count)")
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
    item_count: (r.shopping_receipt_items as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

// Twee statements (bon, dan regels) i.p.v. één RPC — voor v1 bewust simpel
// gehouden. Om een half geïmporteerde bon te voorkomen wanneer de tweede
// insert faalt, wordt de zojuist aangemaakte bon-rij dan weer opgeruimd
// (compenserende delete) i.p.v. 'm zonder regels te laten staan.
export async function saveReceipt(
  userId: string | null,
  data: ReceiptInput,
  sourceJson: unknown,
): Promise<void> {
  const { data: receipt, error: receiptError } = await supabase
    .from("shopping_receipts")
    .insert({
      user_id: userId,
      store: data.store,
      purchase_date: data.purchase_date,
      currency: data.currency,
      total: data.total,
      source_json: sourceJson,
    })
    .select("id")
    .single();
  if (receiptError) throw receiptError;

  const itemRows = data.items.map((item) => ({
    receipt_id: receipt.id,
    name: item.name,
    brand: item.brand,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    line_total: item.line_total,
    category: item.category,
    discount: item.discount,
  }));

  const { error: itemsError } = await supabase
    .from("shopping_receipt_items")
    .insert(itemRows);
  if (itemsError) {
    await supabase.from("shopping_receipts").delete().eq("id", receipt.id);
    throw itemsError;
  }
}
