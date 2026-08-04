import {
  ORDER_STATUS_LABELS,
  type DashboardStats,
} from "@/features/cocktail-bar/lib/dashboard";

export function CocktailDashboardOrdersByStatus({
  stats,
}: {
  stats: DashboardStats;
}) {
  return (
    <div className="cb-tile space-y-3 p-4">
      <h3 className="cb-heading text-lg">Bestellingen per status</h3>
      <ul className="space-y-1.5 text-sm">
        {stats.ordersByStatus.map((item) => (
          <li key={item.status} className="flex items-center justify-between">
            <span>{ORDER_STATUS_LABELS[item.status]}</span>
            <span className="cb-muted tabular-nums">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
