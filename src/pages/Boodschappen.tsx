import { useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type GroceryItem } from "@/lib/supabase";
import { parseItem, getHistory, saveToHistory } from "@/lib/history";
import {
  getCategories,
  getAssignments,
  fetchProductAssignmentCatalogLinks,
} from "@/lib/categories";
import {
  fetchItemPrices,
  buildLatestPaidPriceByProduct,
  buildBestValueStoreByProduct,
  type PaidPriceObservation,
  type GroceryBestStore,
} from "@/features/receipts/lib/receiptAnalysis";
import {
  formatGroceryPriceLine,
  formatGroceryBestStoreLine,
  buildGroceryEstimatedTotal,
  formatGroceryEstimatedTotalLine,
  formatGroceryEstimatedTotalCoverage,
} from "@/lib/groceryPriceContext";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CategoryManagerSheet } from "@/components/category-manager-sheet";
import { ReceiptImportCard } from "@/features/receipts/components/ReceiptImportCard";
import {
  Loader2,
  Trash2,
  X,
  Check,
  Tag,
  ChevronRight,
  Home as HomeIcon,
  SlidersHorizontal,
} from "lucide-react";

async function fetchItems(tableName: string): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

function GroceryList({
  tableName,
  title,
  historyTable = "product_history",
  showPriceContext,
  showEstimatedTotal = false,
}: {
  tableName: string;
  title?: string;
  historyTable?: string;
  showPriceContext: boolean;
  // Alleen voor "Mijn boodschappen" (V1) — Upfront is een aparte lijst en
  // mag niet stilletjes bij dit totaal worden opgeteld.
  showEstimatedTotal?: boolean;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  // Elke bon (Mijn boodschappen én Upfront) beheert zijn eigen
  // verwijdermodus, met de aan/uit-knop naast "Totaal (indicatie)" in de
  // eigen kopregel hieronder — geen gedeelde/opgetilde state nodig.
  const [deleteMode, setDeleteMode] = useState(false);
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

  // Boodschappenproduct -> canoniek product (product_assignments.
  // canonical_product_id, V1 gebouwd in de vorige stap) + de bestaande
  // kassabon-prijsanalyse (["receipt_item_prices","all"], exact dezelfde
  // querykey/helper als ReceiptAnalysisSheet — gedeelde cache, en elke
  // bestaande invalidatie van die key (matchcorrectie, comparison_unit-
  // wijziging, variant-editie) ververst deze prijscontext automatisch mee).
  // Beide zijn bulk-fetches, dus geen query per boodschappenregel.
  const { data: catalogLinks = [] } = useQuery({
    queryKey: ["product_assignment_catalog_links"],
    queryFn: fetchProductAssignmentCatalogLinks,
  });
  const { data: itemPrices = [] } = useQuery({
    queryKey: ["receipt_item_prices", "all"],
    queryFn: fetchItemPrices,
  });

  const canonicalProductIdByProduct = useMemo(
    () =>
      new Map(
        catalogLinks.map((link) => [link.product, link.canonicalProductId]),
      ),
    [catalogLinks],
  );
  const latestPaidPriceByProductId = useMemo(
    () => buildLatestPaidPriceByProduct(itemPrices),
    [itemPrices],
  );
  // Zelfde bron, hergebruikt de ProductDetail-winkelvergelijkingshelpers
  // (zie buildBestValueStoreByProduct in receiptAnalysis.ts) — geen tweede
  // vergelijkingsalgoritme, geen aparte query.
  const bestStoreByProductId = useMemo(
    () => buildBestValueStoreByProduct(itemPrices),
    [itemPrices],
  );

  // Geschatte boodschappenprijs v1 — uitsluitend actieve (done === false)
  // regels, exact dezelfde canonical-koppeling/latest-price-Map als de
  // prijsregel per product hierboven. Eén lineaire pass, geen aparte query.
  const activeItems = useMemo(() => items.filter((i) => !i.done), [items]);
  const estimatedTotal = useMemo(
    () =>
      buildGroceryEstimatedTotal(
        activeItems,
        canonicalProductIdByProduct,
        latestPaidPriceByProductId,
      ),
    [activeItems, canonicalProductIdByProduct, latestPaidPriceByProductId],
  );

  const grouped = useMemo(() => {
    const assigned = new Set<string>();
    const result: {
      catId: string | null;
      catName: string | null;
      items: GroceryItem[];
    }[] = [];

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

  const categoryOrder = useMemo(
    () => Object.fromEntries(categories.map((c, i) => [c.id, i])),
    [categories],
  );

  function sortByCategory(names: string[]): string[] {
    return [...names].sort((a, b) => {
      const catA = assignments[a.toLowerCase()];
      const catB = assignments[b.toLowerCase()];
      const orderA = catA !== undefined ? (categoryOrder[catA] ?? 999) : 999;
      const orderB = catB !== undefined ? (categoryOrder[catB] ?? 999) : 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, "nl");
    });
  }

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
      const { error } = await supabase
        .from(tableName)
        .update({ text })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [tableName] }),
  });

  // Tikken op een regel vinkt 'm af — hergebruikt de bestaande `done`-kolom
  // (al aanwezig op GroceryItem en al gelezen door Home.tsx voor de
  // "N nog te halen"-telling), dus geen nieuwe kolom/tabel nodig.
  const toggleDone = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from(tableName)
        .update({ done })
        .eq("id", id);
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
      setDeleteMode(false);
    },
  });

  function handleTextChange(value: string) {
    setText(value);
    const trimmed = value.trim();
    if (trimmed) {
      const matches = sortByCategory(
        historyItems.filter((h) =>
          h.toLowerCase().startsWith(trimmed.toLowerCase()),
        ),
      ).slice(0, 6);
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

  const heading = title ?? "Mijn boodschappen";
  const doneCount = items.filter((i) => i.done).length;
  const openCount = items.length - doneCount;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-foreground whitespace-nowrap">
            {heading}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? "item" : "items"} · {openCount} over · {doneCount} afgecheckt
          </p>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          {/* Groceries hebben geen prijsveld (dat bestaat alleen op
              geïmporteerde kassabonregels) — bewust geen verzonnen bedrag,
              zie opdracht §9. Placeholder i.p.v. het hele blok weglaten,
              zodat de kolom niet verspringt zodra hier ooit wél data komt. */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Totaal (indicatie)</p>
            <p className="text-sm text-muted-foreground/50 mt-1 tabular-nums">—</p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteMode((v) => !v)}
            aria-label={deleteMode ? "Verwijdermodus sluiten" : "Verwijdermodus aanzetten"}
            className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors shrink-0"
          >
            {deleteMode ? <X className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {deleteMode && (
        <div className="grid grid-cols-2 gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={clearAll.isPending}
                className="h-9 rounded-lg gap-2 text-destructive border-destructive/30 bg-white hover:bg-destructive/5"
              >
                {clearAll.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Hele lijst legen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Lijst leegmaken?</AlertDialogTitle>
                <AlertDialogDescription>
                  Weet je zeker dat je alle {items.length} boodschappen uit
                  deze lijst wilt verwijderen? Dit kan niet ongedaan worden
                  gemaakt.
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
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg gap-2 text-muted-foreground bg-white"
            onClick={() => setDeleteMode(false)}
          >
            <X className="h-4 w-4" />
            Prullenbak sluiten
          </Button>
        </div>
      )}

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
              onFocus={() =>
                suggestions.length > 0 && setShowSuggestions(true)
              }
              placeholder="Product toevoegen…"
              className="bg-white border-border/70"
              autoComplete="off"
            />
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-border bg-white shadow-lg overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
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
            variant="outline"
            className="rounded-lg shrink-0 bg-white"
            onClick={() => setManageOpen(true)}
            aria-label="Boodschappen en categorieën beheren"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </form>
        {saveError && (
          <p className="mt-2 text-sm text-destructive">
            Kon niet opslaan: {saveError}
          </p>
        )}
      </div>

      {showPriceContext &&
        showEstimatedTotal &&
        estimatedTotal.totalItemCount > 0 && (
          <div className="rounded-2xl border border-border/70 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Geschatte boodschappenprijs
            </p>
            {estimatedTotal.pricedItemCount === 0 ? (
              <>
                <p className="text-base font-semibold text-foreground mt-1">
                  Nog onvoldoende prijsgegevens
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Nog geen historische prijzen beschikbaar voor deze
                  boodschappen.
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">
                  {formatGroceryEstimatedTotalLine(estimatedTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gebaseerd op laatste aankopen
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatGroceryEstimatedTotalCoverage(estimatedTotal)}
                </p>
              </>
            )}
          </div>
        )}

      <div>
        {isLoading && (
          <div className="p-8 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <p className="py-8 text-center text-muted-foreground text-sm">
            Nog geen boodschappen — voeg er eentje toe ✨
          </p>
        )}
        {grouped.map((group, gi) => (
          <div key={group.catId ?? "none"}>
            {group.catName ? (
              <div
                className={`px-1 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide${gi > 0 ? " border-t border-border/40 mt-1" : ""}`}
              >
                {group.catName}
              </div>
            ) : gi > 0 ? (
              <div className="border-t border-border/40 mt-1 pt-1" />
            ) : null}
            <div className="divide-y divide-dashed divide-border/70">
              {group.items.map((i) => {
                const { name, qty } = parseItem(i.text);
                const canonicalProductId =
                  canonicalProductIdByProduct.get(name.toLowerCase()) ?? null;
                const priceObservation = canonicalProductId
                  ? latestPaidPriceByProductId.get(canonicalProductId)
                  : undefined;
                const bestStore = canonicalProductId
                  ? bestStoreByProductId.get(canonicalProductId)
                  : undefined;
                return (
                  <ItemRow
                    key={i.id}
                    item={i}
                    parsedName={name}
                    parsedQty={qty}
                    canonicalProductId={canonicalProductId}
                    priceObservation={priceObservation}
                    bestStore={bestStore}
                    showPriceContext={showPriceContext}
                    deleteMode={deleteMode}
                    onToggleDone={() =>
                      toggleDone.mutate({ id: i.id, done: !i.done })
                    }
                    onDelete={() => removeItem.mutate(i.id)}
                    onQtyChange={(newQty) => {
                      // Teller mag nooit meer verwijderen — minimum is 1,
                      // verwijderen kan uitsluitend nog via de prullenbak.
                      const clamped = Math.max(1, newQty);
                      if (clamped === qty) return;
                      const newText =
                        clamped === 1 ? name : `${clamped}x ${name}`;
                      updateItem.mutate({ id: i.id, text: newText });
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <CategoryManagerSheet
        open={manageOpen}
        onOpenChange={setManageOpen}
        historyTable={historyTable}
      />
    </div>
  );
}

export default function Boodschappen() {
  // Eén globale voorkeur voor beide lijsten (Mijn boodschappen + Upfront) —
  // puur presentatie, geen Supabase-veld nodig. Default AAN, zie opdracht.
  const [showPriceContext, setShowPriceContext] = useLocalStorage(
    "grocery-show-price-context",
    true,
  );

  return (
    // .shopping-page: scope-root voor de kassabon-herstijling van deze
    // pagina (zie styles.css) — andere pagina's gebruiken deze klasse niet
    // en blijven dus volledig onaangeroerd.
    <div className="shopping-page max-w-[700px] mx-auto space-y-6">
      {/* De gedeelde navbalk is uit voor deze route (zie site-layout.tsx,
          isBoodschappen) — deze "Ons Huisje"-terugknop staat op de plek waar
          de paginatitel stond en is de enige manier terug naar de homepage
          op deze pagina. */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <HomeIcon className="h-4 w-4" strokeWidth={1.8} />
        Ons Huisje
      </Link>

      <div className="rounded-2xl border border-border/70 bg-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Prijsinformatie</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Toon historische prijzen en winkelvergelijking
          </p>
        </div>
        <Switch
          checked={showPriceContext}
          onCheckedChange={setShowPriceContext}
          aria-label="Prijsinformatie tonen"
          className="shrink-0"
        />
      </div>

      <div>
        <div className="receipt-zigzag receipt-zigzag--top" aria-hidden />
        <div className="bg-white px-4 sm:px-5 py-5">
          <GroceryList
            tableName="groceries"
            showPriceContext={showPriceContext}
            showEstimatedTotal
          />
        </div>
        <div className="receipt-zigzag receipt-zigzag--bottom" aria-hidden />
      </div>

      <div className="rounded-2xl border border-border/70 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Bijhouden &amp; uploaden
        </p>
        <ReceiptImportCard />
      </div>

      <SupermarktLinks />

      <div className="rounded-2xl border border-border/70 bg-white p-5">
        <GroceryList
          tableName="groceries_upfront"
          title="Upfront"
          historyTable="product_history_upfront"
          showPriceContext={showPriceContext}
        />
      </div>
    </div>
  );
}

const SUPERMARKTEN = [
  { name: "Hoogvliet", url: "https://www.hoogvliet.com/aanbiedingen" },
  { name: "Albert Heijn", url: "https://www.ah.nl/bonus" },
  { name: "Jumbo", url: "https://www.jumbo.com/aanbiedingen" },
  { name: "Lidl", url: "https://www.lidl.nl/aanbiedingen" },
  { name: "Upfront foodstore", url: "https://upfront.nl/collections/foodstore" },
];

function SupermarktLinks() {
  return (
    <div className="rounded-2xl border border-border/70 bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg border border-border/70 flex items-center justify-center shrink-0 text-muted-foreground">
          <Tag className="h-4 w-4" strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Folder aanbiedingen
          </p>
          <p className="text-sm text-foreground mt-0.5">Bekijk actuele aanbiedingen</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SUPERMARKTEN.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
          >
            <span className="truncate">{s.name}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  parsedName,
  parsedQty,
  canonicalProductId,
  priceObservation,
  bestStore,
  showPriceContext,
  deleteMode,
  onToggleDone,
  onDelete,
  onQtyChange,
}: {
  item: GroceryItem;
  parsedName: string;
  parsedQty: number;
  // null = geen betrouwbare cataloguskoppeling -> geen prijsregel tonen.
  canonicalProductId: string | null;
  priceObservation: PaidPriceObservation | undefined;
  // undefined = geen minimaal 2 winkels met geldige recente vergelijkprijs.
  bestStore: GroceryBestStore | undefined;
  showPriceContext: boolean;
  deleteMode: boolean;
  onToggleDone: () => void;
  onDelete: () => void;
  onQtyChange: (qty: number) => void;
}) {
  return (
    <div
      onClick={deleteMode ? undefined : onToggleDone}
      className={`receipt-row flex items-center gap-3 py-3 select-none ${
        deleteMode ? "cursor-default" : "cursor-pointer hover:bg-muted/30"
      } ${item.done ? "opacity-70" : ""}`}
    >
      <span
        className={`flex items-center justify-center h-5 w-5 rounded-full border shrink-0 transition-colors ${
          item.done ? "bg-foreground border-foreground" : "border-border"
        }`}
        aria-hidden
      >
        {item.done && <Check className="h-3 w-3 text-background" strokeWidth={3} />}
      </span>

      <div className="flex-1 min-w-0">
        <span
          className={`text-[15px] ${
            item.done ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {parsedName}
        </span>
        {/* Puur secundaire context uit de bestaande kassabon-prijsanalyse —
            geen eigen click handler, dus tikken hier vinkt de regel gewoon
            af/door via de onClick op de buitenste row hierboven. Alleen
            zichtbaar bij een betrouwbare canonieke koppeling (V1: nooit een
            gegokte prijs op naam) én zolang de "Prijsinformatie"-toggle aan
            staat. */}
        {canonicalProductId && showPriceContext && (
          <>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {formatGroceryPriceLine(priceObservation)}
            </p>
            {bestStore && (
              <p className="text-xs text-muted-foreground/70">
                {formatGroceryBestStoreLine(bestStore)}
              </p>
            )}
          </>
        )}
      </div>

      <div
        className="flex items-center gap-1 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQtyChange(parsedQty - 1);
          }}
          disabled={parsedQty <= 1}
          className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:border-border transition-colors text-sm font-medium"
          aria-label="Minder"
        >
          −
        </button>
        <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">
          {parsedQty}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQtyChange(parsedQty + 1);
          }}
          className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors text-sm font-medium"
          aria-label="Meer"
        >
          +
        </button>
        {deleteMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
            aria-label={`${parsedName} verwijderen`}
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>
    </div>
  );
}
