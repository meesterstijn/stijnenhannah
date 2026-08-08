import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  fetchUnmatchedReceiptItems,
  applyExactStoreAliasMatches,
  type UnmatchedReceiptItem,
} from "../lib/productMatching";
import { createStore, linkReceiptToStore } from "../lib/stores";
import { MatchReceiptItemDialog } from "./MatchReceiptItemDialog";

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Eén banner per nog-niet-gekoppelde winkel (op basis van raw_store_name) —
// generiek, geen enkele winkelnaam is hardcoded. Maakt de winkel pas aan na
// een expliciete klik, nooit automatisch (zie ontwerpprincipe).
function UnresolvedStoreBanner({
  storeName,
  receiptIds,
}: {
  storeName: string;
  receiptIds: string[];
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const store = await createStore(storeName);
      await Promise.all(
        receiptIds.map((id) => linkReceiptToStore(id, store.id)),
      );
      await Promise.all(
        receiptIds.map((id) => applyExactStoreAliasMatches(id).catch(() => 0)),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["receipt_items", "unmatched"],
      });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Winkel "{storeName}" nog niet gekoppeld.
      </span>
      <Button
        type="button"
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="gap-1.5 shrink-0"
      >
        {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Winkel aanmaken
      </Button>
    </div>
  );
}

function UnmatchedItemRow({ item }: { item: UnmatchedReceiptItem }) {
  const [matchOpen, setMatchOpen] = useState(false);
  return (
    <li className="py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium truncate">{item.raw_name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {item.receipt_store_name ?? "Onbekende winkel"} ·{" "}
          {formatDate(item.purchase_date)}
          {item.quantity ? ` · ${item.quantity}x` : ""}
          {item.weight ? ` · ${item.weight} ${item.weight_unit ?? ""}` : ""}
          {item.paid_line_total !== null
            ? ` · €${item.paid_line_total.toFixed(2)}`
            : ""}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setMatchOpen(true)}
        className="shrink-0"
      >
        Koppelen
      </Button>
      {matchOpen && (
        <MatchReceiptItemDialog
          item={item}
          open={matchOpen}
          onOpenChange={setMatchOpen}
        />
      )}
    </li>
  );
}

// Minimale reviewlijst voor productregels die nog niet betrouwbaar gekoppeld
// zijn (matching_status unmatched/needs_review) — nooit discount/deposit/
// service_or_other, die hebben geen productidentiteit om te koppelen.
export function UnmatchedProductsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["receipt_items", "unmatched"],
    queryFn: fetchUnmatchedReceiptItems,
    enabled: open,
  });

  const unresolvedStores = new Map<string, string[]>();
  for (const item of items) {
    if (!item.receipt_store_id && item.receipt_store_name) {
      const existing = unresolvedStores.get(item.receipt_store_name) ?? [];
      if (!existing.includes(item.receipt_id)) existing.push(item.receipt_id);
      unresolvedStores.set(item.receipt_store_name, existing);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Onbekende producten</SheetTitle>
          <SheetDescription>
            Koppel kassabonregels aan een product zodat ze meetellen in
            toekomstige prijsanalyses.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {Array.from(unresolvedStores.entries()).map(
            ([storeName, receiptIds]) => (
              <UnresolvedStoreBanner
                key={storeName}
                storeName={storeName}
                receiptIds={receiptIds}
              />
            ),
          )}

          {isLoading && (
            <div className="py-6 flex justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Geen onbekende producten meer.
            </p>
          )}
          {!isLoading && items.length > 0 && (
            <ul className="divide-y divide-border/50">
              {items.map((item) => (
                <UnmatchedItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
