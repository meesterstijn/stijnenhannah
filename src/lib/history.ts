const HISTORY_KEY = "boodschappen_history";

export function parseItem(raw: string): { name: string; qty: number } {
  const text = raw.trim();
  const prefix = text.match(/^(\d+)[xX]?\s+(.+)$/);
  if (prefix) return { qty: parseInt(prefix[1]), name: prefix[2].trim() };
  const suffix = text.match(/^(.+?)\s+(\d+)[xX]?$/);
  if (suffix) return { qty: parseInt(suffix[2]), name: suffix[1].trim() };
  return { qty: 1, name: text };
}

export function getHistory(): string[] {
  try {
    const raw: string[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const seen = new Set<string>();
    const result: string[] = [];
    for (const entry of raw) {
      const name = parseItem(entry).name;
      if (!seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        result.push(name);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function saveToHistory(item: string) {
  const normalized = item.trim();
  if (!normalized) return;
  const history = getHistory();
  const updated = [
    normalized,
    ...history.filter((h) => h.toLowerCase() !== normalized.toLowerCase()),
  ].slice(0, 100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export function removeFromHistory(item: string) {
  const raw: string[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  const updated = raw.filter(
    (e) => parseItem(e).name.toLowerCase() !== item.toLowerCase()
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}
