import { Martini } from "lucide-react";
import { getCocktailPhotoUrl } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import type {
  CocktailFull,
  CocktailOrder,
  CocktailVariantFull,
} from "@/features/cocktail-bar/types";

export function CocktailBigScreenReady({
  order,
  cocktail,
  variant,
}: {
  order: CocktailOrder;
  cocktail: CocktailFull | undefined;
  variant: CocktailVariantFull | undefined;
}) {
  const photoPath =
    variant?.photo_storage_path ?? cocktail?.photo_storage_path ?? null;
  const photoUrl = photoPath ? getCocktailPhotoUrl(photoPath) : null;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="cb-bigscreen-enter relative flex h-56 w-56 shrink-0 items-center justify-center sm:h-64 sm:w-64">
        <div className="cb-product-glow absolute inset-4 rounded-full blur-3xl" />
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={cocktail?.name ?? ""}
            className="relative h-full w-full object-contain"
          />
        ) : (
          <Martini
            className="relative h-24 w-24 text-[var(--cb-gold)] opacity-50"
            strokeWidth={1.2}
          />
        )}
      </div>

      <div className="cb-bigscreen-enter cb-bigscreen-enter-delay-1 space-y-2">
        <h1 className="cb-heading font-serif text-5xl sm:text-7xl">
          Klaar voor {order.guest_name}
        </h1>
        <p className="cb-muted text-xl sm:text-2xl">
          {cocktail?.name ?? "Cocktail"}
        </p>
      </div>
    </div>
  );
}
