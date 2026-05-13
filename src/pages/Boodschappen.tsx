import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type GroceryItem } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, X } from "lucide-react";

const HISTORY_KEY = "boodschappen_history";
const TWEAKWISE_URL =
  "https://gateway.tweakwisenavigator.com/navigation-search/ed681b01";

function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveToHistory(item: string) {
  const history = getHistory();
  const normalized = item.trim();
  if (!normalized) return;
  const updated = [
    normalized,
    ...history.filter((h) => h.toLowerCase() !== normalized.toLowerCase()),
  ].slice(0, 100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

function parseItem(raw: string): { name: string; qty: number } {
  const text = raw.trim();
  // "3x kaas" or "3 kaas"
  const prefix = text.match(/^(\d+)[xX]?\s+(.+)$/);
  if (prefix) return { qty: parseInt(prefix[1]), name: prefix[2].trim() };
  // "kaas 3x" or "kaas 3"
  const suffix = text.match(/^(.+?)\s+(\d+)[xX]?$/);
  if (suffix) return { qty: parseInt(suffix[2]), name: suffix[1].trim() };
  return { qty: 1, name: text };
}

type PriceResult = { unitPrice: number; foundTitle: string } | null;

async function searchHoogvliet(query: string): Promise<PriceResult> {
  try {
    const url = `${TWEAKWISE_URL}?tn_q=${encodeURIComponent(query)}&tn_ps=1&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.items?.[0];
    if (!item || item.price == null) return null;
    return { unitPrice: item.price as number, foundTitle: item.title as string };
  } catch {
    return null;
  }
}

async function fetchItems(): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from("groceries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export default function Boodschappen() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, PriceResult>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["groceries"],
    queryFn: fetchItems,
  });

  const addItem = useMutation({
    mutationFn: async (itemText: string) => {
      const { error } = await supabase
        .from("groceries")
        .insert({ text: itemText, done: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groceries"] });
      setSaveError(null);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groceries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groceries"] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const ids = items.map((i) => i.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("groceries").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groceries"] });
      setPrices({});
      setLoadingIds(new Set());
    },
  });

  useEffect(() => {
    const missing = items.filter((i) => !(i.id in prices) && !loadingIds.has(i.id));
    if (missing.length === 0) return;

    setLoadingIds((prev) => {
      const next = new Set(prev);
      missing.forEach((i) => next.add(i.id));
      return next;
    });

    Promise.all(
      missing.map(async (item) => {
        const { name } = parseItem(item.text);
        const result = await searchHoogvliet(name);
        return { id: item.id, result };
      })
    ).then((results) => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const { id, result } of results) next[id] = result;
        return next;
      });
      setLoadingIds((prev) => {
        const next = new Set(prev);
        results.forEach(({ id }) => next.delete(id));
        return next;
      });
    });
  }, [items]);

  function handleTextChange(value: string) {
    setText(value);
    const trimmed = value.trim();
    if (trimmed) {
      const history = getHistory();
      const matches = history
        .filter((h) => h.toLowerCase().startsWith(trimmed.toLowerCase()))
        .slice(0, 6);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function selectSuggestion(suggestion: string) {
    setText(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function add(itemText?: string) {
    const t = (itemText ?? text).trim();
    if (!t) return;
    addItem.mutate(t);
    saveToHistory(t);
    setText("");
    setShowSuggestions(false);
  }

  const hasPrices = items.some((i) => prices[i.id] != null);
  const total = items.reduce((sum, item) => {
    const p = prices[item.id];
    if (!p) return sum;
    const { qty } = parseItem(item.text);
    return sum + p.unitPrice * qty;
  }, 0);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Lijstje</p>
        <h1 className="font-serif text-4xl font-semibold mt-2">Boodschappen</h1>
        <p className="text-muted-foreground mt-2">
          {isLoading ? "…" : `${items.length} items`}
          {hasPrices && ` · totaal ±€${total.toFixed(2)}`}
        </p>
      </header>

      <div className="relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Bijv. 3x kaas, 1L melk, brood…"
              className="bg-card"
              autoComplete="off"
            />
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors border-b border-border/40 last:border-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            className="rounded-xl shrink-0"
            disabled={addItem.isPending}
          >
            {addItem.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="hidden sm:inline ml-1">Voeg toe</span>
          </Button>
        </form>
        {saveError && (
          <p className="mt-2 text-sm text-destructive">Kon niet opslaan: {saveError}</p>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => clearAll.mutate()}
            disabled={clearAll.isPending}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            {clearAll.isPending ? "Bezig…" : "Wis alles"}
          </button>
        </div>
      )}

      <section className="rounded-2xl bg-card border border-border/60 divide-y divide-border/50 overflow-hidden">
        {isLoading && (
          <div className="p-8 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <p className="p-8 text-center text-muted-foreground text-sm">
            Nog geen boodschappen — voeg er eentje toe ✨
          </p>
        )}
        {items.map((i) => (
          <ItemRow
            key={i.id}
            item={i}
            priceResult={prices[i.id]}
            loadingPrice={loadingIds.has(i.id)}
            onRemove={() => removeItem.mutate(i.id)}
          />
        ))}
      </section>
    </div>
  );
}

function ItemRow({
  item,
  priceResult,
  loadingPrice,
  onRemove,
}: {
  item: GroceryItem;
  priceResult?: PriceResult;
  loadingPrice: boolean;
  onRemove: () => void;
}) {
  const { qty } = parseItem(item.text);
  const lineTotal = priceResult ? priceResult.unitPrice * qty : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-4 active:bg-accent/50 cursor-pointer select-none group"
      onClick={onRemove}
    >
      <div className="h-5 w-5 rounded-full border-2 border-border flex-shrink-0 group-active:border-destructive transition-colors" />
      <div className="flex-1 min-w-0">
        <span className="text-base">{item.text}</span>
        {priceResult && (
          <p className="text-xs text-muted-foreground truncate">{priceResult.foundTitle}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {loadingPrice && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {lineTotal != null && (
          <span className="text-sm font-medium tabular-nums">€{lineTotal.toFixed(2)}</span>
        )}
        {priceResult === null && !loadingPrice && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <X className="h-4 w-4 text-muted-foreground/30 group-hover:text-destructive/60 transition-colors flex-shrink-0" />
    </div>
  );
}
