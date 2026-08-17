import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import {
  usePlayers,
  useCreatePlayer,
  useArchivePlayer,
} from "@/features/game-night/hooks/usePlayers";
import { PlayerChip } from "@/features/game-night/components/PlayerChip";

// Minimaal aantal spelers voordat "TAFEL IS COMPLEET" beschikbaar wordt
// (sectie 21 laat dit bewust aan implementatiekeuze over) — 2, want een
// Game Night is per definitie iets dat je met meerdere mensen speelt.
const MIN_PLAYERS = 2;

// Stap 1 van de Start Game Night-flow (sectie 19-21): vervangt de twee
// actieplaquettes binnen hetzelfde .gn-board-element (geen aparte pagina).
// Bij veel spelers scrollt alleen het fichegrid intern — de tabletop zelf
// blijft vast (sectie 32).
export function PlayerSelectionBoard({
  selectedIds,
  onToggle,
  onComplete,
  starting,
}: {
  selectedIds: Set<string>;
  onToggle: (playerId: string) => void;
  onComplete: (players: GameNightPlayer[]) => void;
  starting: boolean;
}) {
  const { data: players = [] } = usePlayers();
  const createPlayer = useCreatePlayer();
  const archivePlayer = useArchivePlayer();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingName, setAddingName] = useState("");

  const selectedPlayers = players.filter((p) => selectedIds.has(p.id));
  const canComplete = selectedPlayers.length >= MIN_PLAYERS && !starting;

  async function handleAddPlayer(e: FormEvent) {
    e.preventDefault();
    const name = addingName.trim();
    if (!name || createPlayer.isPending) return;
    const player = await createPlayer.mutateAsync({ name });
    onToggle(player.id);
    setAddingName("");
    setShowAddForm(false);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-3">
      <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
        WIE SCHUIVEN ER AAN?
      </p>

      <div className="gn-player-grid-scroll">
        <div className="gn-player-grid">
          {players.map((player) => (
            <PlayerChip
              key={player.id}
              player={player}
              selected={selectedIds.has(player.id)}
              onToggle={() => onToggle(player.id)}
              onArchive={() => archivePlayer.mutate(player.id)}
            />
          ))}

          {showAddForm ? (
            <form
              onSubmit={handleAddPlayer}
              className="gn-player-chip gn-player-chip-form"
            >
              <input
                autoFocus
                value={addingName}
                onChange={(e) => setAddingName(e.target.value)}
                onBlur={() => {
                  if (!addingName.trim()) setShowAddForm(false);
                }}
                placeholder="Naam"
                maxLength={40}
                className="w-full bg-transparent text-center text-sm outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="gn-player-chip gn-player-chip-new"
            >
              <Plus className="h-4 w-4" strokeWidth={1.8} />
              <span className="gn-player-name">Nieuwe speler</span>
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={!canComplete}
        onClick={() => onComplete(selectedPlayers)}
        className="gn-plaque-action gn-plaque-action-primary w-full max-w-xs px-6 py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="gn-display text-lg font-semibold tracking-wide">
          {starting ? "Bezig..." : "Tafel is compleet"}
        </span>
        <span className="gn-muted mt-1 text-xs">
          {selectedPlayers.length < MIN_PLAYERS
            ? `Nog minimaal ${MIN_PLAYERS - selectedPlayers.length} speler${MIN_PLAYERS - selectedPlayers.length === 1 ? "" : "s"} nodig`
            : `${selectedPlayers.length} spelers geselecteerd`}
        </span>
      </button>
    </div>
  );
}
