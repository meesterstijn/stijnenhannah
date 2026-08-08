// Winkelketens (public.stores) — bewust minimale laag, geen aparte
// store_aliases-tabel (zie 20260827000000_receipt_price_analysis_foundation.sql):
// het aantal ketens is klein, spellingvarianten worden hier opgevangen met
// eenvoudige case-insensitieve matching, niet met matching-infrastructuur.
// Geen enkele functie hier maakt ooit STIL een winkel aan — aanmaken gebeurt
// alleen via de expliciete createStore()-actie vanuit de UI.
import { supabase } from "@/lib/supabase";

export type Store = { id: string; canonical_name: string };

export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("id, canonical_name")
    .order("canonical_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createStore(canonicalName: string): Promise<Store> {
  const { data, error } = await supabase
    .from("stores")
    .insert({ canonical_name: canonicalName.trim() })
    .select("id, canonical_name")
    .single();
  if (error) throw error;
  return data;
}

export async function linkReceiptToStore(
  receiptId: string,
  storeId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shopping_receipts")
    .update({ store_id: storeId })
    .eq("id", receiptId);
  if (error) throw error;
}

// Probeert store_id van een bon vast te stellen op basis van een
// case-insensitieve, getrimde match tussen raw_store_name en een bestaande
// stores.canonical_name. Maakt NOOIT automatisch een nieuwe winkel aan — bij
// geen (of geen eenduidige) match blijft store_id null, en moet de gebruiker
// de winkel expliciet koppelen/aanmaken (zie createStore/linkReceiptToStore).
// Geeft de (mogelijk al bestaande) store_id terug, of null.
export async function resolveReceiptStore(
  receiptId: string,
): Promise<string | null> {
  const { data: receipt, error: receiptError } = await supabase
    .from("shopping_receipts")
    .select("store_id, raw_store_name")
    .eq("id", receiptId)
    .single();
  if (receiptError) throw receiptError;
  if (receipt.store_id) return receipt.store_id;
  if (!receipt.raw_store_name) return null;

  const normalized = receipt.raw_store_name.trim().toLowerCase();
  const stores = await fetchStores();
  const match = stores.filter(
    (s) => s.canonical_name.trim().toLowerCase() === normalized,
  );
  if (match.length !== 1) return null;

  await linkReceiptToStore(receiptId, match[0].id);
  return match[0].id;
}
