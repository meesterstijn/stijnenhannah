// UUID's voor records worden op het apparaat aangemaakt (offline-first).

export function newId(): string {
  return crypto.randomUUID();
}

// Deterministische UUID (v5-stijl, SHA-1) voor records die op elk apparaat
// hetzelfde id moeten krijgen, zoals de standaarddisciplines van een
// gebruiker: twee apparaten die allebei de eerste keer seeden, maken zo
// geen dubbele disciplines.
const NAMESPACE = "6f1c2d9e-5b7a-4c3e-9a2b-8d4e1f0a7c55";

export async function deterministicId(name: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${NAMESPACE}:${name}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes));
  hash[6] = (hash[6] & 0x0f) | 0x50; // versie 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122-variant
  const hex = [...hash.slice(0, 16)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
