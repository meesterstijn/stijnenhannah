import { Link } from "react-router-dom";
import type { R6Feature } from "@/features/rainbow-six-siege/data/content";

const CARD_CLASSES =
  "group flex h-full cursor-pointer flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition-all hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-zinc-900";

function R6FeatureCardBody({ feature }: { feature: R6Feature }) {
  const Icon = feature.icon;
  return (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 transition-colors group-hover:bg-amber-500/20">
        <Icon className="h-5 w-5 text-amber-400" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg font-semibold leading-tight text-zinc-100">{feature.title}</p>
        <p className="mt-1 text-sm leading-snug text-zinc-400">{feature.description}</p>
      </div>
      <span className="inline-flex w-fit items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
        {feature.status}
      </span>
    </>
  );
}

export function R6FeatureCard({ feature }: { feature: R6Feature }) {
  if (feature.to) {
    return (
      <Link to={feature.to} className={CARD_CLASSES}>
        <R6FeatureCardBody feature={feature} />
      </Link>
    );
  }
  return (
    <div className={CARD_CLASSES}>
      <R6FeatureCardBody feature={feature} />
    </div>
  );
}
