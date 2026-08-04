// Bewust puur de vlakke .cocktail-theme achtergrondkleur, zonder gouden
// strepen/bollen/gloed — de eigenaar wil dit scherm rustig en donker, geen
// CocktailParallaxBackground hier (dat blijft wel gebruikt in de hero op de
// Cocktails-overzichtpagina en de Tabletmodus).
export function CocktailBigScreenIdle() {
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden text-center">
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
