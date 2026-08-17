import { X } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";

// Fysieke spelersfiche (sectie 19) — geen checkboxlijst: tikken selecteert/
// deselecteert, geselecteerd krijgt een messing highlight + lichte
// optil-animatie (zie .gn-player-chip-selected in styles.css). Het kleine
// kruisje archiveert de speler (sectie 26: nooit hard-delete) — bewust een
// aparte knop i.p.v. long-press/swipe, zodat er geen twijfel is over welke
// tik selecteert en welke archiveert.
export function PlayerChip({
  player,
  selected,
  onToggle,
  onArchive,
}: {
  player: GameNightPlayer;
  selected: boolean;
  onToggle: () => void;
  onArchive?: () => void;
}) {
  return (
    <div
      className={`gn-player-chip relative ${selected ? "gn-player-chip-selected" : ""}`}
    >
      {onArchive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (
              window.confirm(
                `${player.name} archiveren? Deze speler verdwijnt uit de selectielijst, maar bestaande resultaten blijven bewaard.`,
              )
            ) {
              onArchive();
            }
          }}
          aria-label={`${player.name} archiveren`}
          className="gn-player-chip-archive"
        >
          <X className="h-2.5 w-2.5" strokeWidth={2.5} />
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className="flex w-full flex-col items-center gap-0.5"
      >
        <span
          className="gn-player-avatar"
          style={player.color ? { background: player.color } : undefined}
        >
          {player.name.charAt(0).toUpperCase()}
        </span>
        <span className="gn-player-name">{player.name}</span>
      </button>
    </div>
  );
}
