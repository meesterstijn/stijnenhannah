import { tileColorClasses } from "@/features/rainbow-six-siege/lib/actionColors";
import type { R6ScoreRule } from "@/features/rainbow-six-siege/types";

// Grote, duimvriendelijke tegels — één tik registreert direct, zonder
// bevestiging of formulier (zie redesignfilosofie: "binnen één seconde").
export function R6PlayerActionTiles({
  quickActions,
  onTap,
  disabled,
}: {
  quickActions: R6ScoreRule[];
  onTap: (rule: R6ScoreRule) => void;
  disabled?: boolean;
}) {
  if (quickActions.length === 0) {
    return <p className="text-xs text-zinc-500">Geen actietegels ingesteld.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {quickActions.map((rule) => (
        <button
          key={rule.id}
          type="button"
          disabled={disabled}
          onClick={() => onTap(rule)}
          className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${tileColorClasses(rule.color)}`}
        >
          <span className="text-2xl leading-none">{rule.icon ?? "•"}</span>
          <span className="text-xs font-semibold leading-tight">{rule.name}</span>
          <span className="text-[10px] leading-none opacity-80">{rule.points >= 0 ? `+${rule.points}` : rule.points}</span>
        </button>
      ))}
    </div>
  );
}
