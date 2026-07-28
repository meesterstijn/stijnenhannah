import { useEffect, useRef, useState } from "react";
import { tileAccentBorderClass } from "@/features/rainbow-six-siege/lib/actionColors";
import type { R6ScoreRule } from "@/features/rainbow-six-siege/types";

// Grote, duimvriendelijke tegels — één tik registreert direct, zonder
// bevestiging of formulier (zie redesignfilosofie: "binnen één seconde").
//
// Tactisch/militair ontwerp (R6S-interface als inspiratie, geen kopie):
// uniforme, monochrome panelen i.p.v. een volledig gekleurde tegel per
// actie — de gekozen kleur (zie R6QuickActionSettings) is nu alleen nog
// een dunne linker accentrand, geen "vrolijke" achtergrondkleur. Het label
// is het grootste, dominante element; de puntenwaarde staat klein
// eronder. Bij een tik verschijnt kort (1s) een tactiele bevestiging
// ("HEADSHOT +1") direct op de tegel zelf — geen popup, geen modale
// onderbreking van de tik-flow.
const FLASH_DURATION_MS = 1000;

export function R6PlayerActionTiles({
  quickActions,
  onTap,
  disabled,
}: {
  quickActions: R6ScoreRule[];
  onTap: (rule: R6ScoreRule) => void;
  disabled?: boolean;
}) {
  const [flashRuleId, setFlashRuleId] = useState<string | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  if (quickActions.length === 0) {
    return <p className="text-xs text-zinc-500">Geen actietegels ingesteld.</p>;
  }

  function handleTap(rule: R6ScoreRule) {
    onTap(rule);
    setFlashRuleId(rule.id);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlashRuleId(null), FLASH_DURATION_MS);
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {quickActions.map((rule) => (
        <button
          key={rule.id}
          type="button"
          disabled={disabled}
          onClick={() => handleTap(rule)}
          className={`relative flex min-h-24 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border-y border-r border-zinc-700 bg-zinc-900 p-2 text-center text-zinc-200 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 border-l-[3px] ${tileAccentBorderClass(rule.color)}`}
        >
          <span className="text-sm font-semibold uppercase leading-tight tracking-wide">{rule.name}</span>
          <span className="flex items-center gap-1 text-[10px] leading-none text-zinc-500">
            {rule.icon && <span>{rule.icon}</span>}
            {rule.points >= 0 ? `+${rule.points}` : rule.points}
          </span>

          {flashRuleId === rule.id && (
            <span className="absolute inset-0 flex items-center justify-center bg-amber-500 px-1 text-xs font-bold uppercase tracking-wide text-zinc-950 transition-opacity duration-150">
              {rule.name} {rule.points >= 0 ? `+${rule.points}` : rule.points}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
