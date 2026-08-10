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

// "7 aug 2026" — voor de prijsgeschiedenis in productdetail, die (in
// tegenstelling tot "Recente productprijzen") over meerdere jaren kan lopen,
// dus bewust MET jaartal. formatDateShort hierboven blijft ongewijzigd
// (jaartal-loos, al goedgekeurd en live) om die bestaande weergave niet te
// laten verschuiven.
export function formatDateShortWithYear(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "10 aug 2026" — voor volledige timestamptz-waarden (bv. product_aliases.
// last_used_at). In tegenstelling tot formatDateShort/formatDateShortWith
// Year/formatDateLong hierboven (die een losse DATE-kolom verwachten en
// daarom bewust "T00:00:00" toevoegen om een consistente lokale
// kalenderdag te forceren) is hier al een volledig ISO-tijdstip aanwezig,
// dat wordt dus rechtstreeks geparsed.
export function formatTimestampShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "7 augustus 2026" — voor de "Laatst geregistreerd"-regel in productdetail.
export function formatDateLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// comparison_unit uit products (kg/liter/piece/none) -> Nederlands label voor
// de productdetail-header ("Trostomaat / Prijs per kg"). "none" heeft geen
// zinvol per-eenheid-label, dus null (geen subtitel).
export function formatComparisonUnitLabel(unit: string): string | null {
  switch (unit) {
    case "kg":
      return "Prijs per kg";
    case "liter":
      return "Prijs per liter";
    case "piece":
      return "Prijs per stuk";
    default:
      return null;
  }
}

// Gedeelde variantlabel-logica — voorheen inline gedupliceerd in
// EditReceiptItemMatchDialog (varianten-dropdown). variant_name is en blijft
// de identiteit van de variant; package_size/package_unit/winkelbinding zijn
// losse technische velden op product_variants die hier UITSLUITEND voor
// presentatie worden samengevoegd — niets hiervan wordt in variant_name zelf
// opgeslagen of gedupliceerd. storeName is bewust een los, optioneel
// parameter (i.p.v. een store_id die deze functie zelf zou moeten opzoeken):
// verschillende databronnen kunnen een winkelnaam op verschillende manieren
// resolven (of soms helemaal niet, zie receipt_item_prices die geen
// variant-winkelbinding exposeert) — ontbreekt storeName, dan laat deze
// functie dat deel van het label gewoon weg (geen placeholder als
// "Generiek"; dat is, waar een aanroeper dat nuttig vindt, diens eigen
// keuze, zie de dropdown in EditReceiptItemMatchDialog).
export function formatVariantLabel(
  variant: {
    variant_name: string;
    package_size: number | null;
    package_unit: string | null;
  },
  storeName?: string | null,
): string {
  let label = variant.variant_name;
  if (variant.package_size !== null && variant.package_unit !== null) {
    label += ` (${variant.package_size} ${variant.package_unit})`;
  }
  if (storeName) {
    label += ` · ${storeName}`;
  }
  return label;
}

// "+€0,19 (+9,0%)" / "-€0,20 (-8,0%)" / "€0,00 (0,0%)" bij een exact gelijke
// prijs (geen misleidend "+"/"-" tonen als er niets veranderd is). unit is
// het comparison_price_unit-formaat ("EUR/kg") — alleen de currency ervan
// wordt gebruikt voor het symbool, de eenheid staat al elders op het scherm.
// diffPercent is null wanneer de vorige prijs 0 was (delen door 0 vermeden
// door de aanroeper) — dan tonen we alleen het bedrag, geen percentage.
export function formatPriceDiff(
  diffAbsolute: number,
  unit: string,
  diffPercent: number | null,
): string {
  const currency = unit.split("/")[0];
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const sign = diffAbsolute > 0 ? "+" : diffAbsolute < 0 ? "-" : "";
  const absAmount = Math.abs(diffAbsolute).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const amountPart = `${sign}${symbol}${absAmount}`;
  if (diffPercent === null) return amountPart;
  const absPercent = Math.abs(diffPercent).toLocaleString("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${amountPart} (${sign}${absPercent}%)`;
}
