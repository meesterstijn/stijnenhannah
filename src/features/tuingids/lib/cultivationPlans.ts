import {
  supabase,
  type CultivationPlan,
  type CultivationPlanItem,
  type CultivationPlanWithItems,
  type Plant,
} from "@/lib/supabase";

// ─── Fetchers ─────────────────────────────────────────────────────────────────

export async function fetchCultivationPlans(): Promise<CultivationPlan[]> {
  const { data, error } = await supabase
    .from("cultivation_plans")
    .select("*")
    .order("plan_year", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCultivationPlanWithItems(
  planId: string,
): Promise<CultivationPlanWithItems | null> {
  const { data: plan, error: planError } = await supabase
    .from("cultivation_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) return null;

  const { data: items, error: itemsError } = await supabase
    .from("cultivation_plan_items")
    .select("*")
    .eq("cultivation_plan_id", planId)
    .order("created_at", { ascending: true });
  if (itemsError) throw itemsError;

  return { ...plan, items: items ?? [] };
}

export async function fetchCultivationPlanItems(
  planId: string,
): Promise<CultivationPlanItem[]> {
  const { data, error } = await supabase
    .from("cultivation_plan_items")
    .select("*")
    .eq("cultivation_plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Total plants to grow for one item: main plants + backup plants.
 * Potting soil is still calculated from planned_quantity only — backup
 * plants are usually started in seed trays or soil blocks.
 */
export function getTotalToGrow(item: CultivationPlanItem): number {
  return item.planned_quantity + (item.backup_quantity ?? 0);
}

/** Effective liters per plant: override → recommended → min → null */
export function litersPerPlant(
  item: CultivationPlanItem,
  species: Plant,
): number | null {
  return (
    item.pot_liters_override ??
    species.pot_recommended_liters ??
    species.pot_min_liters ??
    null
  );
}

/** Total estimated soil volume for one item. null when pot size is unknown. */
export function totalLitersForItem(
  item: CultivationPlanItem,
  species: Plant,
): number | null {
  const liters = litersPerPlant(item, species);
  if (liters === null) return null;
  return item.planned_quantity * liters;
}

/** Sum of all item totals for a plan. Items without pot info are excluded. */
export function totalLitersForPlan(
  items: CultivationPlanItem[],
  speciesById: Map<string, Plant>,
): number {
  let total = 0;
  for (const item of items) {
    const species = speciesById.get(item.species_id);
    if (!species) continue;
    const t = totalLitersForItem(item, species);
    if (t !== null) total += t;
  }
  return Math.round(total);
}

/** Percentage of planned items that have been planted. */
export function planProgress(items: CultivationPlanItem[]): number {
  const planned = items.reduce((s, i) => s + i.planned_quantity, 0);
  if (planned === 0) return 0;
  const planted = items.reduce((s, i) => s + i.planted_quantity, 0);
  return Math.round((planted / planned) * 100);
}

/** Human-readable Dutch label for a plan status. */
export const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "Concept",
  active: "Actief",
  completed: "Afgerond",
  archived: "Gearchiveerd",
};

/** Default plan name for a given year. */
export function defaultPlanName(year: number): string {
  return `Teeltplan ${year}`;
}

/**
 * Suggest a default year for a new plan.
 * Heuristic: if we're in October or later, suggest next year; otherwise
 * suggest the current year. Simple and predictable — user can always change it.
 */
export function suggestPlanYear(): number {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}
