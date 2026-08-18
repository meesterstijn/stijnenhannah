import { useState } from "react";
import { X } from "lucide-react";
import type {
  GameDifficulty,
  GameNightGame,
  GameResultMode,
} from "@/lib/supabase";
import {
  useUpdateGameFlowConfig,
  useUpdateGameInfo,
  type GameFlowConfig,
  type GameInfo,
} from "@/features/game-night/hooks/useGameNightGames";
import { GAME_TAGS, gameTagLabel } from "@/features/game-night/lib/gameTags";

const RESULT_MODE_LABELS: Record<GameResultMode, string> = {
  winner: "Winnaar",
  score: "Punten",
  ranking: "Ranglijst",
  team: "Teams",
  coop: "Coöperatief",
};

const DIFFICULTY_SELECT_OPTIONS: {
  value: GameDifficulty | "";
  label: string;
}[] = [
  { value: "", label: "Niet ingesteld" },
  { value: "licht", label: "Licht" },
  { value: "gemiddeld", label: "Gemiddeld" },
  { value: "zwaar", label: "Zwaar" },
];

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="gn-faint text-[11px] uppercase tracking-wide">
        {label}
      </span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? null : Math.max(0, Number(raw)));
        }}
        className="w-full px-3 py-2 text-sm"
      />
    </label>
  );
}

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

// "Spelverloop"-instellingen (Spellenkast-correctie, sectie 3-8/32), nu
// uitgebreid met "Spelinfo" (Game Night V4, sectie 25) — nog steeds GEEN
// algemeen "spel bewerken"-formulier (naam/cover blijven niet bewerkbaar
// hier); Spelinfo voegt alleen bewerk-UI toe voor kolommen die al bestonden
// (min/max spelers, duur, moeilijkheid, tags) maar nog geen UI hadden.
export function GameFlowSettingsSheet({
  game,
  onClose,
}: {
  game: GameNightGame;
  onClose: () => void;
}) {
  const updateConfig = useUpdateGameFlowConfig();
  const updateInfo = useUpdateGameInfo();
  const [config, setConfig] = useState<GameFlowConfig>({
    uses_rounds: game.uses_rounds,
    track_round_results: game.track_round_results,
    has_session_winner: game.has_session_winner,
    result_mode: game.result_mode,
  });
  const [info, setInfo] = useState<GameInfo>({
    min_players: game.min_players,
    max_players: game.max_players,
    duration_minutes: game.duration_minutes,
    difficulty: game.difficulty,
    tags: game.tags,
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

  function toggleTag(tag: string) {
    setInfo((i) => ({
      ...i,
      tags: i.tags.includes(tag)
        ? i.tags.filter((t) => t !== tag)
        : [...i.tags, tag],
    }));
  }

  async function handleSave() {
    await Promise.all([
      updateConfig.mutateAsync({ gameId: game.id, config }),
      updateInfo.mutateAsync({ gameId: game.id, info }),
    ]);
    onClose();
  }

  const saving = updateConfig.isPending || updateInfo.isPending;

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

          <div
            className="border-t pt-4"
            style={{ borderColor: "var(--gn-border)" }}
          >
            <p className="gn-eyebrow mb-3">Spelinfo</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Min. spelers"
                value={info.min_players}
                onChange={(v) => setInfo((i) => ({ ...i, min_players: v }))}
              />
              <NumberField
                label="Max. spelers"
                value={info.max_players}
                onChange={(v) => setInfo((i) => ({ ...i, max_players: v }))}
              />
            </div>

            <div className="mt-3">
              <NumberField
                label="Gemiddelde duur (minuten)"
                value={info.duration_minutes}
                onChange={(v) =>
                  setInfo((i) => ({ ...i, duration_minutes: v }))
                }
              />
            </div>

            <div className="mt-3">
              <p className="gn-faint text-[11px] uppercase tracking-wide">
                Moeilijkheid
              </p>
              <select
                value={info.difficulty ?? ""}
                onChange={(e) =>
                  setInfo((i) => ({
                    ...i,
                    difficulty: (e.target.value ||
                      null) as GameDifficulty | null,
                  }))
                }
                className="mt-1.5 w-full px-3 py-2 text-sm"
              >
                {DIFFICULTY_SELECT_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <p className="gn-faint mb-1.5 text-[11px] uppercase tracking-wide">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {GAME_TAGS.map((tag) => {
                  const selected = info.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`gn-choice-chip ${selected ? "gn-choice-chip-selected" : ""}`}
                      style={{ minHeight: 36, padding: "0 0.75rem" }}
                    >
                      {gameTagLabel(tag)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="gn-plaque-action gn-plaque-action-primary mt-5 w-full px-6 py-3.5"
        >
          <span className="gn-display text-lg font-semibold tracking-wide">
            {saving ? "Bezig..." : "Opslaan"}
          </span>
        </button>
      </div>
    </div>
  );
}
