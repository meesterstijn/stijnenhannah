import { useQuery } from "@tanstack/react-query";
import { fetchOrderQueue } from "@/features/cocktail-bar/lib/orders";

export const COCKTAIL_ORDER_QUEUE_QUERY_KEY = [
  "cocktail_bar",
  "orders",
  "queue",
] as const;

export function useCocktailBarOrderQueue() {
  return useQuery({
    queryKey: COCKTAIL_ORDER_QUEUE_QUERY_KEY,
    queryFn: fetchOrderQueue,
  });
}
