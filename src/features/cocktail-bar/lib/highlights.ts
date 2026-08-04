import { supabase } from "@/lib/supabase";
import type { CocktailHighlight } from "@/features/cocktail-bar/types";

const HIGHLIGHT_COLUMNS =
  "id, guest_name, cocktail_id, order_id, title, subtitle, story, display_order, is_active, created_by, created_at, updated_at";

export async function fetchHighlights(): Promise<CocktailHighlight[]> {
  const { data, error } = await supabase
    .from("cocktail_highlights")
    .select(HIGHLIGHT_COLUMNS)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CocktailHighlight[];
}

export type HighlightInput = {
  guestName: string;
  cocktailId: string | null;
  orderId: string | null;
  title: string;
  subtitle: string | null;
  story: string;
  displayOrder: number;
};

function toRow(input: HighlightInput) {
  return {
    guest_name: input.guestName.trim(),
    cocktail_id: input.cocktailId,
    order_id: input.orderId,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    story: input.story.trim(),
    display_order: input.displayOrder,
  };
}

export async function createHighlight(
  input: HighlightInput,
): Promise<CocktailHighlight> {
  const { data, error } = await supabase
    .from("cocktail_highlights")
    .insert(toRow(input))
    .select(HIGHLIGHT_COLUMNS)
    .single();
  if (error) throw error;
  return data as CocktailHighlight;
}

export async function updateHighlight(
  id: string,
  input: HighlightInput,
): Promise<void> {
  const { error } = await supabase
    .from("cocktail_highlights")
    .update(toRow(input))
    .eq("id", id);
  if (error) throw error;
}

export async function setHighlightActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("cocktail_highlights")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}

// order_id -> on delete set null (zie 20260819030000_cocktail_bar_highlights_and_state.sql):
// het verwijderen van een bestelling neemt een gekoppelde presentatie dus
// nooit mee. Hier gaat het om het omgekeerde — de presentatie zelf
// verwijderen — wat geen FK-restricties raakt.
export async function deleteHighlight(id: string): Promise<void> {
  const { error } = await supabase
    .from("cocktail_highlights")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
