import { Dices } from "lucide-react";
import { R6_CHAOS_ROUNDS } from "@/features/rainbow-six-siege/data/content";

export function R6ChallengePreview() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center gap-2">
        <Dices className="h-4 w-4 text-amber-400" strokeWidth={1.75} />
        <p className="font-serif text-lg font-semibold text-zinc-100">Chaos-rondes</p>
      </div>
      <p className="-mt-2 text-sm text-zinc-400">Nog geen random generator — voorlopig een vaste voorbeeldlijst.</p>
      <div className="flex flex-wrap gap-2">
        {R6_CHAOS_ROUNDS.map((round) => (
          <span
            key={round}
            className="rounded-full border border-zinc-700 bg-zinc-950/50 px-3 py-1 text-xs text-zinc-300"
          >
            {round}
          </span>
        ))}
      </div>
    </div>
  );
}
