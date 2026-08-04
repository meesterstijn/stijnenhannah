import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useCocktailDashboard } from "@/features/cocktail-bar/hooks/useCocktailDashboard";
import { CocktailDashboardPeriodFilter } from "@/features/cocktail-bar/components/CocktailDashboardPeriodFilter";
import { CocktailDashboardStatCard } from "@/features/cocktail-bar/components/CocktailDashboardStatCard";
import { CocktailDashboardPopularCocktails } from "@/features/cocktail-bar/components/CocktailDashboardPopularCocktails";
import { CocktailDashboardFlavourOverview } from "@/features/cocktail-bar/components/CocktailDashboardFlavourOverview";
import { CocktailDashboardOrdersByStatus } from "@/features/cocktail-bar/components/CocktailDashboardOrdersByStatus";
import { CocktailDashboardRecentOrders } from "@/features/cocktail-bar/components/CocktailDashboardRecentOrders";
import { CocktailDashboardHighlights } from "@/features/cocktail-bar/components/CocktailDashboardHighlights";
import { CocktailDashboardCleanup } from "@/features/cocktail-bar/components/CocktailDashboardCleanup";
import type { DashboardPeriod } from "@/features/cocktail-bar/lib/dashboard";

export default function CocktailBarDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const { data: stats, isLoading } = useCocktailDashboard(period);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="cb-heading font-serif text-3xl">Dashboard</h1>
        <CocktailDashboardPeriodFilter period={period} onChange={setPeriod} />
      </div>

      {isLoading || !stats ? (
        <div className="flex justify-center py-16 cb-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CocktailDashboardStatCard
              label="Cocktails"
              value={stats.totals.cocktails}
            />
            <CocktailDashboardStatCard
              label="Gepubliceerd"
              value={stats.totals.published}
            />
            <CocktailDashboardStatCard
              label="Bestellingen"
              value={stats.totals.orders}
            />
            <CocktailDashboardStatCard
              label="Openstaand"
              value={stats.totals.openOrders}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CocktailDashboardPopularCocktails stats={stats} />
            <CocktailDashboardOrdersByStatus stats={stats} />
            <CocktailDashboardHighlights stats={stats} />
            <CocktailDashboardFlavourOverview stats={stats} />
            <div className="sm:col-span-2 lg:col-span-2">
              <CocktailDashboardRecentOrders stats={stats} />
            </div>
          </div>

          <CocktailDashboardCleanup />
        </>
      )}
    </div>
  );
}
