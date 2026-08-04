import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  createHighlight,
  updateHighlight,
} from "@/features/cocktail-bar/lib/highlights";
import type {
  Cocktail,
  CocktailHighlight,
  CocktailOrder,
} from "@/features/cocktail-bar/types";

// prefill (vanuit de "Highlight"-knop op de Bereiden-wachtrij) en
// existingHighlight (bewerken) zijn mutually exclusive startpunten voor
// hetzelfde lege formulier — nooit beide gelijktijdig gebruikt.
export function CocktailHighlightForm({
  existingHighlight,
  prefill,
  cocktails,
  orders,
  onSaved,
  onCancel,
}: {
  existingHighlight: CocktailHighlight | null;
  prefill?: { guestName: string; cocktailId: string; orderId: string } | null;
  cocktails: Cocktail[];
  orders: CocktailOrder[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [guestName, setGuestName] = useState(
    existingHighlight?.guest_name ?? prefill?.guestName ?? "",
  );
  const [cocktailId, setCocktailId] = useState(
    existingHighlight?.cocktail_id ?? prefill?.cocktailId ?? "",
  );
  const [orderId, setOrderId] = useState(
    existingHighlight?.order_id ?? prefill?.orderId ?? "",
  );
  const [title, setTitle] = useState(existingHighlight?.title ?? "");
  const [subtitle, setSubtitle] = useState(existingHighlight?.subtitle ?? "");
  const [story, setStory] = useState(existingHighlight?.story ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    String(existingHighlight?.display_order ?? 0),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    guestName.trim().length > 0 &&
    title.trim().length > 0 &&
    story.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      const input = {
        guestName,
        cocktailId: cocktailId || null,
        orderId: orderId || null,
        title,
        subtitle: subtitle || null,
        story,
        displayOrder: Number(displayOrder) || 0,
      };
      if (existingHighlight) {
        await updateHighlight(existingHighlight.id, input);
      } else {
        await createHighlight(input);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Opslaan mislukt. Probeer het opnieuw.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cb-tile space-y-4 p-6">
      <h2 className="cb-heading font-serif text-2xl">
        {existingHighlight ? "Presentatie bewerken" : "Nieuwe presentatie"}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="cb-muted text-xs uppercase tracking-wide">
            Gastnaam
          </label>
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="bijv. Sanne"
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="cb-muted text-xs uppercase tracking-wide">
            Cocktail (optioneel)
          </label>
          <select
            value={cocktailId}
            onChange={(e) => setCocktailId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Geen cocktail gekoppeld</option>
            {cocktails.map((cocktail) => (
              <option key={cocktail.id} value={cocktail.id}>
                {cocktail.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Titel
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="bijv. Voor de avonturier"
          className="w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Subtitel (optioneel)
        </label>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Verhaal
        </label>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={6}
          placeholder="Wat maakt deze cocktail bijzonder voor deze gast..."
          className="w-full resize-none rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="cb-muted text-xs uppercase tracking-wide">
            Koppel aan bestelling (optioneel)
          </label>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Geen bestelling gekoppeld</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.guest_name} —{" "}
                {new Date(order.created_at).toLocaleTimeString("nl-NL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="cb-muted text-xs uppercase tracking-wide">
            Volgorde
          </label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="cb-button-ghost rounded-full px-4 py-2 text-sm"
        >
          Annuleren
        </button>
        <button
          type="submit"
          disabled={!canSave || isSaving}
          className="cb-button flex items-center gap-2 rounded-full px-5 py-2 text-sm disabled:opacity-40"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Opslaan
        </button>
      </div>
    </form>
  );
}
