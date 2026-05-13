import { supabase } from "./supabase";

export function parseItem(raw: string): { name: string; qty: number } {
  const text = raw.trim();
  const prefix = text.match(/^(\d+)[xX]?\s+(.+)$/);
  if (prefix) return { qty: parseInt(prefix[1]), name: prefix[2].trim() };
  const suffix = text.match(/^(.+?)\s+(\d+)[xX]?$/);
  if (suffix) return { qty: parseInt(suffix[2]), name: suffix[1].trim() };
  return { qty: 1, name: text };
}

export async function getHistory(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("product_history")
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

export async function saveToHistory(item: string) {
  const normalized = item.trim();
  if (!normalized) return;
  await supabase.from("product_history").delete().ilike("name", normalized);
  await supabase.from("product_history").insert({ name: normalized });
}

export async function removeFromHistory(item: string) {
  await supabase.from("product_history").delete().ilike("name", item.trim());
}
