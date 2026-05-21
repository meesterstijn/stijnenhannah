import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type GroceryItem } from "@/lib/supabase";
import { parseItem, getHistory, saveToHistory } from "@/lib/history";
import { getCategories, getAssignments } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { HistoryPicker } from "@/components/history-picker";
import { Plus, Loader2, Trash2 } from "lucide-react";

async function fetchItems(tableName: string): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

function GroceryList({ tableName, title, historyTable = "product_history" }: { tableName: string; title?: string; historyTable?: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: historyItems = [] } = useQuery({
    queryKey: [historyTable],
    queryFn: () => getHistory(historyTable),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: [tableName],
    queryFn: () => fetchItems(tableName),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories"],
    queryFn: getCategories,
  });

  const { data: assignments = {} } = useQuery({
    queryKey: ["product_assignments"],
    queryFn: getAssignments,
  });

  const grouped = useMemo(() => {
    const assigned = new Set<string>();
    const result: { catId: string | null; catName: string | null; items: GroceryItem[] }[] = [];

    for (const cat of categories) {
      const catItems = items.filter((i) => {
        const key = parseItem(i.text).name.toLowerCase();
        return assignments[key] === cat.id;
      });
      if (catItems.length > 0) {
        catItems.forEach((i) => assigned.add(i.id));
        result.push({ catId: cat.id, catName: cat.name, items: catItems });
      }
    }

    const unassigned = items.filter((i) => !assigned.has(i.id));
    if (unassigned.length > 0) {
      result.push({ catId: null, catName: null, items: unassigned });
    }

    return result;
  }, [items, categories, assignments]);

  const addItem = useMutation({
    mutationFn: async (itemText: string) => {
      const { error } = await supabase
        .from(tableName)
        .insert({ text: itemText, done: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      setSaveError(null);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [tableName] }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await supabase.from(tableName).update({ text }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [tableName] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const ids = items.map((i) => i.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from(tableName).delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
    },
  });

  function handleTextChange(value: string) {
    setText(value);
    const trimmed = value.trim();
    if (trimmed) {
      const matches = historyItems
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

  async function add(itemText?: string) {
    const t = (itemText ?? text).trim();
    if (!t) return;
    addItem.mutate(t);
    await saveToHistory(parseItem(t).name, historyTable);
    queryClient.invalidateQueries({ queryKey: [historyTable] });
    setText("");
    setShowSuggestions(false);
  }

  async function addFromHistory(names: string[]) {
    for (const name of names) {
      await supabase.from(tableName).insert({ text: name, done: false });
    }
    queryClient.invalidateQueries({ queryKey: [tableName] });
    setSheetOpen(false);
  }

  return (
    <div className="space-y-4">
      {title && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Boodschappen</p>
          <h2 className="font-serif text-2xl font-semibold mt-1">{title}</h2>
        </div>
      )}
      <div className="space-y-6">
        <div className="relative">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
            className="flex gap-2"
          >
            {items.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={clearAll.isPending}
                    className="rounded-xl shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                    aria-label="Wis alles"
                  >
                    {clearAll.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lijst leegmaken?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Alle {items.length} producten worden verwijderd. Dit kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleer</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearAll.mutate()}>
                      Verwijder alles
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder=""
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
              type="button"
              size="icon"
              className="rounded-md shrink-0"
              onClick={() => setSheetOpen(true)}
              aria-label="Kies uit geschiedenis"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          {saveError && (
            <p className="mt-2 text-sm text-destructive">Kon niet opslaan: {saveError}</p>
          )}
        </div>

        <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
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
          {grouped.map((group, gi) => (
            <div key={group.catId ?? "none"}>
              {group.catName ? (
                <div className={`px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30 border-b border-border/50${gi > 0 ? " border-t border-border/50" : ""}`}>
                  {group.catName}
                </div>
              ) : gi > 0 ? (
                <div className="border-t border-border/50" />
              ) : null}
              <div className="divide-y divide-border/50">
                {group.items.map((i) => {
                  const { name, qty } = parseItem(i.text);
                  return (
                    <ItemRow
                      key={i.id}
                      item={i}
                      parsedName={name}
                      parsedQty={qty}
                      onRemove={() => removeItem.mutate(i.id)}
                      onQtyChange={(newQty) => {
                        if (newQty <= 0) {
                          removeItem.mutate(i.id);
                        } else {
                          const newText = newQty === 1 ? name : `${newQty}x ${name}`;
                          updateItem.mutate({ id: i.id, text: newText });
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </section>
        <HistoryPicker
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onAdd={addFromHistory}
          historyTable={historyTable}
        />
      </div>
    </div>
  );
}

export default function Boodschappen() {
  return (
    <div>
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start flex flex-col gap-10 lg:flex-none lg:gap-0">
        <div className="space-y-10">
          <GroceryList tableName="groceries" />
          <div className="border-t border-border/40 pt-10">
            <GroceryList tableName="groceries_upfront" title="Upfront" historyTable="product_history_upfront" />
          </div>
        </div>
        <SupermarktLinks />
      </div>
    </div>
  );
}

const SUPERMARKTEN = [
  {
    name: "Hoogvliet",
    url: "https://www.hoogvliet.com/aanbiedingen",
    className: "bg-primary text-primary-foreground",
  },
  {
    name: "Albert Heijn",
    url: "https://www.ah.nl/bonus",
    className: "bg-accent text-accent-foreground",
  },
  {
    name: "Jumbo",
    url: "https://www.jumbo.com/aanbiedingen",
    className: "bg-secondary text-secondary-foreground",
  },
  {
    name: "Lidl",
    url: "https://www.lidl.nl/aanbiedingen",
    className: "bg-muted text-foreground",
  },
  {
    name: "Upfront foodstore",
    url: "https://upfront.nl/collections/foodstore",
    className: "bg-card border border-border text-foreground",
  },
];

function SupermarktLinks() {
  return (
    <aside className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Folder</p>
        <h2 className="font-serif text-2xl font-semibold mt-1">Aanbiedingen</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {SUPERMARKTEN.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${s.className} rounded-2xl p-5 flex flex-col justify-between min-h-[90px] font-semibold text-base hover:opacity-90 active:opacity-80 transition-opacity`}
          >
            <span>{s.name}</span>
            <span className="text-xs font-normal opacity-70 mt-2">Bekijk folder →</span>
          </a>
        ))}
      </div>
    </aside>
  );
}

function ItemRow({
  item,
  parsedName,
  parsedQty,
  onRemove,
  onQtyChange,
}: {
  item: GroceryItem;
  parsedName: string;
  parsedQty: number;
  onRemove: () => void;
  onQtyChange: (qty: number) => void;
}) {
  return (
    <div
      onClick={onRemove}
      className="flex items-stretch gap-2 px-4 select-none cursor-pointer hover:bg-accent/40 transition-colors"
    >
      <div className="flex-1 min-w-0 py-3">
        <span className="text-base">{parsedName}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 py-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => { e.stopPropagation(); onQtyChange(parsedQty - 1); }}
          className="self-stretch w-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors text-base font-medium"
          aria-label="Minder"
        >
          −
        </button>
        <span className="w-6 text-center text-sm tabular-nums">{parsedQty}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onQtyChange(parsedQty + 1); }}
          className="self-stretch w-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors text-base font-medium"
          aria-label="Meer"
        >
          +
        </button>
      </div>
    </div>
  );
}
