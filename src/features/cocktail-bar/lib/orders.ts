import { supabase } from "@/lib/supabase";
import type {
  CocktailOrder,
  CocktailOrderStatus,
} from "@/features/cocktail-bar/types";

const ORDER_COLUMNS =
  "id, cocktail_id, variant_id, guest_name, note, status, ready_at, created_by, created_at, updated_at";

// Insert-only vanuit de Tabletmodus (cocktail_guest mag hier alleen
// INSERT'en, geen SELECT — zie de RLS-policies in
// 20260819020000_cocktail_bar_orders.sql). status/ready_at komen nooit van
// de client: status defaultet naar 'ordered' in de database, ready_at wordt
// alleen door een trigger gezet bij een statusovergang naar 'ready'.
export async function insertOrder(input: {
  cocktailId: string;
  variantId: string;
  guestName: string;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase.from("cocktail_orders").insert({
    cocktail_id: input.cocktailId,
    variant_id: input.variantId,
    guest_name: input.guestName.trim(),
    note: input.note?.trim() || null,
  });
  if (error) throw error;
}

// Owner-only wachtrij voor Bereiden (fase 6) — RLS beperkt SELECT op
// cocktail_orders al tot owner, dus geen extra filter nodig hier. Geen join
// met cocktails/cocktail_variants: de Bereiden-pagina heeft via
// useCocktailShowcase() al de volledige cocktaildata in het geheugen en
// matcht die zelf op cocktail_id/variant_id — een tweede, deels dubbele
// query zou hier alleen dezelfde naam/foto/varianttype nog eens ophalen.
export async function fetchOrderQueue(): Promise<CocktailOrder[]> {
  const { data, error } = await supabase
    .from("cocktail_orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CocktailOrder[];
}

export async function updateOrderStatus(
  orderId: string,
  status: CocktailOrderStatus,
): Promise<void> {
  const { error } = await supabase
    .from("cocktail_orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw error;
}

// "Verlengen" vanaf de Bereiden-wachtrij: een expliciete update van alleen
// ready_at terwijl status al 'ready' is triggert geen van beide takken in
// cocktail_orders_set_ready_at() (zie 20260819020000_cocktail_bar_orders.sql),
// dus dit overschrijft nooit een gelijktijdige statusovergang elders.
export async function extendReadyWindow(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("cocktail_orders")
    .update({ ready_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "ready");
  if (error) throw error;
}

// Laat het Big Screen (fase 8) dit specifieke klaar-scherm vroegtijdig
// negeren zonder de orderstatus zelf te wijzigen — geschreven op de
// singleton cocktail_bar_state-rij (zie 20260819030000_cocktail_bar_highlights_and_state.sql).
export async function dismissReadyOnBigScreen(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("cocktail_bar_state")
    .update({ dismissed_ready_order_id: orderId })
    .eq("id", true);
  if (error) throw error;
}

export type { CocktailOrder };
