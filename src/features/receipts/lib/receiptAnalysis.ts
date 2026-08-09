// Kassabonanalyse v1 — leest uitsluitend uit de twee goedgekeurde, al
// geteste views (public.receipt_spending_summary, public.receipt_item_
// prices). Geen enkele analysewaarde wordt hier herberekend uit raw
// shopping_receipt_items, en niets wordt teruggeschreven naar de database —
// alle aggregatie hieronder is pure, client-side afleiding uit de al
// opgehaalde view-rijen (klein datavolume, geen aparte query per periode
// nodig — zie de "query-efficiency"-afweging in het opleverrapport).
import { supabase } from "@/lib/supabase";

export type SpendingSummaryRow = {
  receipt_id: string;
  store_id: string | null;
  store_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  purchase_date: string;
  purchase_time: string | null;
  currency: string;
  subtotal: number | null;
  discount_total: number | null;
  deposit_total: number | null;
  total_paid: number | null;
  spending_excluding_deposit: number | null;
  purchase_year: number;
  purchase_month: number;
};

export async function fetchSpendingSummary(): Promise<SpendingSummaryRow[]> {
  const { data, error } = await supabase
    .from("receipt_spending_summary")
    .select("*")
    .order("purchase_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type ItemPriceRow = {
  receipt_item_id: string;
  product_id: string;
  product_name: string;
  product_variant_id: string | null;
  variant_name: string | null;
  store_id: string | null;
  store_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  purchase_date: string;
  purchase_time: string | null;
  comparison_unit: string;
  comparison_paid_price: number | null;
  comparison_price_unit: string | null;
};

export async function fetchItemPrices(): Promise<ItemPriceRow[]> {
  const { data, error } = await supabase
    .from("receipt_item_prices")
    .select(
      "receipt_item_id, product_id, product_name, product_variant_id, variant_name, store_id, store_name, branch_id, branch_name, purchase_date, purchase_time, comparison_unit, comparison_paid_price, comparison_price_unit",
    )
    .order("purchase_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const PERIODS = [
  "this_month",
  "last_month",
  "this_year",
  "all",
] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  this_month: "Deze maand",
  last_month: "Vorige maand",
  this_year: "Dit jaar",
  all: "Alles",
};

function isInPeriod(dateStr: string, period: Period, now: Date): boolean {
  if (period === "all") return true;
  const d = new Date(`${dateStr}T00:00:00`);
  if (period === "this_year") return d.getFullYear() === now.getFullYear();
  if (period === "this_month") {
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  }
  // last_month — new Date() normaliseert maand -1 in januari vanzelf naar
  // december van het voorgaande jaar, dus geen losse jaargrens-logica nodig.
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return (
    d.getFullYear() === lastMonth.getFullYear() &&
    d.getMonth() === lastMonth.getMonth()
  );
}

export function filterSummaryByPeriod(
  rows: SpendingSummaryRow[],
  period: Period,
  now: Date = new Date(),
): SpendingSummaryRow[] {
  return rows.filter((r) => isInPeriod(r.purchase_date, period, now));
}

export function filterItemPricesByPeriod(
  rows: ItemPriceRow[],
  period: Period,
  now: Date = new Date(),
): ItemPriceRow[] {
  return rows.filter((r) => isInPeriod(r.purchase_date, period, now));
}

// Som van een nullable geldveld, per currency — met expliciete telling van
// hoeveel bonnen een bekende waarde hadden t.o.v. het totaal in de periode.
// Dit is de kern van het NULL-principe: onbekend telt NOOIT als 0 mee in de
// som, en de UI kan via known/totalCount transparant "€X (voor Y van Z
// bonnen)" tonen i.p.v. een stil, mogelijk te laag totaal.
export type CurrencyStat = { currency: string; sum: number; count: number };

export type NullAwareAggregate = {
  stats: CurrencyStat[];
  totalCount: number;
};

function aggregateNullableField(
  rows: SpendingSummaryRow[],
  field:
    | "total_paid"
    | "discount_total"
    | "deposit_total"
    | "spending_excluding_deposit",
): NullAwareAggregate {
  const byCurrency = new Map<string, CurrencyStat>();
  for (const row of rows) {
    const value = row[field];
    const entry = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      sum: 0,
      count: 0,
    };
    if (value !== null) {
      entry.sum += value;
      entry.count += 1;
    }
    byCurrency.set(row.currency, entry);
  }
  return { stats: Array.from(byCurrency.values()), totalCount: rows.length };
}

export function aggregateTotalPaid(
  rows: SpendingSummaryRow[],
): NullAwareAggregate {
  return aggregateNullableField(rows, "total_paid");
}
export function aggregateSpendingExcludingDeposit(
  rows: SpendingSummaryRow[],
): NullAwareAggregate {
  return aggregateNullableField(rows, "spending_excluding_deposit");
}
export function aggregateDiscountTotal(
  rows: SpendingSummaryRow[],
): NullAwareAggregate {
  return aggregateNullableField(rows, "discount_total");
}
export function aggregateDepositTotal(
  rows: SpendingSummaryRow[],
): NullAwareAggregate {
  return aggregateNullableField(rows, "deposit_total");
}

export type StoreSpending = {
  storeId: string | null;
  storeName: string;
  currency: string;
  total: number;
};

// Bonnen zonder bekend total_paid dragen niet bij aan een winkeltotaal (er
// is niets betrouwbaars om op te tellen) — ze verdwijnen niet uit de bon,
// alleen uit deze specifieke som.
export function aggregateSpendingByStore(
  rows: SpendingSummaryRow[],
): StoreSpending[] {
  const byKey = new Map<string, StoreSpending>();
  for (const row of rows) {
    if (row.total_paid === null) continue;
    const storeName = row.store_name ?? "Onbekende winkel";
    const key = `${row.store_id ?? storeName}|${row.currency}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.total += row.total_paid;
    } else {
      byKey.set(key, {
        storeId: row.store_id,
        storeName,
        currency: row.currency,
        total: row.total_paid,
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.total - a.total);
}

export function recentItemPrices(
  rows: ItemPriceRow[],
  limit = 10,
): ItemPriceRow[] {
  return [...rows]
    .sort((a, b) =>
      a.purchase_date < b.purchase_date
        ? 1
        : a.purchase_date > b.purchase_date
          ? -1
          : 0,
    )
    .slice(0, limit);
}

// --- Productdetail & prijsgeschiedenis v1 -----------------------------
//
// Werkt uitsluitend op de al opgehaalde, ongefilterde item-prices-dataset
// (dezelfde react-query-cache als hierboven) — geen eigen query per product,
// dus geen N+1-gedrag. Aggregatie gebeurt strikt op product_id (technische
// sleutel); product_name/variant_name zijn puur presentatie.
//
// comparison_price_unit ("EUR/kg", "EUR/piece", ...) is de enige currency-
// aanduiding die de view exposeert (een losse `currency`-kolom bestaat niet
// in receipt_item_prices) — maar omdat comparison_price_unit exact non-null
// is wanneer comparison_paid_price non-null is (zelfde CASE-voorwaarden in
// 20260831000000_receipt_item_prices_view.sql), is de exacte stringwaarde
// ervan een volledig betrouwbare currency+eenheid-sleutel om nooit
// verschillende valuta/eenheden bij elkaar op te tellen.

// Een prijswaarneming is alleen "geldig" (bruikbaar voor kerncijfers/
// geschiedenis) als er een comparison_paid_price ÉN dus (zie boven) een
// comparison_price_unit is — NULL wordt hier nergens als 0 behandeld.
export type ValidPriceObservation = ItemPriceRow & {
  comparison_paid_price: number;
  comparison_price_unit: string;
};

function isValidPriceObservation(
  row: ItemPriceRow,
): row is ValidPriceObservation {
  return (
    row.comparison_paid_price !== null && row.comparison_price_unit !== null
  );
}

// Sorteert nieuw -> oud: purchase_date, dan purchase_time als tiebreaker,
// dan receipt_item_id als laatste, stabiele fallback (nooit onbepaalde
// volgorde bij identieke datum+tijd). Ontbrekende purchase_time wordt als
// "vroegst op die dag" behandeld — een bewuste, onschadelijke keuze voor de
// zeldzame gevallen zonder bontijd.
export function sortObservationsNewestFirst(
  rows: ValidPriceObservation[],
): ValidPriceObservation[] {
  return [...rows].sort((a, b) => {
    if (a.purchase_date !== b.purchase_date) {
      return a.purchase_date < b.purchase_date ? 1 : -1;
    }
    const aTime = a.purchase_time ?? "";
    const bTime = b.purchase_time ?? "";
    if (aTime !== bTime) {
      return aTime < bTime ? 1 : -1;
    }
    if (a.receipt_item_id !== b.receipt_item_id) {
      return a.receipt_item_id < b.receipt_item_id ? 1 : -1;
    }
    return 0;
  });
}

export type ProductPriceDetail = {
  // comparison_unit (kg/liter/piece/none) is een producteigenschap, dus
  // gelijk voor élke rij van dit product_id — ook rijen zonder geldige prijs.
  // Gebruikt voor het header-label ("Prijs per kg"), onafhankelijk van of er
  // al geldige waarnemingen zijn.
  comparisonUnit: string | null;
  productName: string | null;
  // De getoonde, currency/eenheid-consistente groep: de groep van de meest
  // recente geldige waarneming. Nieuw -> oud gesorteerd.
  observations: ValidPriceObservation[];
  primaryPriceUnit: string | null;
  // Aantal geldige waarnemingen van datzelfde product die een ANDER
  // comparison_price_unit hadden (bv. een andere valuta) en daarom bewust
  // buiten de kerncijfers/geschiedenis zijn gehouden — nooit stilzwijgend
  // gecombineerd, wel transparant gemeld.
  excludedOtherUnitCount: number;
};

// Kiest, wanneer een product (zelden) meerdere currency/eenheid-combinaties
// heeft, de eenvoudigste betrouwbare oplossing (optie 2 uit de spec): toon
// statistieken/geschiedenis alleen voor de groep van de nieuwste waarneming,
// en meld expliciet hoeveel oudere waarnemingen met een afwijkende
// valuta/eenheid daardoor niet zijn meegenomen — in plaats van twee losse
// groepen-UI's te bouwen voor een geval dat in de praktijk (vast NL-
// huishouden, vrijwel altijd EUR) nauwelijks voorkomt.
export function buildProductPriceDetail(
  itemPrices: ItemPriceRow[],
  productId: string,
): ProductPriceDetail {
  const productRows = itemPrices.filter((r) => r.product_id === productId);
  const comparisonUnit = productRows[0]?.comparison_unit ?? null;
  const productName = productRows[0]?.product_name ?? null;

  const valid = productRows.filter(isValidPriceObservation);
  if (valid.length === 0) {
    return {
      comparisonUnit,
      productName,
      observations: [],
      primaryPriceUnit: null,
      excludedOtherUnitCount: 0,
    };
  }

  const sorted = sortObservationsNewestFirst(valid);
  const primaryPriceUnit = sorted[0].comparison_price_unit;
  const observations = sorted.filter(
    (o) => o.comparison_price_unit === primaryPriceUnit,
  );
  return {
    comparisonUnit,
    productName,
    observations,
    primaryPriceUnit,
    excludedOtherUnitCount: sorted.length - observations.length,
  };
}

export type ProductPriceStats = {
  latest: ValidPriceObservation;
  previous: ValidPriceObservation | null;
  average: number;
  lowest: number;
  highest: number;
  count: number;
  // null wanneer er nog geen vorige waarneming is (dan geen vergelijking) of
  // wanneer de vorige prijs 0 was (deling door 0 vermeden, dus geen %).
  diffAbsolute: number | null;
  diffPercent: number | null;
};

// Alle berekeningen op de volle, ongeronde database-waarden — afronding
// gebeurt uitsluitend bij weergave (formatComparisonPrice/formatPriceDiff),
// nooit hier.
export function computeProductPriceStats(
  observations: ValidPriceObservation[],
): ProductPriceStats | null {
  if (observations.length === 0) return null;
  const latest = observations[0];
  const previous = observations.length > 1 ? observations[1] : null;
  const prices = observations.map((o) => o.comparison_paid_price);
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);

  let diffAbsolute: number | null = null;
  let diffPercent: number | null = null;
  if (previous) {
    diffAbsolute =
      latest.comparison_paid_price - previous.comparison_paid_price;
    if (previous.comparison_paid_price > 0) {
      diffPercent = (diffAbsolute / previous.comparison_paid_price) * 100;
    }
  }

  return {
    latest,
    previous,
    average,
    lowest,
    highest,
    count: observations.length,
    diffAbsolute,
    diffPercent,
  };
}

// --- Goedkoopste winkel & prijsvergelijking per product v1 -----------
//
// Werkt uitsluitend op de al gefilterde/gegroepeerde observations van
// buildProductPriceDetail() (dezelfde comparison_price_unit-groep als de
// rest van het productdetail) — geen eigen currency/unit-selectie, geen
// nieuwe query.
//
// store_id op shopping_receipts is nullable (`references public.stores(id)
// on delete set null`, geverifieerd in 20260827000000) en save_receipt_v1
// vult 'm bij import nooit in (blijft null totdat stores.ts een match
// vindt) — een geldige, gematchte prijswaarneming kan dus wél een
// betrouwbare product-match hebben terwijl de winkel zelf nog niet aan een
// canonieke store gekoppeld is. Zulke waarnemingen worden hier samen
// getoond onder "Onbekende winkel" (eenvoudigste implementatie), maar zijn
// nooit een geldige kandidaat voor "historisch goedkoopst" — zie
// determineHistoricallyCheapestStore.
export type StorePriceStats = {
  storeId: string | null;
  storeName: string;
  observationCount: number;
  latestPrice: number;
  latestDate: string;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  // true wanneer binnen deze winkelgroep meerdere verschillende, bekende
  // product_variant_id's voorkomen (bv. Ricotta 250g én 500g) — puur
  // contextuele waarschuwing, verandert niets aan de berekening zelf.
  hasMultipleVariants: boolean;
};

function sortStorePriceStats(stats: StorePriceStats[]): StorePriceStats[] {
  return [...stats].sort((a, b) => {
    if (a.averagePrice !== b.averagePrice)
      return a.averagePrice - b.averagePrice;
    if (a.latestPrice !== b.latestPrice) return a.latestPrice - b.latestPrice;
    return a.storeName.localeCompare(b.storeName, "nl");
  });
}

export function aggregateProductPricesByStore(
  observations: ValidPriceObservation[],
): StorePriceStats[] {
  const byStore = new Map<string, ValidPriceObservation[]>();
  for (const o of observations) {
    const key = o.store_id ?? "__unknown__";
    const list = byStore.get(key) ?? [];
    list.push(o);
    byStore.set(key, list);
  }

  const result: StorePriceStats[] = [];
  for (const obs of byStore.values()) {
    // Zelfde sorteerlogica als de productgeschiedenis (purchase_date desc,
    // purchase_time desc, receipt_item_id tie-breaker) — de eerste rij is
    // dus de meest recente waarneming binnen deze winkel.
    const sorted = sortObservationsNewestFirst(obs);
    const prices = sorted.map((o) => o.comparison_paid_price);
    const variantIds = new Set(
      sorted
        .filter((o) => o.product_variant_id !== null)
        .map((o) => o.product_variant_id),
    );
    result.push({
      storeId: sorted[0].store_id,
      storeName: sorted[0].store_name ?? "Onbekende winkel",
      observationCount: sorted.length,
      latestPrice: sorted[0].comparison_paid_price,
      latestDate: sorted[0].purchase_date,
      averagePrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      hasMultipleVariants: variantIds.size >= 2,
    });
  }

  return sortStorePriceStats(result);
}

// Alleen winkels met een betrouwbare store_id komen in aanmerking voor de
// "Historisch goedkoopst"-aanduiding — de "Onbekende winkel"-groep kan in
// werkelijkheid meerdere, niet van elkaar te onderscheiden winkels bevatten,
// dus die als "de goedkoopste winkel" aanmerken zou een claim zijn die de
// data niet dekt. Vereist minimaal 2 betrouwbare winkels; stats is al
// oplopend gesorteerd op averagePrice, dus de eerste betrouwbare rij is de
// goedkoopste.
export function determineHistoricallyCheapestStore(
  stats: StorePriceStats[],
): string | null {
  const reliable = stats.filter((s) => s.storeId !== null);
  if (reliable.length < 2) return null;
  return reliable[0].storeId;
}
