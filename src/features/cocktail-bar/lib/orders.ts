import { supabase } from "@/lib/supabase";
import type { CocktailOrder } from "@/features/cocktail-bar/types";

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

// Statusupdates/lezen voor de bartender-wachtrij komen in fase 6 — deze
// functie is voor nu (fase 5) alleen wat de Tabletmodus nodig heeft.
export type { CocktailOrder };
