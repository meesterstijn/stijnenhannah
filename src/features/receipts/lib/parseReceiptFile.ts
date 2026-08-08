// Kassabon-JSON, schema_version "1.0" — parsing + validatie, puur
// client-side en zonder Supabase-afhankelijkheid (zie receiptsApi.ts voor de
// opslaglaag). Bewust strikt: geen stille coercie van bv. stringgetallen, en
// de parser mag zelf NOOIT informatie verzinnen of raw-bedragen "mooier"
// maken (zie het commentaar bij reconstructWarning hieronder) — een
// duidelijke foutmelding/waarschuwing is beter dan een half-geldige of
// stilzwijgend gecorrigeerde import.
//
// Oudere kassabon-JSON (zonder schema_version) wordt bewust NIET meer
// geconverteerd — dat zou een aparte, blijvend te onderhouden legacy-laag
// vereisen voor een formaat dat nooit echt in gebruik is geweest. In plaats
// daarvan een directe, duidelijke foutmelding (zie parseReceiptJson).

export const UNITS = ["kg", "g", "l", "ml", "piece"] as const;
export type Unit = (typeof UNITS)[number];

export const LINE_TYPES = [
  "product",
  "discount",
  "deposit",
  "service_or_other",
] as const;
export type LineType = (typeof LINE_TYPES)[number];

export const PROMOTION_TYPES = [
  "bonus",
  "1_plus_1",
  "percentage_discount",
  "fixed_discount",
  "multi_buy",
  "other",
] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export type ReceiptRawItem = {
  name: string;
  brand: string | null;
  quantity: number | null;
  weight: number | null;
  weight_unit: Unit | null;
  regular_unit_price: number | null;
  regular_line_total: number | null;
  discount_amount: number | null;
  paid_line_total: number;
  promotion_type: PromotionType | null;
  promotion_text: string | null;
};

// Losse, expliciet niet-autoritatieve interpretatielaag — nooit door de
// parser/API gebruikt om products/variants/aliases aan te maken of
// product_id/product_variant_id te vullen (zie receiptsApi.ts).
export type ReceiptItemHints = {
  normalized_name: string | null;
  brand: string | null;
  category: string | null;
  package_size: number | null;
  package_unit: Unit | null;
};

export type ReceiptItem = {
  line_type: LineType;
  raw: ReceiptRawItem;
  hints: ReceiptItemHints;
};

export type ReceiptTaxLine = {
  rate: number;
  taxable_amount: number;
  tax_amount: number;
};

export type ReceiptData = {
  schema_version: "1.0";
  store_name: string;
  branch_name: string | null;
  store_number: string | null;
  purchase_date: string;
  purchase_time: string | null;
  currency: string;
  subtotal: number | null;
  discount_total: number | null;
  deposit_total: number | null;
  total_paid: number;
  tax_lines: ReceiptTaxLine[];
  items: ReceiptItem[];
};

export type ParseWarning = { code: string; message: string };

export type ParseReceiptResult =
  | { ok: true; data: ReceiptData; warnings: ParseWarning[] }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidDateString(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

function prefixLabel(field: string, line?: number): string {
  return line ? `Regel ${line}: veld '${field}'` : `Veld '${field}'`;
}

function optionalString(
  v: unknown,
  field: string,
  line?: number,
): FieldResult<string | null> {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string") {
    return { ok: false, error: `${prefixLabel(field, line)} moet tekst zijn.` };
  }
  return { ok: true, value: v.trim() || null };
}

function requiredString(
  v: unknown,
  field: string,
  line?: number,
): FieldResult<string> {
  if (typeof v !== "string" || !v.trim()) {
    return {
      ok: false,
      error: `${prefixLabel(field, line)} ontbreekt of is leeg.`,
    };
  }
  return { ok: true, value: v.trim() };
}

function optionalNumber(
  v: unknown,
  field: string,
  opts: { positive?: boolean } = {},
  line?: number,
): FieldResult<number | null> {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return {
      ok: false,
      error: `${prefixLabel(field, line)} moet een getal zijn.`,
    };
  }
  if (opts.positive && v <= 0) {
    return {
      ok: false,
      error: `${prefixLabel(field, line)} moet groter dan 0 zijn wanneer aanwezig.`,
    };
  }
  return { ok: true, value: v };
}

function requiredNumber(
  v: unknown,
  field: string,
  opts: { min?: number } = {},
  line?: number,
): FieldResult<number> {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return {
      ok: false,
      error: `${prefixLabel(field, line)} ontbreekt of is geen getal.`,
    };
  }
  if (opts.min !== undefined && v < opts.min) {
    return {
      ok: false,
      error: `${prefixLabel(field, line)} mag niet kleiner zijn dan ${opts.min}.`,
    };
  }
  return { ok: true, value: v };
}

function optionalEnum<T extends string>(
  v: unknown,
  field: string,
  allowed: readonly T[],
  line?: number,
): FieldResult<T | null> {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    return {
      ok: false,
      error: `${prefixLabel(field, line)} moet één van deze waarden zijn: ${allowed.join(", ")} (of null).`,
    };
  }
  return { ok: true, value: v as T };
}

function requiredEnum<T extends string>(
  v: unknown,
  field: string,
  allowed: readonly T[],
  line?: number,
): FieldResult<T> {
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    return {
      ok: false,
      error: `${prefixLabel(field, line)} ontbreekt of moet één van deze waarden zijn: ${allowed.join(", ")}.`,
    };
  }
  return { ok: true, value: v as T };
}

function parseTaxLine(raw: unknown, line: number): FieldResult<ReceiptTaxLine> {
  if (!isPlainObject(raw)) {
    return { ok: false, error: `Btw-regel ${line}: is geen geldig object.` };
  }
  const rate = requiredNumber(raw.rate, "rate", { min: 0 }, line);
  if (!rate.ok) return rate;
  const taxable = requiredNumber(
    raw.taxable_amount,
    "taxable_amount",
    { min: 0 },
    line,
  );
  if (!taxable.ok) return taxable;
  const tax = requiredNumber(raw.tax_amount, "tax_amount", { min: 0 }, line);
  if (!tax.ok) return tax;
  return {
    ok: true,
    value: {
      rate: rate.value,
      taxable_amount: taxable.value,
      tax_amount: tax.value,
    },
  };
}

function parseItem(raw: unknown, line: number): FieldResult<ReceiptItem> {
  if (!isPlainObject(raw)) {
    return { ok: false, error: `Regel ${line}: is geen geldig regel-object.` };
  }

  const lineType = requiredEnum(raw.line_type, "line_type", LINE_TYPES, line);
  if (!lineType.ok) return lineType;

  const rawItem = raw.raw;
  if (!isPlainObject(rawItem)) {
    return {
      ok: false,
      error: `Regel ${line}: veld 'raw' ontbreekt of is geen object.`,
    };
  }

  const name = requiredString(rawItem.name, "raw.name", line);
  if (!name.ok) return name;
  const brand = optionalString(rawItem.brand, "raw.brand", line);
  if (!brand.ok) return brand;
  const quantity = optionalNumber(
    rawItem.quantity,
    "raw.quantity",
    { positive: true },
    line,
  );
  if (!quantity.ok) return quantity;
  const weight = optionalNumber(
    rawItem.weight,
    "raw.weight",
    { positive: true },
    line,
  );
  if (!weight.ok) return weight;
  const weightUnit = optionalEnum(
    rawItem.weight_unit,
    "raw.weight_unit",
    UNITS,
    line,
  );
  if (!weightUnit.ok) return weightUnit;
  const regularUnitPrice = optionalNumber(
    rawItem.regular_unit_price,
    "raw.regular_unit_price",
    {},
    line,
  );
  if (!regularUnitPrice.ok) return regularUnitPrice;
  const regularLineTotal = optionalNumber(
    rawItem.regular_line_total,
    "raw.regular_line_total",
    {},
    line,
  );
  if (!regularLineTotal.ok) return regularLineTotal;
  const discountAmount = optionalNumber(
    rawItem.discount_amount,
    "raw.discount_amount",
    {},
    line,
  );
  if (!discountAmount.ok) return discountAmount;
  if (discountAmount.value !== null && discountAmount.value < 0) {
    return {
      ok: false,
      error: `Regel ${line}: veld 'raw.discount_amount' moet 0 of positief zijn.`,
    };
  }
  const promotionType = optionalEnum(
    rawItem.promotion_type,
    "raw.promotion_type",
    PROMOTION_TYPES,
    line,
  );
  if (!promotionType.ok) return promotionType;
  const promotionText = optionalString(
    rawItem.promotion_text,
    "raw.promotion_text",
    line,
  );
  if (!promotionText.ok) return promotionText;

  const paidLineTotal = requiredNumber(
    rawItem.paid_line_total,
    "raw.paid_line_total",
    {},
    line,
  );
  if (!paidLineTotal.ok) return paidLineTotal;
  // Alleen discount-regels mogen negatief zijn (bv. een losse Bonus-regel
  // van -0,99) — voor elk ander regeltype zou een negatief bedrag de
  // signed-som (zie reconstructWarning) juist onbetrouwbaar maken, en is het
  // vermoedelijk een fout in de bron-JSON, geen geldig kassabonfeit.
  if (lineType.value !== "discount" && paidLineTotal.value < 0) {
    return {
      ok: false,
      error: `Regel ${line}: veld 'raw.paid_line_total' mag alleen negatief zijn bij line_type 'discount'.`,
    };
  }

  const hintsRaw = raw.hints;
  if (hintsRaw !== undefined && hintsRaw !== null && !isPlainObject(hintsRaw)) {
    return {
      ok: false,
      error: `Regel ${line}: veld 'hints' moet een object zijn.`,
    };
  }
  const hintsObj = isPlainObject(hintsRaw) ? hintsRaw : {};
  const normalizedName = optionalString(
    hintsObj.normalized_name,
    "hints.normalized_name",
    line,
  );
  if (!normalizedName.ok) return normalizedName;
  const hintBrand = optionalString(hintsObj.brand, "hints.brand", line);
  if (!hintBrand.ok) return hintBrand;
  const hintCategory = optionalString(
    hintsObj.category,
    "hints.category",
    line,
  );
  if (!hintCategory.ok) return hintCategory;
  const packageSize = optionalNumber(
    hintsObj.package_size,
    "hints.package_size",
    { positive: true },
    line,
  );
  if (!packageSize.ok) return packageSize;
  const packageUnit = optionalEnum(
    hintsObj.package_unit,
    "hints.package_unit",
    UNITS,
    line,
  );
  if (!packageUnit.ok) return packageUnit;

  return {
    ok: true,
    value: {
      line_type: lineType.value,
      raw: {
        name: name.value,
        brand: brand.value,
        quantity: quantity.value,
        weight: weight.value,
        weight_unit: weightUnit.value,
        regular_unit_price: regularUnitPrice.value,
        regular_line_total: regularLineTotal.value,
        discount_amount: discountAmount.value,
        paid_line_total: paidLineTotal.value,
        promotion_type: promotionType.value,
        promotion_text: promotionText.value,
      },
      hints: {
        normalized_name: normalizedName.value,
        brand: hintBrand.value,
        category: hintCategory.value,
        package_size: packageSize.value,
        package_unit: packageUnit.value,
      },
    },
  };
}

// Signed reconstructie: product/deposit/service_or_other tellen positief,
// discount-regels (per ontwerp negatief) tellen automatisch mee als
// aftrekking. Dit is de PRIMAIRE validatie — subtotal/discount_total worden
// bewust niet blind als extra waarheid gebruikt, alleen als secundaire,
// niet-overlappende check (zie subtotalWarning).
function reconstructWarning(
  items: ReceiptItem[],
  totalPaid: number,
): ParseWarning | null {
  const sum = items.reduce((acc, item) => acc + item.raw.paid_line_total, 0);
  const diff = Math.abs(sum - totalPaid);
  if (diff <= 0.02) return null;
  const suffix =
    diff >= 0.05 ? " Controleer de bon voordat je importeert." : "";
  return {
    code: diff >= 0.05 ? "total_mismatch_large" : "total_mismatch",
    message:
      `De som van alle regels (€${sum.toFixed(2)}) wijkt €${diff.toFixed(2)} af van het totaalbedrag ` +
      `(€${totalPaid.toFixed(2)}).${suffix}`,
  };
}

// Alleen relevant als subtotal/discount_total allebei bekend zijn, en alleen
// getoond als de primaire reconstructie-check hierboven al schoon was — zo
// niet, dan zou dit vrijwel altijd dezelfde onderliggende afwijking dubbel
// (en verwarrend) melden.
function subtotalWarning(
  subtotal: number | null,
  discountTotal: number | null,
  totalPaid: number,
): ParseWarning | null {
  if (subtotal === null || discountTotal === null) return null;
  const expected = subtotal - discountTotal;
  const diff = Math.abs(expected - totalPaid);
  if (diff <= 0.02) return null;
  return {
    code: "subtotal_mismatch",
    message:
      `Subtotaal (€${subtotal.toFixed(2)}) minus korting (€${discountTotal.toFixed(2)}) komt niet overeen ` +
      `met het totaalbedrag (€${totalPaid.toFixed(2)}).`,
  };
}

function taxLinesWarning(
  taxLines: ReceiptTaxLine[],
  totalPaid: number,
): ParseWarning | null {
  if (taxLines.length === 0) return null;
  const sum = taxLines.reduce(
    (acc, t) => acc + t.taxable_amount + t.tax_amount,
    0,
  );
  const diff = Math.abs(sum - totalPaid);
  if (diff <= 0.02) return null;
  return {
    code: "tax_lines_mismatch",
    message:
      `De btw-regels (samen €${sum.toFixed(2)}) wijken €${diff.toFixed(2)} af van het totaalbedrag ` +
      `(€${totalPaid.toFixed(2)}) — dit kan kloppen door statiegeld of afronding.`,
  };
}

export function parseReceiptJson(raw: unknown): ParseReceiptResult {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      error:
        "Het JSON-bestand moet één bonobject bevatten (geen lijst of leeg bestand).",
    };
  }

  if (raw.schema_version !== "1.0") {
    return {
      ok: false,
      error: "Oud kassabonformaat. Gebruik schema_version 1.0.",
    };
  }

  const receipt = raw.receipt;
  if (!isPlainObject(receipt)) {
    return { ok: false, error: "Veld 'receipt' ontbreekt of is geen object." };
  }

  const storeName = requiredString(receipt.store_name, "receipt.store_name");
  if (!storeName.ok) return storeName;
  const branchName = optionalString(receipt.branch_name, "receipt.branch_name");
  if (!branchName.ok) return branchName;
  const storeNumber = optionalString(
    receipt.store_number,
    "receipt.store_number",
  );
  if (!storeNumber.ok) return storeNumber;

  if (
    typeof receipt.purchase_date !== "string" ||
    !isValidDateString(receipt.purchase_date)
  ) {
    return {
      ok: false,
      error:
        "Veld 'receipt.purchase_date' ontbreekt of heeft niet de vorm JJJJ-MM-DD.",
    };
  }
  const purchaseDate = receipt.purchase_date;

  let purchaseTime: string | null = null;
  if (receipt.purchase_time !== undefined && receipt.purchase_time !== null) {
    if (
      typeof receipt.purchase_time !== "string" ||
      !TIME_RE.test(receipt.purchase_time)
    ) {
      return {
        ok: false,
        error:
          "Veld 'receipt.purchase_time' moet de vorm UU:MM of UU:MM:SS hebben.",
      };
    }
    purchaseTime = receipt.purchase_time;
  }

  if (
    typeof receipt.currency !== "string" ||
    !CURRENCY_RE.test(receipt.currency)
  ) {
    return {
      ok: false,
      error:
        "Veld 'receipt.currency' ontbreekt of moet 3 hoofdletters zijn, bv. EUR.",
    };
  }
  const currency = receipt.currency;

  const subtotal = optionalNumber(receipt.subtotal, "receipt.subtotal");
  if (!subtotal.ok) return subtotal;
  if (subtotal.value !== null && subtotal.value < 0) {
    return {
      ok: false,
      error: "Veld 'receipt.subtotal' mag niet negatief zijn.",
    };
  }
  const discountTotal = optionalNumber(
    receipt.discount_total,
    "receipt.discount_total",
  );
  if (!discountTotal.ok) return discountTotal;
  if (discountTotal.value !== null && discountTotal.value < 0) {
    return {
      ok: false,
      error: "Veld 'receipt.discount_total' mag niet negatief zijn.",
    };
  }
  const depositTotal = optionalNumber(
    receipt.deposit_total,
    "receipt.deposit_total",
  );
  if (!depositTotal.ok) return depositTotal;
  if (depositTotal.value !== null && depositTotal.value < 0) {
    return {
      ok: false,
      error: "Veld 'receipt.deposit_total' mag niet negatief zijn.",
    };
  }

  const totalPaid = requiredNumber(receipt.total_paid, "receipt.total_paid", {
    min: 0,
  });
  if (!totalPaid.ok) return totalPaid;

  const rawTaxLines = raw.tax_lines;
  if (rawTaxLines !== undefined && !Array.isArray(rawTaxLines)) {
    return {
      ok: false,
      error: "Veld 'tax_lines' moet een lijst zijn (mag leeg zijn).",
    };
  }
  const taxLines: ReceiptTaxLine[] = [];
  for (let i = 0; i < (rawTaxLines?.length ?? 0); i++) {
    const result = parseTaxLine((rawTaxLines as unknown[])[i], i + 1);
    if (!result.ok) return result;
    taxLines.push(result.value);
  }

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    return { ok: false, error: "Veld 'items' ontbreekt of bevat geen regels." };
  }
  const items: ReceiptItem[] = [];
  for (let i = 0; i < raw.items.length; i++) {
    const result = parseItem(raw.items[i], i + 1);
    if (!result.ok) return result;
    items.push(result.value);
  }

  const warnings: ParseWarning[] = [];
  const recon = reconstructWarning(items, totalPaid.value);
  if (recon) {
    warnings.push(recon);
  } else {
    const sub = subtotalWarning(
      subtotal.value,
      discountTotal.value,
      totalPaid.value,
    );
    if (sub) warnings.push(sub);
  }
  const tax = taxLinesWarning(taxLines, totalPaid.value);
  if (tax) warnings.push(tax);

  return {
    ok: true,
    warnings,
    data: {
      schema_version: "1.0",
      store_name: storeName.value,
      branch_name: branchName.value,
      store_number: storeNumber.value,
      purchase_date: purchaseDate,
      purchase_time: purchaseTime,
      currency,
      subtotal: subtotal.value,
      discount_total: discountTotal.value,
      deposit_total: depositTotal.value,
      total_paid: totalPaid.value,
      tax_lines: taxLines,
      items,
    },
  };
}

export type ParseReceiptFileResult =
  | { ok: true; data: ReceiptData; warnings: ParseWarning[]; raw: unknown }
  | { ok: false; error: string };

// Losse stap (i.p.v. in parseReceiptJson zelf) zodat een JSON.parse-fout
// altijd dezelfde duidelijke Nederlandstalige melding geeft, ongeacht welke
// SyntaxError de browser precies teruggeeft. Geeft ook het ruwe geparste
// object terug (voor source_json), zodat de caller niet twee keer hoeft te
// parsen en source_json exact het origineel blijft.
export function parseReceiptFileText(text: string): ParseReceiptFileResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Dit bestand bevat geen geldige JSON." };
  }
  const result = parseReceiptJson(raw);
  if (!result.ok) return result;
  return { ok: true, data: result.data, warnings: result.warnings, raw };
}
