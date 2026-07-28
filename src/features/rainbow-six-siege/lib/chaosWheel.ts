import { supabase } from "@/lib/supabase";
import type { R6ChaosEffect, R6SessionChaosEffect } from "@/features/rainbow-six-siege/types";

const CHAOS_EFFECT_COLUMNS = "id, name, description, duration_type, default_duration, category, is_active, sort_order";
const SESSION_CHAOS_EFFECT_COLUMNS =
  "id, session_id, match_id, chaos_effect_id, custom_text, start_match_number, end_match_number, status, created_at";

export async function fetchR6ChaosEffects(): Promise<R6ChaosEffect[]> {
  const { data, error } = await supabase.from("r6_chaos_effects").select(CHAOS_EFFECT_COLUMNS).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as R6ChaosEffect[];
}

export async function createR6ChaosEffect(input: {
  name: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
}): Promise<R6ChaosEffect> {
  const { data, error } = await supabase
    .from("r6_chaos_effects")
    .insert({
      name: input.name,
      description: input.description,
      category: input.category,
      duration_type: "single_match",
      sort_order: input.sortOrder,
    })
    .select(CHAOS_EFFECT_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`Er bestaat al een chaosregel met deze naam ("${input.name}").`);
    throw error;
  }
  return data as R6ChaosEffect;
}

export async function updateR6ChaosEffect(
  id: string,
  patch: Partial<Pick<R6ChaosEffect, "name" | "description" | "category" | "is_active" | "sort_order">>,
): Promise<void> {
  const { error } = await supabase.from("r6_chaos_effects").update(patch).eq("id", id);
  if (error) throw error;
}

/** Verwijdert een chaosregel. Als hij al ooit geaccepteerd is voor een game
 * (r6_session_chaos_effects.chaos_effect_id verwijst ernaar) blokkeert de
 * foreign key dit — zelfde beschermingspatroon als bij actietegels
 * verwijderen: zet 'm dan op inactief in plaats van te verwijderen. */
export async function deleteR6ChaosEffect(id: string): Promise<void> {
  const { error } = await supabase.from("r6_chaos_effects").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Deze chaosregel is al gebruikt in een LAN en kan niet verwijderd worden. Zet 'm op inactief in plaats daarvan.");
    }
    throw error;
  }
}

export async function fetchR6SessionChaosEffects(sessionId: string): Promise<R6SessionChaosEffect[]> {
  const { data, error } = await supabase
    .from("r6_session_chaos_effects")
    .select(SESSION_CHAOS_EFFECT_COLUMNS)
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []) as R6SessionChaosEffect[];
}

/**
 * Legt de geaccepteerde chaosregel voor precies deze game vast. Een
 * eventuele eerder geaccepteerde regel voor dezelfde game wordt eerst
 * verwijderd — een game heeft hoogstens één actieve chaosregel, geen
 * geschiedenis van "overwogen maar niet gekozen" opties.
 */
export async function acceptR6ChaosEffectForMatch(input: {
  sessionId: string;
  matchId: string;
  chaosEffectId: string;
}): Promise<void> {
  const { error: deleteError } = await supabase.from("r6_session_chaos_effects").delete().eq("match_id", input.matchId);
  if (deleteError) throw deleteError;

  const { error } = await supabase.from("r6_session_chaos_effects").insert({
    session_id: input.sessionId,
    match_id: input.matchId,
    chaos_effect_id: input.chaosEffectId,
    status: "active",
  });
  if (error) throw error;
}
