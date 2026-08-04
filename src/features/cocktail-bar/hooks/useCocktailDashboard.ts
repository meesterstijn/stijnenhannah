import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardStats,
  type DashboardPeriod,
} from "@/features/cocktail-bar/lib/dashboard";

// Geen eigen Realtime-kanaal (plan §7) — dit is een terugkijkscherm, geen
// live-oppervlak zoals Bereiden/Big Screen. Periodieke + on-focus refetch
// (React Query's default) is voldoende om een net geplaatste bestelling
// zonder handmatig herladen te laten meetellen.
export function useCocktailDashboard(period: DashboardPeriod) {
  return useQuery({
    queryKey: ["cocktail_bar", "dashboard", period],
    queryFn: () => fetchDashboardStats(period),
    refetchInterval: 20_000,
  });
}
