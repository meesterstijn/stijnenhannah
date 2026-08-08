// Kassabon-JSON v1: parsing + validatie, puur client-side en zonder
// Supabase-afhankelijkheid — zo blijft dit los te testen/hergebruiken van de
// opslaglaag (receiptsApi.ts). Bewust strikt (geen stille coercie van bv.
// stringgetallen): een duidelijke foutmelding is beter dan een half-geldige
// import.

export type ReceiptItemInput = {
  name: string;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
  category: string | null;
  discount: number | null;
};

export type ReceiptInput = {
  store: string;
  purchase_date: string;
  currency: string;
  total: number | null;
  items: ReceiptItemInput[];
};

export type ParseReceiptResult =
  | { ok: true; data: ReceiptInput }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidDateString(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

function optionalString(v: unknown, field: string, line?: number): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string") {
    return {
      ok: false,
      error: line
        ? `Regel ${line}: veld '${field}' moet tekst zijn.`
        : `Veld '${field}' moet tekst zijn.`,
    };
  }
  return { ok: true, value: v.trim() || null };
}

function optionalNumber(v: unknown, field: string, line?: number): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return {
      ok: false,
      error: line
        ? `Regel ${line}: veld '${field}' moet een getal zijn.`
        : `Veld '${field}' moet een getal zijn.`,
    };
  }
  return { ok: true, value: v };
}

export function parseReceiptJson(raw: unknown): ParseReceiptResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Het JSON-bestand moet één bonobject bevatten (geen lijst of leeg bestand)." };
  }

  if (typeof raw.store !== "string" || !raw.store.trim()) {
    return { ok: false, error: "Veld 'store' ontbreekt of is leeg." };
  }

  if (typeof raw.purchase_date !== "string" || !isValidDateString(raw.purchase_date)) {
    return { ok: false, error: "Veld 'purchase_date' ontbreekt of heeft niet de vorm JJJJ-MM-DD." };
  }

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    return { ok: false, error: "Veld 'items' ontbreekt of bevat geen producten." };
  }

  const currencyResult = optionalString(raw.currency, "currency");
  if (!currencyResult.ok) return currencyResult;

  const totalResult = optionalNumber(raw.total, "total");
  if (!totalResult.ok) return totalResult;

  const items: ReceiptItemInput[] = [];
  for (let idx = 0; idx < raw.items.length; idx++) {
    const rawItem = raw.items[idx];
    const line = idx + 1;
    if (!isPlainObject(rawItem)) {
      return { ok: false, error: `Regel ${line}: is geen geldig product-object.` };
    }
    if (typeof rawItem.name !== "string" || !rawItem.name.trim()) {
      return { ok: false, error: `Regel ${line}: veld 'name' ontbreekt of is leeg.` };
    }

    const brand = optionalString(rawItem.brand, "brand", line);
    if (!brand.ok) return brand;
    const unit = optionalString(rawItem.unit, "unit", line);
    if (!unit.ok) return unit;
    const category = optionalString(rawItem.category, "category", line);
    if (!category.ok) return category;
    const quantity = optionalNumber(rawItem.quantity, "quantity", line);
    if (!quantity.ok) return quantity;
    const unitPrice = optionalNumber(rawItem.unit_price, "unit_price", line);
    if (!unitPrice.ok) return unitPrice;
    const lineTotal = optionalNumber(rawItem.line_total, "line_total", line);
    if (!lineTotal.ok) return lineTotal;
    const discount = optionalNumber(rawItem.discount, "discount", line);
    if (!discount.ok) return discount;

    items.push({
      name: rawItem.name.trim(),
      brand: brand.value,
      quantity: quantity.value,
      unit: unit.value,
      unit_price: unitPrice.value,
      line_total: lineTotal.value,
      category: category.value,
      discount: discount.value,
    });
  }

  return {
    ok: true,
    data: {
      store: raw.store.trim(),
      purchase_date: raw.purchase_date,
      currency: currencyResult.value ?? "EUR",
      total: totalResult.value,
      items,
    },
  };
}

export type ParseReceiptFileResult =
  | { ok: true; data: ReceiptInput; raw: unknown }
  | { ok: false; error: string };

// Losse stap (i.p.v. in parseReceiptJson zelf) zodat een JSON.parse-fout
// altijd dezelfde duidelijke Nederlandstalige melding geeft, ongeacht welke
// SyntaxError de browser precies teruggeeft. Geeft ook het ruwe geparste
// object terug (voor source_json), zodat de caller niet twee keer hoeft te
// parsen.
export function parseReceiptFileText(text: string): ParseReceiptFileResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Dit bestand bevat geen geldige JSON." };
  }
  const result = parseReceiptJson(raw);
  if (!result.ok) return result;
  return { ok: true, data: result.data, raw };
}
