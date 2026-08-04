import type { DashboardStats } from "@/features/cocktail-bar/lib/dashboard";

export function CocktailDashboardHighlights({
  stats,
}: {
  stats: DashboardStats;
}) {
  return (
    <div className="cb-tile space-y-1.5 p-4">
      <p className="cb-muted text-xs uppercase tracking-wide">
        Persoonlijke presentaties
      </p>
      <p className="cb-heading font-serif text-3xl">
        {stats.totals.activeHighlights} / {stats.totals.highlights}
      </p>
      <p className="cb-muted text-xs">actief / totaal</p>
    </div>
  );
}
