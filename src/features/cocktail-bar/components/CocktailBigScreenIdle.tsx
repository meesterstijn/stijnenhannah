import { CocktailParallaxBackground } from "@/features/cocktail-bar/components/CocktailParallaxBackground";

// scrollY is altijd 0 — dit is een kiosk-scherm zonder scroll, de "levende"
// achtergrond komt hier volledig uit de ambient CSS-animaties in
// CocktailParallaxBackground (rook/lichtreflecties/stofdeeltjes/golven), niet
// uit scroll-parallax.
export function CocktailBigScreenIdle() {
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden text-center">
      <CocktailParallaxBackground scrollY={0} />
      <div className="cb-bigscreen-enter relative z-10 space-y-4">
        <h1 className="cb-heading font-serif text-6xl sm:text-8xl">
          Cocktail Bar
        </h1>
        <p className="cb-muted text-lg sm:text-2xl">
          Handcrafted for the evening.
        </p>
      </div>
    </div>
  );
}
