// UUID's worden op het apparaat aangemaakt (offline-first).

export function newId(): string {
  return crypto.randomUUID();
}

// Deterministische UUID (v5-stijl, SHA-1) voor records die op elk apparaat
// hetzelfde id moeten krijgen, zoals "lichaamsgewicht op 29 oktober".
const NAMESPACE = "3b7f0e52-9c1d-4a6e-b8f2-5d0c7e9a1f34";

export async function deterministicId(name: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${NAMESPACE}:${name}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes));
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
