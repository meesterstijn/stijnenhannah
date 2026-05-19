import { supabase } from "./supabase";

export function parseItem(raw: string): { name: string; qty: number } {
  const text = raw.trim();
  const prefix = text.match(/^(\d+)[xX]?\s+(.+)$/);
  if (prefix) return { qty: parseInt(prefix[1]), name: prefix[2].trim() };
  const suffix = text.match(/^(.+?)\s+(\d+)[xX]?$/);
  if (suffix) return { qty: parseInt(suffix[2]), name: suffix[1].trim() };
  return { qty: 1, name: text };
}

export async function getHistory(table = "product_history"): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("name")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const row of data) {
      const lower = row.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(row.name);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export async function saveToHistory(item: string, table = "product_history") {
  const normalized = item.trim();
  if (!normalized) return;
  await supabase.from(table).delete().ilike("name", normalized);
  await supabase.from(table).insert({ name: normalized });
}

export async function removeFromHistory(item: string, table = "product_history") {
  await supabase.from(table).delete().ilike("name", item.trim());
}

export async function updateInHistory(oldName: string, newName: string, table = "product_history") {
  const normalized = newName.trim();
  if (!normalized || normalized === oldName) return;
  await supabase.from(table).update({ name: normalized }).ilike("name", oldName.trim());
}
