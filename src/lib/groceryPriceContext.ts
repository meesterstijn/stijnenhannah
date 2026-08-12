import type {
  GroceryBestStore,
  PaidPriceObservation,
} from "@/features/receipts/lib/receiptAnalysis";
import { effectivePaidUnitPrice } from "@/features/receipts/lib/receiptAnalysis";
import {
  formatCurrencyAmount,
  formatComparisonPrice,
} from "@/features/receipts/lib/formatters";
import { parseItem } from "@/lib/history";

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

// Compacte winkeltip — alleen relevant wanneer buildBestValueStoreByProduct()
// al bepaald heeft dat er minimaal 2 winkels met een geldige, recente
// vergelijkprijs zijn (zie receiptAnalysis.ts); hier puur presentatie, geen
// nieuwe vergelijkingslogica. Expliciet historische taal ("laatste
// aankopen"), nooit een actuele claim als "goedkoopste winkel".
export function formatGroceryBestStoreLine(
  bestStore: GroceryBestStore,
): string {
  return `Voordeligst o.b.v. laatste aankopen: ${bestStore.storeName} · ${formatComparisonPrice(
    bestStore.comparisonPaidPrice,
    bestStore.comparisonPriceUnit,
  )}`;
}

// Geschatte boodschappenprijs v1 — telt voor elke ACTIEVE boodschappenregel
// (de aanroeper filtert al op done === false, zie Boodschappen.tsx) de
// gewenste boodschappenhoeveelheid (parseItem().qty — exact dezelfde
// bestaande parser als de +/- stepper in ItemRow gebruikt) vermenigvuldigd
// met de effectief betaalde historische prijs per gekochte eenheid
// (effectivePaidUnitPrice(), receiptAnalysis.ts — de ENE centrale definitie
// hiervan, ook herbruikbaar voor toekomstige prijsfeatures). Koppeling
// exact zoals voorheen:
//   regel -> parseItem().name -> product_assignments.canonical_product_id
//   -> buildLatestPaidPriceByProduct()-Map (receiptAnalysis.ts).
// Bewust GEEN nieuw newest-algoritme, GEEN comparison_paid_price (dat is een
// prijs PER kg/liter/stuk, geen regelbedrag — optellen daarvan zou geen
// zinnig totaal opleveren). De bestaande "Laatst €1,19 bij Albert Heijn ·
// €79,33/kg"-regel (formatGroceryPriceLine hierboven) blijft bewust
// ONGEWIJZIGD — die beschrijft een historisch feit over ÉÉN aankoop, niet de
// gewenste hoeveelheid op de huidige boodschappentrip, en wordt hier niet
// hergebruikt voor de vermenigvuldiging (die gebruikt uitsluitend
// effectivePaidUnitPrice(), zie de STOP-analyse in het opleverrapport).
export type GroceryEstimatedTotal = {
  estimatedTotal: number;
  pricedItemCount: number;
  totalItemCount: number;
  missingPriceCount: number;
};

export function buildGroceryEstimatedTotal(
  activeItems: { text: string }[],
  canonicalProductIdByProduct: Map<string, string | null>,
  latestPaidPriceByProductId: Map<string, PaidPriceObservation>,
): GroceryEstimatedTotal {
  let estimatedTotal = 0;
  let pricedItemCount = 0;

  for (const item of activeItems) {
    const { name, qty } = parseItem(item.text);
    const canonicalProductId =
      canonicalProductIdByProduct.get(name.toLowerCase()) ?? null;
    if (!canonicalProductId) continue;
    const observation = latestPaidPriceByProductId.get(canonicalProductId);
    if (!observation) continue;
    estimatedTotal += qty * effectivePaidUnitPrice(observation);
    pricedItemCount += 1;
  }

  return {
    estimatedTotal,
    pricedItemCount,
    totalItemCount: activeItems.length,
    missingPriceCount: activeItems.length - pricedItemCount,
  };
}

// "Nog onvoldoende prijsgegevens" i.p.v. €0,00 wanneer geen enkel actief
// product prijsdata heeft — €0,00 zou anders een echte, zekere nulprijs
// suggereren.
export function formatGroceryEstimatedTotalLine(
  total: GroceryEstimatedTotal,
): string {
  return formatCurrencyAmount(total.estimatedTotal, "EUR");
}

export function formatGroceryEstimatedTotalCoverage(
  total: GroceryEstimatedTotal,
): string {
  const base = `Prijsdata voor ${total.pricedItemCount} van ${total.totalItemCount} producten`;
  return total.missingPriceCount > 0
    ? `${base} · ${total.missingPriceCount} zonder prijs`
    : base;
}
