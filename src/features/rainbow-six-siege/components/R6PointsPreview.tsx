import { R6_POINT_RULES, type R6PointRule } from "@/features/rainbow-six-siege/data/content";

const TONE_CLASSES: Record<R6PointRule["tone"], string> = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  negative: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  gold: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

export function R6PointsPreview() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div>
        <p className="font-serif text-lg font-semibold text-zinc-100">Voorbeeld puntensysteem</p>
        <p className="mt-1 text-sm text-zinc-400">Nog statisch — geen database of berekeningen.</p>
      </div>
      <ul className="space-y-2">
        {R6_POINT_RULES.map((rule) => (
          <li
            key={rule.label}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2"
          >
            <span className="text-sm text-zinc-300">{rule.label}</span>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[rule.tone]}`}
            >
              {rule.points}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
