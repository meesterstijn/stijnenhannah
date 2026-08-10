import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  COMPARISON_UNIT_LABELS as UNIT_LABELS,
  fetchProductCatalog,
} from "../lib/productMatching";
import { ProductCatalogDetailSheet } from "./ProductCatalogDetailSheet";

// Productcatalogus v1 — centraal overzicht van canonieke producten, als
// beheerplek naast de bestaande "Automatische herkenning". Geen "nieuw
// product/nieuwe variant"-actie: creatie blijft via de bestaande matching-/
// editflows lopen, dit is uitsluitend beheer van wat al bestaat.
export function ProductCatalogSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );

  const catalogQuery = useQuery({
    queryKey: ["product_catalog", "all"],
    queryFn: fetchProductCatalog,
    enabled: open,
  });

  const sorted = useMemo(() => {
    return [...(catalogQuery.data ?? [])].sort((a, b) =>
      a.canonical_name.localeCompare(b.canonical_name, "nl"),
    );
  }, [catalogQuery.data]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return sorted;
    return sorted.filter(
      (p) =>
        p.canonical_name.toLowerCase().includes(normalized) ||
        (p.category_name?.toLowerCase().includes(normalized) ?? false),
    );
  }, [sorted, search]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Productcatalogus</SheetTitle>
          <SheetDescription>
            Canonieke producten en hun varianten beheren.
          </SheetDescription>
        </SheetHeader>

        <div className="sticky top-0 z-10 bg-background pt-4 pb-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek product..."
          />
        </div>

        {catalogQuery.isLoading && (
          <div className="py-10 flex justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!catalogQuery.isLoading && catalogQuery.isError && (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-destructive">
              Productcatalogus laden is mislukt.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => catalogQuery.refetch()}
            >
              Opnieuw proberen
            </Button>
          </div>
        )}

        {!catalogQuery.isLoading && !catalogQuery.isError && (
          <>
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nog geen producten.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Geen producten gevonden.
              </p>
            ) : (
              <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-white">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedProductId(p.id)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground break-words">
                        {p.canonical_name}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {UNIT_LABELS[p.comparison_unit]}
                        {p.category_name ? ` · ${p.category_name}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.variantCount}{" "}
                        {p.variantCount === 1 ? "variant" : "varianten"} ·{" "}
                        {p.receiptItemCount}{" "}
                        {p.receiptItemCount === 1 ? "aankoop" : "aankopen"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </SheetContent>

      <ProductCatalogDetailSheet
        productId={selectedProductId}
        open={selectedProductId !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedProductId(null);
        }}
      />
    </Sheet>
  );
}
