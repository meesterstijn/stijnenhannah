import { supabase } from "@/lib/supabase";
import { fetchAllCocktails } from "@/features/cocktail-bar/lib/cocktails";
import { fetchHighlights } from "@/features/cocktail-bar/lib/highlights";
import { fetchCocktailSpirits } from "@/features/cocktail-bar/lib/reference";
import type {
  CocktailFlavourProfile,
  CocktailOrderStatus,
} from "@/features/cocktail-bar/types";

export type DashboardPeriod = "today" | "7d" | "30d" | "all";

export const ORDER_STATUS_LABELS: Record<CocktailOrderStatus, string> = {
  ordered: "Besteld",
  in_progress: "Bezig",
  ready: "Klaar",
  served: "Geserveerd",
};

export type DashboardOrderSummary = {
  id: string;
  guestName: string;
  cocktailName: string;
  status: CocktailOrderStatus;
  createdAt: string;
};

export type DashboardStats = {
  totals: {
    cocktails: number;
    published: number;
    drafts: number;
    orders: number;
    openOrders: number;
    highlights: number;
    activeHighlights: number;
  };
  popularCocktail: { name: string; orderCount: number } | null;
  popularSpirit: { name: string; orderCount: number } | null;
  averageFlavourProfile: CocktailFlavourProfile | null;
  ordersByStatus: { status: CocktailOrderStatus; count: number }[];
  recentOrders: DashboardOrderSummary[];
};

function periodStartIso(period: DashboardPeriod): string | null {
  const now = new Date();
  if (period === "today")
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
  if (period === "7d")
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (period === "30d")
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

function topEntry(
  counts: Map<string, number>,
): { id: string; count: number } | null {
  let best: { id: string; count: number } | null = null;
  for (const [id, count] of counts) {
    if (!best || count > best.count) best = { id, count };
  }
  return best;
}

type OrderRow = {
  id: string;
  guest_name: string;
  cocktail_id: string;
  variant_id: string;
  status: CocktailOrderStatus;
  created_at: string;
};

type VariantRow = { id: string; spirit_id: string | null };

type FlavourRow = {
  variant_id: string;
  sweet_score: number;
  sour_score: number;
  bitter_score: number;
  fresh_score: number;
  strong_score: number;
};

/**
 * Enige plek die dashboardstatistieken berekent (plan §8/§11) — alles komt
 * hier client-side uit cocktails/cocktail_variants/cocktail_flavour_profiles/
 * cocktail_orders/cocktail_highlights, nooit apart opgeslagen. Alleen
 * cocktail_orders wordt op `period` gefilterd; de rest is referentiedata die
 * nodig is om namen/scores van precies díe bestellingen op te lossen.
 */
export async function fetchDashboardStats(
  period: DashboardPeriod,
): Promise<DashboardStats> {
  const since = periodStartIso(period);

  let ordersQuery = supabase
    .from("cocktail_orders")
    .select("id, guest_name, cocktail_id, variant_id, status, created_at");
  if (since) ordersQuery = ordersQuery.gte("created_at", since);

  const [
    ordersResult,
    cocktails,
    highlights,
    spirits,
    variantsResult,
    flavourResult,
  ] = await Promise.all([
    ordersQuery,
    fetchAllCocktails(),
    fetchHighlights(),
    fetchCocktailSpirits(),
    supabase.from("cocktail_variants").select("id, spirit_id"),
    supabase
      .from("cocktail_flavour_profiles")
      .select(
        "variant_id, sweet_score, sour_score, bitter_score, fresh_score, strong_score",
      ),
  ]);
  if (ordersResult.error) throw ordersResult.error;
  if (variantsResult.error) throw variantsResult.error;
  if (flavourResult.error) throw flavourResult.error;

  const orders = (ordersResult.data ?? []) as OrderRow[];
  const variantsById = new Map(
    ((variantsResult.data ?? []) as VariantRow[]).map((v) => [v.id, v]),
  );
  const flavourByVariantId = new Map(
    ((flavourResult.data ?? []) as FlavourRow[]).map((f) => [f.variant_id, f]),
  );
  const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));
  const spiritsById = new Map(spirits.map((s) => [s.id, s]));

  const cocktailOrderCounts = new Map<string, number>();
  const spiritOrderCounts = new Map<string, number>();
  const statusCounts = new Map<CocktailOrderStatus, number>();
  const flavourSums = { sweet: 0, sour: 0, bitter: 0, fresh: 0, strong: 0 };
  let flavourSampleCount = 0;

  for (const order of orders) {
    cocktailOrderCounts.set(
      order.cocktail_id,
      (cocktailOrderCounts.get(order.cocktail_id) ?? 0) + 1,
    );
    statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);

    const variant = variantsById.get(order.variant_id);
    if (variant?.spirit_id) {
      spiritOrderCounts.set(
        variant.spirit_id,
        (spiritOrderCounts.get(variant.spirit_id) ?? 0) + 1,
      );
    }

    const profile = flavourByVariantId.get(order.variant_id);
    if (profile) {
      flavourSums.sweet += profile.sweet_score;
      flavourSums.sour += profile.sour_score;
      flavourSums.bitter += profile.bitter_score;
      flavourSums.fresh += profile.fresh_score;
      flavourSums.strong += profile.strong_score;
      flavourSampleCount += 1;
    }
  }

  const topCocktail = topEntry(cocktailOrderCounts);
  const topSpirit = topEntry(spiritOrderCounts);

  // Vorm exact gelijk aan CocktailFlavourProfile zodat CocktailFlavourProfileChart
  // hier ongewijzigd hergebruikt kan worden — variant_id/updated_at zijn
  // placeholders, de chart leest alleen de score-velden.
  const averageFlavourProfile: CocktailFlavourProfile | null =
    flavourSampleCount === 0
      ? null
      : {
          variant_id: "average",
          updated_at: new Date().toISOString(),
          sweet_score:
            Math.round((flavourSums.sweet / flavourSampleCount) * 10) / 10,
          sour_score:
            Math.round((flavourSums.sour / flavourSampleCount) * 10) / 10,
          bitter_score:
            Math.round((flavourSums.bitter / flavourSampleCount) * 10) / 10,
          fresh_score:
            Math.round((flavourSums.fresh / flavourSampleCount) * 10) / 10,
          strong_score:
            Math.round((flavourSums.strong / flavourSampleCount) * 10) / 10,
        };

  const recentOrders: DashboardOrderSummary[] = orders
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 10)
    .map((order) => ({
      id: order.id,
      guestName: order.guest_name,
      cocktailName:
        cocktailsById.get(order.cocktail_id)?.name ?? "Onbekende cocktail",
      status: order.status,
      createdAt: order.created_at,
    }));

  return {
    totals: {
      cocktails: cocktails.length,
      published: cocktails.filter((c) => c.is_published).length,
      drafts: cocktails.filter((c) => !c.is_published).length,
      orders: orders.length,
      openOrders:
        (statusCounts.get("ordered") ?? 0) +
        (statusCounts.get("in_progress") ?? 0) +
        (statusCounts.get("ready") ?? 0),
      highlights: highlights.length,
      activeHighlights: highlights.filter((h) => h.is_active).length,
    },
    popularCocktail: topCocktail
      ? {
          name: cocktailsById.get(topCocktail.id)?.name ?? "Onbekend",
          orderCount: topCocktail.count,
        }
      : null,
    popularSpirit: topSpirit
      ? {
          name: spiritsById.get(topSpirit.id)?.name ?? "Onbekend",
          orderCount: topSpirit.count,
        }
      : null,
    averageFlavourProfile,
    ordersByStatus: (
      ["ordered", "in_progress", "ready", "served"] as const
    ).map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    recentOrders,
  };
}
