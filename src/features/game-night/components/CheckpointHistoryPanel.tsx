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
        <p className="gnv2-dialog-title text-lg">Spelstanden</p>
        <button
          type="button"
          onClick={onClose}
          className="gnv2-icon-btn"
          aria-label="Sluiten"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="gnv2-dialog-scroll flex min-h-0 flex-1 flex-col gap-2">
        {checkpoints.length === 0 && (
          <p className="gnv2-dialog-faint text-center text-sm">
            Nog geen spelstanden opgeslagen.
          </p>
        )}
        {checkpoints.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className="gnv2-history-row"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{c.title}</p>
              <p className="gnv2-dialog-faint truncate text-xs">
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
