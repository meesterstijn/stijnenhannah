import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import type { GameNightGame, GameNightPlayer } from "@/lib/supabase";
import { useStartGameSession } from "@/features/game-night/hooks/useGameSession";
import { PlayerChip } from "@/features/game-night/components/PlayerChip";

// "Wie spelen mee?" (sectie 5) — overlay boven de Spellenkast, geen aparte
// pagina. Standaard alle aanwezige Game Night-spelers geselecteerd
// (aanwezig ≠ automatisch deelnemer aan elk spel, dus deselecteren moet
// kunnen). Zelfde fysieke fichetaal als "Wie schuiven er aan?"
// (PlayerChip), geen checkboxformulier.
export function GameParticipantSheet({
  game,
  attendees,
  gameNightSessionId,
  onClose,
}: {
  game: GameNightGame;
  attendees: GameNightPlayer[];
  gameNightSessionId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const startSession = useStartGameSession();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(attendees.map((p) => p.id)),
  );
  const [error, setError] = useState<string | null>(null);

  function toggle(playerId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  const count = selectedIds.size;
  const tooFew = game.min_players != null && count < game.min_players;
  const tooMany = game.max_players != null && count > game.max_players;
  const canStart = count > 0 && !tooFew && !tooMany;

  let helperText: string | null = null;
  if (tooFew)
    helperText = `Dit spel heeft minimaal ${game.min_players} spelers nodig`;
  else if (tooMany)
    helperText = `Dit spel ondersteunt maximaal ${game.max_players} spelers`;

  async function handleStart() {
    setError(null);
    try {
      await startSession.mutateAsync({
        gameNightSessionId,
        gameId: game.id,
        playerIds: [...selectedIds],
      });
      navigate("/game-night");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Starten mislukt");
    }
  }

  return (
    <div className="gn-sheet-backdrop" role="dialog" aria-modal="true">
      <div className="gn-sheet-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="gn-eyebrow">{game.name}</p>
            <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
              Wie spelen mee?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="gn-topnav-icon-btn"
            aria-label="Sluiten"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="gn-player-grid-scroll mt-3">
          <div className="gn-player-grid">
            {attendees.map((player) => (
              <PlayerChip
                key={player.id}
                player={player}
                selected={selectedIds.has(player.id)}
                onToggle={() => toggle(player.id)}
              />
            ))}
          </div>
        </div>

        {(helperText || error) && (
          <p className="gn-faint mt-2 text-center text-xs">
            {error ?? helperText}
          </p>
        )}

        <button
          type="button"
          disabled={!canStart || startSession.isPending}
          onClick={handleStart}
          className="gn-plaque-action gn-plaque-action-primary mt-3 w-full px-6 py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="gn-display text-lg font-semibold tracking-wide">
            {startSession.isPending ? "Bezig..." : `Start ${game.name}`}
          </span>
        </button>
      </div>
    </div>
  );
}
