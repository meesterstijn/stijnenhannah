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
  purchase_date: string;
  comparison_unit: string;
  comparison_paid_price: number | null;
  comparison_price_unit: string | null;
};

export async function fetchItemPrices(): Promise<ItemPriceRow[]> {
  const { data, error } = await supabase
    .from("receipt_item_prices")
    .select(
      "receipt_item_id, product_id, product_name, product_variant_id, variant_name, store_id, store_name, purchase_date, comparison_unit, comparison_paid_price, comparison_price_unit",
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
