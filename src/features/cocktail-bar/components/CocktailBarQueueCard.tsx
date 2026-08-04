import { Clock, Sparkles, StickyNote } from "lucide-react";
import { getCocktailPhotoUrl } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import type {
  CocktailFull,
  CocktailOrder,
  CocktailVariantFull,
} from "@/features/cocktail-bar/types";

function formatOrderTime(createdAt: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(createdAt).getTime()) / 60000),
  );
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  return `${Math.round(minutes / 60)} uur geleden`;
}

// cocktail/variant zijn undefined zolang useCocktailShowcase() nog laadt, of
// (zeldzaam) als de bestelde cocktail inmiddels op concept staat — de kaart
// toont dan een neutrale placeholder i.p.v. te crashen, maar blijft verder
// gewoon werken (statusknoppen hebben de volledige cocktaildata niet nodig).
export function CocktailBarQueueCard({
  order,
  cocktail,
  variant,
  onSelect,
  onAdvance,
  onExtend,
  onDismiss,
  onCreateHighlight,
}: {
  order: CocktailOrder;
  cocktail: CocktailFull | undefined;
  variant: CocktailVariantFull | undefined;
  onSelect: () => void;
  onAdvance: (orderId: string) => void;
  onExtend: (orderId: string) => void;
  onDismiss: (orderId: string) => void;
  onCreateHighlight: (order: CocktailOrder) => void;
}) {
  const photoPath =
    variant?.photo_storage_path ?? cocktail?.photo_storage_path ?? null;
  const photoUrl = photoPath ? getCocktailPhotoUrl(photoPath) : null;
  const spiritLabel =
    variant?.variant_type === "alcohol_free"
      ? "Alcoholvrij"
      : (variant?.spirit?.name ?? null);

  return (
    <div className="cb-tile flex flex-col gap-3 p-4">
      <button
        type="button"
        onClick={onSelect}
        disabled={!cocktail}
        className="flex items-center gap-3 text-left disabled:cursor-default"
      >
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl">
          <div className="cb-product-glow absolute inset-1 rounded-full blur-lg" />
          {photoUrl && (
            <img
              src={photoUrl}
              alt={cocktail?.name ?? ""}
              className="relative h-full w-full object-contain"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="cb-heading font-serif text-lg leading-tight">
            {cocktail?.name ?? "Onbekende cocktail"}
          </p>
          {spiritLabel && (
            <span className="cb-badge mt-1 inline-flex">{spiritLabel}</span>
          )}
        </div>
      </button>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{order.guest_name}</span>
        <span className="cb-muted flex items-center gap-1 text-xs">
          <Clock className="h-3.5 w-3.5" /> {formatOrderTime(order.created_at)}
        </span>
      </div>

      {order.note && (
        <p className="cb-muted flex items-start gap-1.5 text-xs">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.note}
        </p>
      )}

      <div className="flex flex-col gap-1.5 pt-1">
        {order.status === "ready" && (
          <button
            type="button"
            onClick={() => onAdvance(order.id)}
            className="cb-button rounded-full py-1.5 text-sm"
          >
            Serveren
          </button>
        )}
        <div className="flex gap-1.5">
          {order.status === "ordered" && (
            <button
              type="button"
              onClick={() => onAdvance(order.id)}
              className="cb-button flex-1 rounded-full py-1.5 text-sm"
            >
              Begin bereiden
            </button>
          )}
          {order.status === "in_progress" && (
            <button
              type="button"
              onClick={() => onAdvance(order.id)}
              className="cb-button flex-1 rounded-full py-1.5 text-sm"
            >
              Klaar
            </button>
          )}
          {order.status === "ready" && (
            <>
              <button
                type="button"
                onClick={() => onExtend(order.id)}
                className="cb-button-ghost flex-1 rounded-full py-1.5 text-sm"
              >
                Verlengen
              </button>
              <button
                type="button"
                onClick={() => onDismiss(order.id)}
                className="cb-button-ghost flex-1 rounded-full py-1.5 text-sm"
              >
                Beëindigen
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onCreateHighlight(order)}
            aria-label={`Persoonlijke presentatie maken voor ${order.guest_name}`}
            className="cb-button-ghost rounded-full p-2"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
