import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  buildAllProductsSummary,
  type ItemPriceRow,
} from "../lib/receiptAnalysis";
import { formatComparisonPrice } from "../lib/formatters";

// Alle productprijzen v1 — volledige, doorzoekbare, alfabetische lijst van
// canonieke producten, als aanvulling op de compacte "Recente
// productprijzen" op ReceiptAnalysisSheet (die bewust recent-gesorteerd en
// beperkt blijft). Werkt op EXACT dezelfde al opgehaalde itemPrices-dataset
// (geen eigen query, geen N+1) — dedupliceert op product_id via
// buildAllProductsSummary (geen tweede prijsberekening).
//
// Opent GEEN eigen productdetail: een klik roept onSelectProduct aan, wat de
// ouder (ReceiptAnalysisSheet) dezelfde, al bestaande ProductDetailSheet-
// state laat zetten — er is dus maar één ProductDetailSheet-instantie in de
// hele boom, hier alleen een tweede ingang naar toe.
export function AllProductPricesSheet({
  open,
  onOpenChange,
  itemPrices,
  onSelectProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemPrices: ItemPriceRow[];
  onSelectProduct: (productId: string, productName: string) => void;
}) {
  const [search, setSearch] = useState("");

  const allProducts = useMemo(
    () => buildAllProductsSummary(itemPrices),
    [itemPrices],
  );

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return allProducts;
    return allProducts.filter((p) =>
      p.productName.toLowerCase().includes(normalized),
    );
  }, [allProducts, search]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Alle productprijzen</SheetTitle>
          <SheetDescription>
            Alle canonieke producten waarvoor prijswaarnemingen beschikbaar
            zijn.
          </SheetDescription>
        </SheetHeader>

        <div className="sticky top-0 z-10 bg-background pt-4 pb-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek product..."
          />
        </div>

        {filteredProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {allProducts.length === 0
              ? "Nog geen producten met prijswaarnemingen."
              : "Geen producten gevonden."}
          </p>
        ) : (
          <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-white">
            {filteredProducts.map((p) => (
              <li key={p.productId}>
                <button
                  type="button"
                  onClick={() => onSelectProduct(p.productId, p.productName)}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground break-words">
                    {p.productName}
                  </p>
                  <p className="text-xs text-muted-foreground break-words mt-0.5">
                    {p.latestObservation
                      ? `${formatComparisonPrice(
                          p.latestObservation.comparison_paid_price,
                          p.latestObservation.comparison_price_unit,
                        )} · ${p.latestObservation.store_name ?? "Onbekende winkel"}`
                      : "Geen vergelijkprijs"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
