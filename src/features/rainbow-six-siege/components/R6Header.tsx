import { Link } from "react-router-dom";
import { ArrowLeft, Crosshair } from "lucide-react";

// Compacte titelkaart i.p.v. een grote hero-tegel — het terugnavigeren naar
// de site-homepage gaat voortaan via de zwevende "Ons Huisje"-knop (zie
// site-layout.tsx, die op alle Rainbow Six-pagina's de normale navbalk
// vervangt), dus `backTo` is hier optioneel en wordt alleen getoond als een
// pagina een écht ander terugdoel heeft dan de homepage (bv. de sessiepagina
// die terug wil naar het LAN-overzicht, niet naar home).
export function R6Header({
  title,
  subtitle,
  intro,
  backTo,
  backLabel = "Terug",
}: {
  title: string;
  subtitle: string;
  intro?: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-zinc-100">
      {backTo && (
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-amber-400">
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
          <Crosshair className="h-5 w-5 text-amber-400" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-lg font-semibold leading-tight sm:text-xl">{title}</h1>
          <p className="text-sm text-zinc-400">{subtitle}</p>
        </div>
      </div>

      {intro && <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">{intro}</p>}
    </div>
  );
}
