import { useState } from "react";
import { Loader2, Martini } from "lucide-react";
import { insertOrder } from "@/features/cocktail-bar/lib/orders";

// Ingebed in CocktailDetailDialog wanneer mode="guest" (zie CocktailDetailDialog.tsx).
// Na een succesvolle bestelling toont dit component kort zelf de bevestiging
// en sluit daarna automatisch het venster via onOrdered — de gast hoeft niet
// zelf op het kruisje te klikken.
const AUTO_CLOSE_DELAY_MS = 1500;

export function CocktailOrderForm({
  cocktailId,
  variantId,
  cocktailName,
  onOrdered,
}: {
  cocktailId: string;
  variantId: string;
  cocktailName: string;
  onOrdered: () => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ordered, setOrdered] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) {
      setError("Vul je naam in.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await insertOrder({
        cocktailId,
        variantId,
        guestName,
        note: note.trim() || null,
      });
      setOrdered(true);
      setTimeout(onOrdered, AUTO_CLOSE_DELAY_MS);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Bestellen mislukt. Probeer het opnieuw.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (ordered) {
    return (
      <div className="cb-tile flex flex-col items-center gap-2 p-6 text-center">
        <Martini className="h-8 w-8 text-[var(--cb-gold)]" />
        <p className="cb-heading font-serif text-xl">Bedankt, {guestName}!</p>
        <p className="cb-muted text-sm">Je {cocktailName} wordt zo gemaakt.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Jouw naam
        </label>
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Bijv. Sanne"
          className="w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Notitie (optioneel)
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="bijv. extra munt graag"
          className="w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="cb-button flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Martini className="h-4 w-4" />
        )}
        Bestellen
      </button>
    </form>
  );
}
