// Deterministische, niet-cryptografische fingerprint voor duplicaatdetectie
// bij kassabon-import (zie findReceiptDuplicate in receiptsApi.ts). Puur een
// stabiele, genormaliseerde string — geen hashing-library nodig voor v1, en
// bewust GEEN unique constraint in de database: twee echt identieke
// transacties (zelfde winkel/tijd/bedrag) moeten alsnog beide importeerbaar
// blijven, dit is alleen een signaal voor de UI.
import type { ReceiptData } from "./parseReceiptFile";

function normalizeSegment(v: string | null | undefined): string {
  if (!v) return "";
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

export function computeReceiptFingerprint(receipt: ReceiptData): string {
  return [
    normalizeSegment(receipt.store_name),
    normalizeSegment(receipt.branch_name),
    normalizeSegment(receipt.store_number),
    receipt.purchase_date,
    receipt.purchase_time ?? "",
    receipt.total_paid.toFixed(2),
    String(receipt.items.length),
  ].join("|");
}
