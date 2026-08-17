import { X } from "lucide-react";
import type { GameNightCheckpoint } from "@/lib/supabase";

// "SPELSTANDEN" (sectie 31) — compacte lijst van alle checkpoints van deze
// spelsessie, niet alleen de laatste.
export function CheckpointHistoryPanel({
  checkpoints,
  onSelect,
  onClose,
}: {
  checkpoints: GameNightCheckpoint[];
  onSelect: (checkpointId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="gn-display text-lg font-semibold tracking-wide">
          Spelstanden
        </p>
        <button
          type="button"
          onClick={onClose}
          className="gn-topnav-icon-btn"
          aria-label="Sluiten"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="gn-checkpoint-scroll flex min-h-0 flex-1 flex-col gap-2">
        {checkpoints.length === 0 && (
          <p className="gn-faint text-center text-sm">
            Nog geen spelstanden opgeslagen.
          </p>
        )}
        {checkpoints.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className="gn-plaque-mini min-h-[52px] px-3.5 py-3 text-left"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{c.title}</p>
              <p className="gn-faint truncate text-xs">
                {new Date(c.created_at).toLocaleString("nl-NL", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
