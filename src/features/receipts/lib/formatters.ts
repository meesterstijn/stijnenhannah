// Gedeelde formatters voor de kassabonanalyse — de rest van de receipts-
// feature (ReceiptImportCard, UnmatchedProductsSheet) definieert een eigen
// lokale formatCurrency, maar de analyse-UI heeft dezelfde formattering op
// meerdere plekken nodig (kerncijfers, winkellijst, productprijzen), dus
// hier bewust één centrale plek i.p.v. herhaalde losse implementaties.

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€" };

// €126,90 — nooit lange SQL-decimalen.
export function formatCurrencyAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// comparison_price_unit uit de database is altijd "<CURRENCY>/kg" |
// "<CURRENCY>/l" | "<CURRENCY>/piece" (zie 20260831000000_receipt_item_
// prices_view.sql) — hier alleen de Nederlandse presentatie ("piece" ->
// "stuk"), de onderliggende currency blijft generiek (geen hardcoded EUR-
// aanname): een bekende valuta krijgt een symbool, een onbekende de
// letterlijke 3-lettercode.
export function formatComparisonPrice(
  amount: number | null,
  unit: string | null,
): string {
  if (amount === null || !unit) return "Geen vergelijkprijs";
  const [currency, denom] = unit.split("/");
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const denomLabel = denom === "piece" ? "stuk" : denom;
  const formattedAmount = amount.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formattedAmount}/${denomLabel}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
