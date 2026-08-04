import {
  ORDER_STATUS_LABELS,
  type DashboardStats,
} from "@/features/cocktail-bar/lib/dashboard";

export function CocktailDashboardRecentOrders({
  stats,
}: {
  stats: DashboardStats;
}) {
  return (
    <div className="cb-tile space-y-3 p-4">
      <h3 className="cb-heading text-lg">Recente bestellingen</h3>
      {stats.recentOrders.length === 0 ? (
        <p className="cb-muted text-sm">Nog geen bestellingen.</p>
      ) : (
        <ul className="divide-y divide-[var(--cb-border)]">
          {stats.recentOrders.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {order.guestName} — {order.cocktailName}
              </span>
              <span className="cb-badge shrink-0">
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
