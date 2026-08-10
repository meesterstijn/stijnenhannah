import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { fetchReceiptDetail, type ReceiptDetailItem } from "../lib/receiptsApi";
import { EditReceiptItemMatchDialog } from "./EditReceiptItemMatchDialog";
import {
  formatCurrencyAmount,
  formatDateLong,
  formatVariantLabel,
} from "../lib/formatters";

function moneyOrUnknown(amount: number | null, currency: string): string {
  if (amount === null) return "onbekend";
  return formatCurrencyAmount(amount, currency);
}

function ReceiptDetailItemRow({
  item,
  currency,
  onEdit,
}: {
  item: ReceiptDetailItem;
  currency: string;
  onEdit: (receiptItemId: string) => void;
}) {
  const isProductLine = item.line_type === "product";
  const isMatched = isProductLine && item.product_id !== null;
  const hasQuantityOrWeight = item.quantity !== null || item.weight !== null;

  return (
    <li className={`px-3 py-2.5 ${isProductLine ? "" : "opacity-70"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground break-words">
          {item.raw_name}
        </span>
        <span className="text-sm font-medium text-foreground shrink-0">
          {moneyOrUnknown(item.paid_line_total, currency)}
        </span>
      </div>
      {item.raw_brand && (
        <p className="text-xs text-muted-foreground break-words">
          {item.raw_brand}
        </p>
      )}
      {hasQuantityOrWeight && (
        <p className="text-xs text-muted-foreground">
          {item.quantity !== null ? `${item.quantity}x` : ""}
          {item.quantity !== null && item.weight !== null ? " · " : ""}
          {item.weight !== null
            ? `${item.weight} ${item.weight_unit ?? ""}`.trim()
            : ""}
        </p>
      )}

      {isProductLine && (
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="min-w-0">
            {isMatched ? (
              <>
                <p className="text-sm text-foreground truncate">
                  {item.product_name}
                </p>
                {item.variant && (
                  <p className="text-xs text-muted-foreground break-words">
                    {formatVariantLabel(item.variant, item.variant.store_name)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Niet gekoppeld</p>
            )}
          </div>
          {isMatched && (
            <button
              type="button"
              onClick={() => onEdit(item.id)}
              className="shrink-0 px-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Bewerken
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// Importgeschiedenis-detail v1 — geopend vanuit de bestaande Importgeschie-
// denis-lijst in ReceiptImportCard. Toont ALLE oorspronkelijke bonregels
// (ook unmatched/discount/deposit), leest bewust NIET uit receipt_item_
// prices (zie fetchReceiptDetail in receiptsApi.ts). Bewerken van een reeds
// gekoppelde productregel hergebruikt exact de bestaande
// EditReceiptItemMatchDialog — deze component implementeert zelf geen
// enkele match-/alias-/validatielogica.
//
// Sheet (niet Dialog) gekozen omdat een bon tientallen regels kan hebben —
// zelfde "grote, scrollbare mobile-first container"-patroon als
// ProductDetailSheet/ReceiptAnalysisSheet. Nesting Dialog(Importgeschiedenis)
// -> Sheet(dit) -> Dialog(EditReceiptItemMatchDialog) is dezelfde,
// al meermaals herbruikte onafhankelijke-Radix-Root-stapeling.
export function ReceiptDetailSheet({
  receiptId,
  open,
  onOpenChange,
}: {
  receiptId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [editingReceiptItemId, setEditingReceiptItemId] = useState<
    string | null
  >(null);

  const detailQuery = useQuery({
    queryKey: ["shopping_receipts", "detail", receiptId],
    queryFn: () => fetchReceiptDetail(receiptId as string),
    enabled: open && !!receiptId,
  });
  const receipt = detailQuery.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Kassabon</SheetTitle>
          <SheetDescription>
            Oorspronkelijke bonregels — bondata blijft hier altijd onaangepast.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {detailQuery.isLoading && (
            <div className="py-10 flex justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!detailQuery.isLoading && detailQuery.isError && (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-destructive">
                Kassabon laden is mislukt.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => detailQuery.refetch()}
              >
                Opnieuw proberen
              </Button>
            </div>
          )}

          {receipt && (
            <>
              <div className="rounded-xl border border-border/70 bg-white p-3">
                <p className="text-sm font-medium text-foreground">
                  {receipt.store_name ?? "Onbekende winkel"}
                  {receipt.branch_name ? ` · ${receipt.branch_name}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDateLong(receipt.purchase_date)}
                  {receipt.purchase_time
                    ? ` · ${receipt.purchase_time.slice(0, 5)}`
                    : ""}
                </p>
                <p className="text-sm font-medium text-foreground mt-1">
                  {moneyOrUnknown(receipt.total_paid, receipt.currency)}
                </p>
              </div>

              {receipt.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Geen kassabonregels gevonden.
                </p>
              ) : (
                <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-white">
                  {receipt.items.map((item) => (
                    <ReceiptDetailItemRow
                      key={item.id}
                      item={item}
                      currency={receipt.currency}
                      onEdit={setEditingReceiptItemId}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </SheetContent>

      <EditReceiptItemMatchDialog
        receiptItemId={editingReceiptItemId}
        open={editingReceiptItemId !== null}
        onOpenChange={(next) => {
          if (!next) setEditingReceiptItemId(null);
        }}
      />
    </Sheet>
  );
}
