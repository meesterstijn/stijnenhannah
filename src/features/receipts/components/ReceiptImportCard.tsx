import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload,
  History,
  Loader2,
  AlertTriangle,
  PackageSearch,
  TrendingUp,
} from "lucide-react";
import {
  parseReceiptFileText,
  type ReceiptData,
  type ParseWarning,
} from "../lib/parseReceiptFile";
import { computeReceiptFingerprint } from "../lib/receiptFingerprint";
import {
  fetchReceiptHistory,
  findReceiptDuplicate,
  saveReceipt,
  type ReceiptDuplicateMatch,
} from "../lib/receiptsApi";
import {
  fetchUnmatchedReceiptItemCount,
  applyExactStoreAliasMatches,
} from "../lib/productMatching";
import { resolveReceiptStore } from "../lib/stores";
import { UnmatchedProductsSheet } from "./UnmatchedProductsSheet";
import { ReceiptAnalysisSheet } from "./ReceiptAnalysisSheet";

function formatCurrency(amount: number | null, currency: string) {
  if (amount === null) return "onbekend";
  try {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Preview = {
  data: ReceiptData;
  warnings: ParseWarning[];
  raw: unknown;
  fingerprint: string;
  duplicate: ReceiptDuplicateMatch | null;
};

// Eerste basis voor kassabon-import (zie opdracht "Boodschappen bijhouden").
// Bewust nog geen prijsinzichten/dashboards/productmatching — alleen
// betrouwbaar verzamelen: bestand kiezen -> client-side parsen/valideren
// (schema_version 1.0) -> duplicaatcheck -> preview met eventuele
// waarschuwingen -> expliciete bevestiging -> atomisch opslaan.
export function ReceiptImportCard() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["shopping_receipts", "history"],
    queryFn: fetchReceiptHistory,
    enabled: historyOpen,
  });

  const { data: unmatchedCount = 0 } = useQuery({
    queryKey: ["receipt_items", "unmatched", "count"],
    queryFn: fetchUnmatchedReceiptItemCount,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!preview) return;
      const receiptId = await saveReceipt(
        session?.user.id ?? null,
        preview.data,
        preview.fingerprint,
        preview.raw,
      );
      // Matching is een losse, best-effort tweede stap — een falende
      // store-resolutie/automatische match mag de al geslaagde import nooit
      // ongedaan maken, vandaar hier expliciet afgevangen i.p.v. de mutatie
      // te laten falen.
      try {
        await resolveReceiptStore(receiptId);
        await applyExactStoreAliasMatches(receiptId);
      } catch {
        // Stil negeren — de bon zelf is al veilig opgeslagen.
      }
    },
    onSuccess: () => {
      setPreview(null);
      setSuccessMsg("Kassabon geïmporteerd ✓");
      queryClient.invalidateQueries({ queryKey: ["shopping_receipts"] });
      queryClient.invalidateQueries({
        queryKey: ["receipt_items", "unmatched"],
      });
    },
    onError: (err: Error) => setError(`Importeren mislukt: ${err.message}`),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSuccessMsg(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Kies een .json-bestand.");
      return;
    }
    const text = await file.text();
    const result = parseReceiptFileText(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const fingerprint = computeReceiptFingerprint(result.data);
    let duplicate: ReceiptDuplicateMatch | null = null;
    try {
      duplicate = await findReceiptDuplicate(fingerprint);
    } catch {
      // Duplicaatcheck is puur een hint — als die zelf faalt, blokkeert dat
      // het importeren niet.
    }
    setPreview({
      data: result.data,
      warnings: result.warnings,
      raw: result.raw,
      fingerprint,
      duplicate,
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Bewaar kassabonnen en bouw inzicht op in prijzen en weekboodschappen.
      </p>

      {/* Drie gelijkwaardige outline-tegels i.p.v. knoppen met verschillend
          gewicht — zo blijft elke knoptekst ondubbelzinnig los van de
          actieve boodschappenlijst, zonder dat de ene actie zwaarder oogt
          dan de andere. */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border border-border/70 bg-white hover:bg-muted/30 transition-colors p-3.5 flex flex-col items-start gap-2 text-left"
        >
          <Upload className="h-4 w-4 text-foreground" strokeWidth={1.8} />
          <span>
            <span className="block text-sm font-semibold text-foreground leading-tight">
              Kassabon JSON uploaden
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5 leading-tight">
              Importeer gegevens van een kassabon
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAnalysisOpen(true)}
          className="rounded-xl border border-border/70 bg-white hover:bg-muted/30 transition-colors p-3.5 flex flex-col items-start gap-2 text-left"
        >
          <TrendingUp className="h-4 w-4 text-foreground" strokeWidth={1.8} />
          <span>
            <span className="block text-sm font-semibold text-foreground leading-tight">
              Analyse
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5 leading-tight">
              Uitgaven en prijzen
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="rounded-xl border border-border/70 bg-white hover:bg-muted/30 transition-colors p-3.5 flex flex-col items-start gap-2 text-left"
        >
          <History className="h-4 w-4 text-foreground" strokeWidth={1.8} />
          <span>
            <span className="block text-sm font-semibold text-foreground leading-tight">
              Importgeschiedenis
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5 leading-tight">
              Bekijk opgeslagen kassabonnen
            </span>
          </span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {unmatchedCount > 0 && (
        <button
          type="button"
          onClick={() => setUnmatchedOpen(true)}
          className="w-full rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors p-3 flex items-center gap-2 text-left text-sm text-amber-800"
        >
          <PackageSearch className="h-4 w-4 shrink-0" />
          Onbekende producten · {unmatchedCount}
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {successMsg && <p className="text-sm text-foreground">{successMsg}</p>}

      {/* Preview + expliciete bevestiging vóór opslaan */}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kassabon importeren?</DialogTitle>
            <DialogDescription>
              Controleer de gegevens voordat je importeert.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Winkel</dt>
                <dd className="font-medium">{preview.data.store_name}</dd>
                {preview.data.branch_name && (
                  <>
                    <dt className="text-muted-foreground">Filiaal</dt>
                    <dd className="font-medium">{preview.data.branch_name}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Datum</dt>
                <dd className="font-medium">
                  {formatDate(preview.data.purchase_date)}
                  {preview.data.purchase_time
                    ? ` · ${preview.data.purchase_time}`
                    : ""}
                </dd>
                <dt className="text-muted-foreground">Totaalbedrag</dt>
                <dd className="font-medium">
                  {formatCurrency(
                    preview.data.total_paid,
                    preview.data.currency,
                  )}
                </dd>
                <dt className="text-muted-foreground">Aantal regels</dt>
                <dd className="font-medium">{preview.data.items.length}</dd>
              </dl>

              {preview.duplicate && (
                <p className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  Deze kassabon lijkt al eerder geïmporteerd (zelfde winkel,
                  datum en totaal). Je kunt 'm alsnog importeren als het toch om
                  een andere aankoop gaat.
                </p>
              )}

              {preview.warnings.length > 0 && (
                <ul className="space-y-1.5">
                  {preview.warnings.map((w) => (
                    <li
                      key={w.code}
                      className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-2.5"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreview(null)}
              disabled={saveMutation.isPending}
            >
              Annuleer
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-2 bg-foreground text-background hover:bg-foreground/90 shadow-none"
            >
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Importeren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importgeschiedenis: platte lijst, bewust geen dashboard/analyse */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importgeschiedenis</DialogTitle>
            <DialogDescription>
              Eerder geïmporteerde kassabonnen.
            </DialogDescription>
          </DialogHeader>
          {historyLoading && (
            <div className="py-6 flex justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!historyLoading && history.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nog geen kassabonnen geïmporteerd.
            </p>
          )}
          {!historyLoading && history.length > 0 && (
            <ul className="divide-y divide-border/50 max-h-80 overflow-y-auto -mx-6 px-6">
              {history.map((r) => (
                <li
                  key={r.id}
                  className="py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.store}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.purchase_date)} · {r.item_count}{" "}
                      {r.item_count === 1 ? "regel" : "regels"}
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0">
                    {formatCurrency(r.total, r.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <UnmatchedProductsSheet
        open={unmatchedOpen}
        onOpenChange={setUnmatchedOpen}
      />
      <ReceiptAnalysisSheet
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
      />
    </div>
  );
}
