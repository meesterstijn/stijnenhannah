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
  fetchProductAliases,
  sortProductAliases,
  type ProductAlias,
} from "../lib/productMatching";
import { EditProductAliasDialog } from "./EditProductAliasDialog";
import { formatTimestampShort } from "../lib/formatters";

function matchesSearch(alias: ProductAlias, normalized: string): boolean {
  if (!normalized) return true;
  return (
    alias.raw_alias.toLowerCase().includes(normalized) ||
    alias.normalized_alias.toLowerCase().includes(normalized) ||
    alias.product_name.toLowerCase().includes(normalized) ||
    (alias.variant_name?.toLowerCase().includes(normalized) ?? false) ||
    (alias.store_name?.toLowerCase().includes(normalized) ?? false)
  );
}

// Aliasbeheer v2 ("Automatische herkenning") — beheert uitsluitend
// product_aliases (de herkenningsregel voor TOEKOMSTIGE kassabonnen), nooit
// shopping_receipt_items (wat historische aankopen daadwerkelijk waren).
// Geen "nieuwe alias"-actie: aliases ontstaan uitsluitend via de bestaande
// matchingflows (MatchReceiptItemDialog/EditReceiptItemMatchDialog).
export function AliasManagementSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);

  const aliasesQuery = useQuery({
    queryKey: ["product_aliases", "all"],
    queryFn: fetchProductAliases,
    enabled: open,
  });

  const sorted = useMemo(
    () => sortProductAliases(aliasesQuery.data ?? []),
    [aliasesQuery.data],
  );

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return sorted.filter((a) => matchesSearch(a, normalized));
  }, [sorted, search]);

  const editingAlias = sorted.find((a) => a.id === editingAliasId) ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Automatische herkenning</SheetTitle>
          <SheetDescription>
            Welke kassabonomschrijvingen automatisch aan welk product (en
            eventueel welke variant) worden gekoppeld.
          </SheetDescription>
        </SheetHeader>

        <div className="sticky top-0 z-10 bg-background pt-4 pb-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek alias of product..."
          />
        </div>

        {aliasesQuery.isLoading && (
          <div className="py-10 flex justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!aliasesQuery.isLoading && aliasesQuery.isError && (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-destructive">
              Automatische herkenning laden is mislukt.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => aliasesQuery.refetch()}
            >
              Opnieuw proberen
            </Button>
          </div>
        )}

        {!aliasesQuery.isLoading && !aliasesQuery.isError && (
          <>
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nog geen automatische herkenningsregels.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Geen resultaten voor deze zoekopdracht.
              </p>
            ) : (
              <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-white">
                {filtered.map((a) => (
                  <li key={a.id} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground break-words">
                          {a.raw_alias}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {a.store_name ?? "Onbekende winkel"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingAliasId(a.id)}
                        className="shrink-0 px-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Bewerken
                      </button>
                    </div>
                    <p className="text-sm text-foreground mt-1 break-words">
                      → {a.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">
                      → {a.variant_name ?? "Geen variant"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {a.usage_count} keer herkend
                      {a.last_used_at
                        ? ` · Laatst gebruikt ${formatTimestampShort(a.last_used_at)}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </SheetContent>

      <EditProductAliasDialog
        alias={editingAlias}
        open={editingAliasId !== null}
        onOpenChange={(next) => {
          if (!next) setEditingAliasId(null);
        }}
      />
    </Sheet>
  );
}
