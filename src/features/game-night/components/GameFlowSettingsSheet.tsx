import { useState } from "react";
import { X } from "lucide-react";
import type { GameNightGame, GameResultMode } from "@/lib/supabase";
import {
  useUpdateGameFlowConfig,
  type GameFlowConfig,
} from "@/features/game-night/hooks/useGameNightGames";

const RESULT_MODE_LABELS: Record<GameResultMode, string> = {
  winner: "Winnaar",
  score: "Punten",
  ranking: "Ranglijst",
  team: "Teams",
  coop: "Coöperatief",
};

function ToggleRow({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {help && <p className="gn-faint mt-0.5 text-xs">{help}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="gn-toggle"
      >
        <span className="gn-toggle-thumb" />
      </button>
    </div>
  );
}

// "Spelverloop"-instellingen (Spellenkast-correctie, sectie 3-8/32) — puur
// gedragsconfiguratie, geen databasetermen zichtbaar. Dit is bewust GEEN
// algemeen "spel bewerken"-formulier (naam/spelers/cover bestonden al niet
// als bewerkbare UI en zijn hier niet toegevoegd) — alleen het stuk dat
// deze opdracht vraagt.
export function GameFlowSettingsSheet({
  game,
  onClose,
}: {
  game: GameNightGame;
  onClose: () => void;
}) {
  const updateConfig = useUpdateGameFlowConfig();
  const [config, setConfig] = useState<GameFlowConfig>({
    uses_rounds: game.uses_rounds,
    track_round_results: game.track_round_results,
    has_session_winner: game.has_session_winner,
    result_mode: game.result_mode,
  });

  function handleUsesRoundsChange(next: boolean) {
    setConfig((c) => ({
      ...c,
      uses_rounds: next,
      // Sectie 4: uitschakelen van "Speelt met rondes" zet "Resultaat per
      // ronde" automatisch mee uit — voorkomt een onlogische opgeslagen
      // combinatie (track_round_results zonder uses_rounds).
      track_round_results: next ? c.track_round_results : false,
    }));
  }

  async function handleSave() {
    await updateConfig.mutateAsync({ gameId: game.id, config });
    onClose();
  }

  return (
    <div className="gn-sheet-backdrop" role="dialog" aria-modal="true">
      <div className="gn-sheet-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="gn-eyebrow">{game.name}</p>
            <p className="gn-display text-xl font-semibold tracking-wide">
              Spelverloop
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

        <div className="mt-4 flex flex-col gap-4">
          <ToggleRow
            label="Speelt met rondes"
            help="Gebruik dit voor spellen waarbij je binnen één speelsessie meerdere korte rondes achter elkaar speelt."
            checked={config.uses_rounds}
            onChange={handleUsesRoundsChange}
          />

          {config.uses_rounds && (
            <ToggleRow
              label="Resultaat per ronde bijhouden"
              help="Na iedere ronde kan de winnaar worden opgeslagen."
              checked={config.track_round_results}
              onChange={(v) =>
                setConfig((c) => ({ ...c, track_round_results: v }))
              }
            />
          )}

          <ToggleRow
            label="Eindresultaat van spel bijhouden"
            help="Gebruik dit als er naast losse rondes ook een winnaar/resultaat van de volledige speelsessie bestaat."
            checked={config.has_session_winner}
            onChange={(v) =>
              setConfig((c) => ({ ...c, has_session_winner: v }))
            }
          />

          <div>
            <p className="text-sm font-medium">Resultaat</p>
            <select
              value={config.result_mode}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  result_mode: e.target.value as GameResultMode,
                }))
              }
              className="mt-1.5 w-full px-3 py-2 text-sm"
            >
              {Object.entries(RESULT_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="gn-plaque-action gn-plaque-action-primary mt-5 w-full px-6 py-3.5"
        >
          <span className="gn-display text-lg font-semibold tracking-wide">
            {updateConfig.isPending ? "Bezig..." : "Opslaan"}
          </span>
        </button>
      </div>
    </div>
  );
}
