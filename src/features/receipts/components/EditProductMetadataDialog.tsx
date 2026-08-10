import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { getCategories } from "@/lib/categories";
import { fetchProducts, updateProductMetadata } from "../lib/productMatching";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Productnaam/categorie bewerken (Product- & variantbeheer v1) — wijzigt
// UITSLUITEND products.canonical_name/category_id. comparison_unit heeft
// zijn eigen bestaande ProductComparisonUnitDialog en wordt hier bewust niet
// gedupliceerd. Geen product merge: bestaat de doelnaam al (case-
// insensitief), dan wordt de rename geblokkeerd met een nette melding i.p.v.
// een rauwe Postgres-duplicate-key-fout.
export function EditProductMetadataDialog({
  productId,
  currentName,
  currentCategoryId,
  open,
  onOpenChange,
}: {
  productId: string;
  currentName: string;
  currentCategoryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(currentName);
  const [categoryId, setCategoryId] = useState(currentCategoryId ?? "");
  const [error, setError] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    enabled: open,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories"],
    queryFn: getCategories,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setName(currentName);
      setCategoryId(currentCategoryId ?? "");
      setError(null);
    }
  }, [open, currentName, currentCategoryId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Vul een productnaam in.");
      const normalized = trimmed.toLowerCase();
      const duplicate = products.find(
        (p) =>
          p.id !== productId &&
          p.canonical_name.trim().toLowerCase() === normalized,
      );
      if (duplicate) {
        throw new Error("Dit product bestaat al.");
      }
      await updateProductMetadata({
        productId,
        canonicalName: trimmed,
        categoryId: categoryId || null,
      });
    },
    onSuccess: () => {
      // canonical_name is de bron voor product_name in receipt_item_prices
      // (view-join) en voor de live productnaam in ReceiptDetailSheet/
      // AliasManagementSheet (eigen embeds) — dus alle vier invalideren,
      // geen "invalidate alles".
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["receipt_item_prices"] });
      queryClient.invalidateQueries({ queryKey: ["shopping_receipts"] });
      queryClient.invalidateQueries({ queryKey: ["product_aliases"] });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Productnaam en categorie bewerken</DialogTitle>
          <DialogDescription>
            Historische kassabonregels en automatische herkenning blijven via
            hun bestaande koppeling intact — alleen de weergegeven naam
            verandert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Productnaam</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Categorie</label>
            <select
              className={selectClassName}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Geen categorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuleer
          </Button>
          <Button
            type="button"
            onClick={() => {
              setError(null);
              saveMutation.mutate();
            }}
            disabled={saveMutation.isPending}
            className="gap-2"
          >
            {saveMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
