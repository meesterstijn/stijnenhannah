import type { GameNightPlayer } from "@/lib/supabase";

// Grote fysieke spelerfiches om een winnaar aan te tikken (sectie 15/39) —
// bewust groter dan de selectiefiches van "Wie schuiven er aan?" omdat dit
// tijdens het spelen zelf gebruikt wordt en het tikken zo min mogelijk mag
// vertragen/mismatchen. Eén tik = direct `onPick`, geen selecteren-en-
// bevestigen.
export function WinnerPickerGrid({
  players,
  onPick,
  disabled,
}: {
  players: GameNightPlayer[];
  onPick: (playerId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="gn-player-grid">
      {players.map((player) => (
        <button
          key={player.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(player.id)}
          className="gn-player-chip gn-player-chip-lg"
        >
          <span
            className="gn-player-avatar gn-player-avatar-lg"
            style={player.color ? { background: player.color } : undefined}
          >
            {player.name.charAt(0).toUpperCase()}
          </span>
          <span className="gn-player-name uppercase">{player.name}</span>
        </button>
      ))}
    </div>
  );
}
