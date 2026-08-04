import { BookOpen, Martini } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCocktailPhotoUrl } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import type {
  Cocktail,
  CocktailHighlight,
} from "@/features/cocktail-bar/types";

// Het "spiekscherm" voor de owner — toont MEER dan het Big Screen straks
// zal doen (het volledige verhaal als leesbare tekst, zie plan §5), zodat de
// owner dit kan voorlezen terwijl alleen een korte introductie op het Big
// Screen zelf verschijnt (fase 8).
export function CocktailHighlightPresenterView({
  highlight,
  cocktail,
  isActiveOnBigScreen,
  onClose,
  onShow,
  onHide,
  onMarkDone,
}: {
  highlight: CocktailHighlight | null;
  cocktail: Cocktail | undefined;
  isActiveOnBigScreen: boolean;
  onClose: () => void;
  onShow: () => void;
  onHide: () => void;
  onMarkDone: () => void;
}) {
  const photoUrl = cocktail?.photo_storage_path
    ? getCocktailPhotoUrl(cocktail.photo_storage_path)
    : null;

  return (
    <Dialog open={!!highlight} onOpenChange={(open) => !open && onClose()}>
      {highlight && (
        <DialogContent className="cocktail-theme cb-dialog w-full max-w-2xl max-h-[90vh] sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle asChild>
              <h2 className="cb-heading font-serif text-3xl">
                {highlight.title}
              </h2>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl">
                <div className="cb-product-glow absolute inset-1 rounded-full blur-lg" />
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={cocktail?.name ?? ""}
                    className="relative h-full w-full object-contain"
                  />
                ) : (
                  <Martini
                    className="relative h-10 w-10 text-[var(--cb-gold)] opacity-50"
                    strokeWidth={1.2}
                  />
                )}
              </div>
              <div>
                <p className="cb-heading font-serif text-xl">
                  {highlight.guest_name}
                </p>
                <p className="cb-muted text-sm">
                  {cocktail?.name ?? "Geen cocktail gekoppeld"}
                </p>
                {highlight.subtitle && (
                  <p className="cb-muted text-sm italic">
                    {highlight.subtitle}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="cb-heading mb-2 flex items-center gap-2 text-lg">
                <BookOpen className="h-4 w-4" /> Verhaal
              </h3>
              <p className="text-base leading-relaxed whitespace-pre-line">
                {highlight.story}
              </p>
            </div>

            {isActiveOnBigScreen && (
              <span className="cb-badge inline-flex">
                Nu actief op Big Screen
              </span>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {isActiveOnBigScreen ? (
                <button
                  type="button"
                  onClick={onHide}
                  className="cb-button-ghost rounded-full px-4 py-2 text-sm"
                >
                  Verberg van Big Screen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onShow}
                  className="cb-button rounded-full px-4 py-2 text-sm"
                >
                  Toon op Big Screen
                </button>
              )}
              <button
                type="button"
                onClick={onMarkDone}
                className="cb-button-ghost rounded-full px-4 py-2 text-sm"
              >
                Markeer als afgerond
              </button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
