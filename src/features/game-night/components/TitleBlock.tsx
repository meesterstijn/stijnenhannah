// Centrale titel (section 7) — Cinzel voor het grote opschrift, dicht bij
// de referentie (klassieke, licht vintage kapitalen), Inter voor de
// subtekst/tagline zodat die uitstekend leesbaar blijft.
export function TitleBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <h1 className="gn-display text-3xl font-semibold tracking-wide sm:text-4xl lg:text-5xl">
        GAME NIGHT
      </h1>
      <p
        className="mt-2 text-base font-medium sm:text-lg"
        style={{ color: "var(--gn-brass)" }}
      >
        Vanavond wordt er gespeeld.
      </p>
      <p className="gn-muted mx-auto mt-2 max-w-sm text-xs italic leading-relaxed sm:text-sm">
        Wie wint is belangrijk.
        <br />
        Wie daar de komende zes maanden over blijft praten helaas ook.
      </p>
    </div>
  );
}
