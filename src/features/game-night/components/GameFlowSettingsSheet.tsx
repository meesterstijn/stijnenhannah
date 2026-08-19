import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type {
  GameDifficulty,
  GameNightArenaStyle,
  GameNightCelebrationStyle,
  GameNightGame,
  GameResultMode,
} from "@/lib/supabase";
import {
  useUpdateGameFlowConfig,
  useUpdateGameInfo,
  useUpdateGameArenaConfig,
  useSetGameSetupPhoto,
  type GameFlowConfig,
  type GameInfo,
  type GameArenaConfig,
} from "@/features/game-night/hooks/useGameNightGames";
import { GAME_TAGS, gameTagLabel } from "@/features/game-night/lib/gameTags";
import {
  ARENA_STYLES,
  ARENA_SYMBOLS,
  CELEBRATION_STYLES,
  GNV2_FALLBACK_PRIMARY_COLOR,
  GNV2_FALLBACK_SECONDARY_COLOR,
} from "@/features/game-night/lib/gameNightArena";
import {
  ARENA_SYMBOL_ICONS,
  ARENA_SYMBOL_LABELS,
} from "@/features/game-night/v2/arenaSymbolIcons";
import { getGameSetupUrl } from "@/features/game-night/lib/gameSetupStorage";
import {
  uploadGameSetupPhoto,
  deleteGameSetupPhotoFromStorage,
} from "@/features/game-night/lib/gameSetupStorage";
import { optimizeArenaSetupPhoto } from "@/features/game-night/lib/optimizeArenaSetupPhoto";

const ARENA_STYLE_LABELS: Record<GameNightArenaStyle, string> = {
  warm: "Warm",
  dark: "Donker",
  neon: "Neon",
  playful: "Speels",
  classic: "Klassiek",
};

const CELEBRATION_STYLE_LABELS: Record<GameNightCelebrationStyle, string> = {
  burst: "Burst",
  pulse: "Pulse",
  spark: "Spark",
  slam: "Slam",
  glitch: "Glitch",
  confetti: "Confetti",
};

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
// uitgebreid met "Spelinfo" (Game Night V4, sectie 25) en "Game Arena"
// (Game Night V2.7A, sectie 13) — nog steeds GEEN algemeen "spel bewerken"-
// formulier (naam/cover blijven niet bewerkbaar hier); elke sectie voegt
// alleen bewerk-UI toe voor kolommen die al bestonden maar nog geen UI
// hadden.
export function GameFlowSettingsSheet({
  game,
  onClose,
}: {
  game: GameNightGame;
  onClose: () => void;
}) {
  const updateConfig = useUpdateGameFlowConfig();
  const updateInfo = useUpdateGameInfo();
  const updateArenaConfig = useUpdateGameArenaConfig();
  const setSetupPhoto = useSetGameSetupPhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [arena, setArena] = useState<GameArenaConfig>({
    arena_primary_color: game.arena_primary_color,
    arena_secondary_color: game.arena_secondary_color,
    arena_style: game.arena_style,
    arena_symbol: game.arena_symbol,
    arena_tagline: game.arena_tagline,
    celebration_style: game.celebration_style,
  });
  // Setupfoto is bewust GEEN onderdeel van `arena`-state: het bestand moet
  // eerst naar Storage geüpload worden (heeft het echte game.id nodig, dat
  // hier al bestaat) vóórdat de kolom geschreven kan worden — zelfde
  // volgorde als AlbumFormDialog/useSetGuitarAlbumCover.
  const [setupFile, setSetupFile] = useState<File | null>(null);
  const [setupPreviewUrl, setSetupPreviewUrl] = useState<string | null>(
    game.setup_storage_path ? getGameSetupUrl(game.setup_storage_path) : null,
  );
  const [removeSetupPhoto, setRemoveSetupPhoto] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleColor(
    key: "arena_primary_color" | "arena_secondary_color",
    enabled: boolean,
    fallback: string,
  ) {
    setArena((a) => ({ ...a, [key]: enabled ? (a[key] ?? fallback) : null }));
  }

  function handleSetupFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSetupFile(file);
    setSetupPreviewUrl(URL.createObjectURL(file));
    setRemoveSetupPhoto(false);
  }

  function handleRemoveSetupPhoto() {
    setSetupFile(null);
    setSetupPreviewUrl(null);
    setRemoveSetupPhoto(true);
  }

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
    setSaveError(null);
    try {
      await Promise.all([
        updateConfig.mutateAsync({ gameId: game.id, config }),
        updateInfo.mutateAsync({ gameId: game.id, info }),
        updateArenaConfig.mutateAsync({ gameId: game.id, config: arena }),
      ]);

      // Setupfoto na de kolom-updates hierboven: eerst het NIEUWE bestand
      // succesvol uploaden en de rij bijwerken, pas DAARNA het oude object
      // best-effort opruimen — nooit andersom, anders kan een falende
      // upload de bestaande foto al kwijtraken (sectie 14: "voorkom dat
      // vervangen/verwijderen per ongeluk de cover verwijdert").
      if (setupFile) {
        const optimized = await optimizeArenaSetupPhoto(setupFile);
        const { storagePath } = await uploadGameSetupPhoto(game.id, optimized);
        await setSetupPhoto.mutateAsync({ gameId: game.id, storagePath });
        if (game.setup_storage_path) {
          await deleteGameSetupPhotoFromStorage(game.setup_storage_path);
        }
      } else if (removeSetupPhoto && game.setup_storage_path) {
        await setSetupPhoto.mutateAsync({ gameId: game.id, storagePath: null });
        await deleteGameSetupPhotoFromStorage(game.setup_storage_path);
      }

      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Opslaan mislukt");
    }
  }

  const saving =
    updateConfig.isPending ||
    updateInfo.isPending ||
    updateArenaConfig.isPending ||
    setSetupPhoto.isPending;

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

          {/* Game Night V2.7A (sectie 13) — Game Arena-configuratiebasis.
              Bewust binnen dezelfde sheet/save-actie i.p.v. een los
              beheerscherm; V2.7B is de eerste plek die deze waarden
              daadwerkelijk visueel gebruikt (zie gameNightArena.ts). */}
          <div
            className="border-t pt-4"
            style={{ borderColor: "var(--gn-border)" }}
          >
            <p className="gn-eyebrow mb-3">Game Arena</p>

            <div className="flex flex-col gap-3">
              <div>
                <p className="gn-faint mb-1.5 text-[11px] uppercase tracking-wide">
                  Setup/bordfoto
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="gn-cover flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden"
                  >
                    {setupPreviewUrl ? (
                      <img
                        src={setupPreviewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImagePlus className="gn-faint h-5 w-5" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSetupFileChange}
                  />
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="gn-muted text-xs underline"
                    >
                      {setupPreviewUrl ? "Vervangen" : "Uploaden"}
                    </button>
                    {setupPreviewUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveSetupPhoto}
                        className="gn-muted text-xs underline"
                      >
                        Verwijderen
                      </button>
                    )}
                  </div>
                </div>
                <p className="gn-faint mt-1.5 text-[11px]">
                  Zonder eigen setupfoto gebruikt de Game Arena later de
                  coverfoto.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={arena.arena_primary_color !== null}
                      onChange={(e) =>
                        toggleColor(
                          "arena_primary_color",
                          e.target.checked,
                          GNV2_FALLBACK_PRIMARY_COLOR,
                        )
                      }
                    />
                    Primaire kleur
                  </label>
                  {arena.arena_primary_color !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        value={arena.arena_primary_color}
                        onChange={(e) =>
                          setArena((a) => ({
                            ...a,
                            arena_primary_color: e.target.value,
                          }))
                        }
                        className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="gn-faint font-mono text-xs">
                        {arena.arena_primary_color}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={arena.arena_secondary_color !== null}
                      onChange={(e) =>
                        toggleColor(
                          "arena_secondary_color",
                          e.target.checked,
                          GNV2_FALLBACK_SECONDARY_COLOR,
                        )
                      }
                    />
                    Secundaire kleur
                  </label>
                  {arena.arena_secondary_color !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        value={arena.arena_secondary_color}
                        onChange={(e) =>
                          setArena((a) => ({
                            ...a,
                            arena_secondary_color: e.target.value,
                          }))
                        }
                        className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="gn-faint font-mono text-xs">
                        {arena.arena_secondary_color}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="gn-faint mb-1.5 text-[11px] uppercase tracking-wide">
                  Arena-stijl
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setArena((a) => ({ ...a, arena_style: null }))
                    }
                    className={`gn-choice-chip ${arena.arena_style === null ? "gn-choice-chip-selected" : ""}`}
                  >
                    Standaard
                  </button>
                  {ARENA_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() =>
                        setArena((a) => ({ ...a, arena_style: style }))
                      }
                      className={`gn-choice-chip ${arena.arena_style === style ? "gn-choice-chip-selected" : ""}`}
                    >
                      {ARENA_STYLE_LABELS[style]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="gn-faint mb-1.5 text-[11px] uppercase tracking-wide">
                  Symbool
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ARENA_SYMBOLS.map((symbol) => {
                    const Icon = ARENA_SYMBOL_ICONS[symbol];
                    const selected = (arena.arena_symbol ?? "none") === symbol;
                    return (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() =>
                          setArena((a) => ({ ...a, arena_symbol: symbol }))
                        }
                        className={`gn-choice-chip inline-flex items-center gap-1.5 ${selected ? "gn-choice-chip-selected" : ""}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {ARENA_SYMBOL_LABELS[symbol]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="gn-faint mb-1.5 text-[11px] uppercase tracking-wide">
                  WIN-effect
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setArena((a) => ({ ...a, celebration_style: null }))
                    }
                    className={`gn-choice-chip ${arena.celebration_style === null ? "gn-choice-chip-selected" : ""}`}
                  >
                    Standaard
                  </button>
                  {CELEBRATION_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() =>
                        setArena((a) => ({
                          ...a,
                          celebration_style: style,
                        }))
                      }
                      className={`gn-choice-chip ${arena.celebration_style === style ? "gn-choice-chip-selected" : ""}`}
                    >
                      {CELEBRATION_STYLE_LABELS[style]}
                    </button>
                  ))}
                </div>
                <p className="gn-faint mt-1.5 text-[11px]">
                  De animatie zelf volgt in een latere fase — dit kiest alleen
                  de stijl.
                </p>
              </div>

              <div>
                <p className="gn-faint mb-1.5 text-[11px] uppercase tracking-wide">
                  Live Play-tagline
                </p>
                <textarea
                  value={arena.arena_tagline ?? ""}
                  onChange={(e) =>
                    setArena((a) => ({
                      ...a,
                      arena_tagline: e.target.value,
                    }))
                  }
                  maxLength={140}
                  rows={2}
                  placeholder='Bijv. "Het eiland ligt open. De strijd kan beginnen."'
                  className="w-full px-3 py-2 text-sm"
                />
                <p className="gn-faint mt-1 text-right text-[10px]">
                  {(arena.arena_tagline ?? "").length}/140
                </p>
              </div>
            </div>
          </div>
        </div>

        {saveError && (
          <p className="mt-3 text-center text-xs text-destructive">
            {saveError}
          </p>
        )}

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
