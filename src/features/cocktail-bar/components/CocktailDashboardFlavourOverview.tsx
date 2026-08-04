import { CocktailFlavourProfileChart } from "@/features/cocktail-bar/components/CocktailFlavourProfileChart";
import type { DashboardStats } from "@/features/cocktail-bar/lib/dashboard";

export function CocktailDashboardFlavourOverview({
  stats,
}: {
  stats: DashboardStats;
}) {
  return (
    <div className="cb-tile space-y-3 p-4">
      <h3 className="cb-heading text-lg">Gemiddeld smaakprofiel besteld</h3>
      {stats.averageFlavourProfile ? (
        <CocktailFlavourProfileChart profile={stats.averageFlavourProfile} />
      ) : (
        <p className="cb-muted text-sm">Nog geen bestellingen.</p>
      )}
    </div>
  );
}
