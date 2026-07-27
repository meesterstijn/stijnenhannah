import { Link } from "react-router-dom";
import { ArrowLeft, Crosshair } from "lucide-react";

export function R6Header({
  title,
  subtitle,
  intro,
  backTo = "/",
  backLabel = "Terug naar home",
}: {
  title: string;
  subtitle: string;
  intro?: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 p-6 sm:p-8 text-zinc-100 shadow-sm">
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden="true"
      />
      <Link
        to={backTo}
        className="relative inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-amber-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <div className="relative mt-5 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <Crosshair className="h-6 w-6 text-amber-400" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-zinc-400 sm:text-base">{subtitle}</p>
        </div>
      </div>

      {intro && <p className="relative mt-5 max-w-2xl text-sm leading-relaxed text-zinc-300">{intro}</p>}
    </div>
  );
}
