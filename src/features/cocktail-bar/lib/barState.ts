import { supabase } from "@/lib/supabase";
import type { CocktailBarState } from "@/features/cocktail-bar/types";

const BAR_STATE_COLUMNS =
  "id, active_highlight_id, active_highlight_started_at, dismissed_ready_order_id, ready_display_seconds, updated_at";

// Singleton-rij (id is altijd `true`, zie 20260819030000_cocktail_bar_highlights_and_state.sql).
export async function fetchBarState(): Promise<CocktailBarState> {
  const { data, error } = await supabase
    .from("cocktail_bar_state")
    .select(BAR_STATE_COLUMNS)
    .eq("id", true)
    .single();
  if (error) throw error;
  return data as CocktailBarState;
}

export async function pushHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase
    .from("cocktail_bar_state")
    .update({
      active_highlight_id: highlightId,
      active_highlight_started_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) throw error;
}

export async function clearHighlight(): Promise<void> {
  const { error } = await supabase
    .from("cocktail_bar_state")
    .update({ active_highlight_id: null, active_highlight_started_at: null })
    .eq("id", true);
  if (error) throw error;
}
