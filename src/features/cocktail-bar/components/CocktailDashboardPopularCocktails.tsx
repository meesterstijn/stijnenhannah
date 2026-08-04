import type { DashboardStats } from "@/features/cocktail-bar/lib/dashboard";

export function CocktailDashboardPopularCocktails({
  stats,
}: {
  stats: DashboardStats;
}) {
  return (
    <div className="cb-tile space-y-3 p-4">
      <h3 className="cb-heading text-lg">Populair</h3>
      {stats.popularCocktail ? (
        <p className="text-sm">
          <span className="cb-muted">Cocktail: </span>
          {stats.popularCocktail.name} ({stats.popularCocktail.orderCount}x)
        </p>
      ) : (
        <p className="cb-muted text-sm">Nog geen bestellingen.</p>
      )}
      {stats.popularSpirit && (
        <p className="text-sm">
          <span className="cb-muted">Basisdrank: </span>
          {stats.popularSpirit.name} ({stats.popularSpirit.orderCount}x)
        </p>
      )}
    </div>
  );
}
