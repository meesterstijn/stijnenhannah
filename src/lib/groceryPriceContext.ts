import type { PaidPriceObservation } from "@/features/receipts/lib/receiptAnalysis";
import {
  formatCurrencyAmount,
  formatComparisonPrice,
} from "@/features/receipts/lib/formatters";

// Zuivere Dutch-copy-opmaak voor de boodschappenlijst-prijscontext — geen
// eigen prijsberekening, alleen samenvoegen van al bestaande, al berekende
// velden (paid_line_total/comparison_paid_price/comparison_price_unit) tot
// de compacte regel uit de opdracht ("Laatst €1,19 bij Albert Heijn ·
// €79,33/kg"). `observation` is undefined wanneer het boodschappenproduct
// wél gekoppeld is aan een canoniek product, maar dat product nog geen
// bruikbare (paid_line_total) historische aankoop heeft.
//
// comparison_price_unit ("EUR/kg") is de enige plek waar receipt_item_prices
// een currency-aanduiding blootgeeft (zie receiptAnalysis.ts) — ontbreekt
// die (geen vergelijkprijs bekend), dan is er voor déze regel geen andere
// currency-bron beschikbaar. Dit huishouden koopt uitsluitend in euro's
// (shopping_receipts.currency default 'EUR', zie 20260826000000_shopping_
// receipts.sql), dus "EUR" is hier een veilige, bestaande aanname — geen
// nieuwe prijslogica, puur een weergavekeuze voor een label.
export function formatGroceryPriceLine(
  observation: PaidPriceObservation | undefined,
): string {
  if (!observation) return "Nog geen prijsgegevens";

  const currency = observation.comparison_price_unit?.split("/")[0] ?? "EUR";
  let line = `Laatst ${formatCurrencyAmount(observation.paid_line_total, currency)}`;

  if (observation.store_name) {
    line += ` bij ${observation.store_name}`;
  }

  if (
    observation.comparison_paid_price !== null &&
    observation.comparison_price_unit
  ) {
    line += ` · ${formatComparisonPrice(observation.comparison_paid_price, observation.comparison_price_unit)}`;
  }

  return line;
}
