import type {
  GameNightColorPaletteEntry,
  GameNightPlayer,
} from "@/lib/supabase";
import {
  getPlayerDisplayName,
  getPlayerInitial,
  resolvePlayerColorHex,
} from "@/features/game-night/lib/playerIdentity";

// Game Night V2.6 (sectie 5) — compacte "wie speelt er vanavond"-context
// bovenaan Game Select. Bewust GEEN nieuwe spelerslobby: alleen kleine
// avatar+nickname-chips, party blijft uitsluitend gelezen (geen add/remove/
// reorder hier — dat is en blijft V2.5-lobby-only).
export function PartyContextStrip({
  players,
  palette,
}: {
  players: GameNightPlayer[];
  palette: GameNightColorPaletteEntry[];
}) {
  if (players.length === 0) return null;

  return (
    <div className="gnv2-party-strip" aria-label="Spelers vanavond">
      {players.map((player) => (
        <span key={player.id} className="gnv2-party-strip-chip">
          <span
            className="gnv2-avatar gnv2-avatar-xs"
            style={{
              ["--gnv2-ring" as string]:
                resolvePlayerColorHex(player, palette) ??
                "var(--gnv2-border-strong)",
            }}
          >
            {getPlayerInitial(player)}
          </span>
          {getPlayerDisplayName(player)}
        </span>
      ))}
    </div>
  );
}
