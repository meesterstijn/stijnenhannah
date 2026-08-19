import { useEffect, useMemo, useState } from "react";
import type { GameDifficulty, GameNightGame } from "@/lib/supabase";
import { useGameHistoryStats } from "@/features/game-night/hooks/useGameHistoryStats";
import {
  rankGameNightGames,
  type DurationPreference,
  type RankedGame,
} from "@/features/game-night/lib/rankGameNightGames";
import { GAME_TAGS, gameTagLabel } from "@/features/game-night/lib/gameTags";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";

const DURATION_OPTIONS: { value: DurationPreference; label: string }[] = [
  { value: "any", label: "Maakt niet uit" },
  { value: "short", label: "~15 min" },
  { value: "medium", label: "~30 min" },
  { value: "long", label: "~60 min" },
];

const DIFFICULTY_OPTIONS: { value: GameDifficulty | null; label: string }[] = [
  { value: null, label: "Maakt niet uit" },
  { value: "licht", label: "Licht" },
  { value: "gemiddeld", label: "Gemiddeld" },
  { value: "zwaar", label: "Zwaar" },
];

// De niet-generieke reden kiezen om als kop op de kaart te tonen (sectie 7:
// "één korte data-driven reden") — puur een presentatiekeuze uit de al
// door rankGameNightGames berekende reasons-array, geen nieuwe afleiding.
// `reasons[0]` is altijd de generieke "Geschikt voor N spelers"; die tellen
// we hier niet als bijzonder genoeg om uit te lichten.
function headlineReason(ranked: RankedGame): string {
  const specific = ranked.reasons.find((r) => !r.startsWith("Geschikt voor"));
  return specific ?? ranked.reasons[0] ?? "";
}

function matchLabel(score: number): string {
  if (score >= 80) return "Sterke match";
  if (score >= 55) return "Goede match";
  return "Zou kunnen passen";
}

function RecommendationCard({
  ranked,
  primary,
  onPick,
}: {
  ranked: RankedGame;
  primary: boolean;
  onPick: () => void;
}) {
  const { game, score } = ranked;
  const coverUrl = game.cover_storage_path
    ? getGameCoverUrl(game.cover_storage_path)
    : null;

  return (
    <button
      type="button"
      onClick={onPick}
      className={`gnv2-rec-card ${primary ? "gnv2-rec-card-primary" : ""}`}
    >
      <div className="gnv2-rec-card-cover">
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <div
            className="gnv2-rec-card-cover-fallback"
            style={{ background: placeholderCoverGradient(game.id) }}
          >
            <span>{game.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <p className="gnv2-rec-card-match">{matchLabel(score)}</p>
      <p className="gnv2-rec-card-name">{game.name}</p>
      <p className="gnv2-rec-card-reason">{headlineReason(ranked)}</p>
    </button>
  );
}

// Game Night V2.6 (sectie 7) — "Kies voor ons": exact dezelfde
// rankGameNightGames-engine/voorkeurenmodel als de legacy KiesVoorOnsPanel
// (niet herschreven, sectie 25), alleen de presentatie is nieuw: een korte
// "aan het kijken..."-reveal in plaats van meteen een lijst, en drie grote
// kaarten in plaats van rijen.
export function SmartGamePicker({
  games,
  playerCount,
  onBack,
  onSelectGame,
}: {
  games: GameNightGame[];
  playerCount: number;
  onBack: () => void;
  onSelectGame: (game: GameNightGame) => void;
}) {
  const { data: history } = useGameHistoryStats();
  const [step, setStep] = useState<"preferences" | "revealing" | "results">(
    "preferences",
  );
  const [duration, setDuration] = useState<DurationPreference>("any");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<GameDifficulty | null>(null);

  const ranked = useMemo(
    () =>
      rankGameNightGames({
        games,
        playerCount,
        preferredDuration: duration,
        preferredTags: [...selectedTags],
        preferredDifficulty: difficulty,
        history,
      }),
    [games, playerCount, duration, selectedTags, difficulty, history],
  );
  const top3 = ranked.slice(0, 3);

  // Kort "kijken naar jullie avond"-moment (sectie 7) — reduced motion
  // slaat dit vrijwel over, de uitkomst hangt er nooit van af (sectie 13/26-P).
  useEffect(() => {
    if (step !== "revealing") return;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setStep("results"), reducedMotion ? 150 : 1100);
    return () => clearTimeout(t);
  }, [step]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  if (step === "revealing") {
    return (
      <div className="gnv2-revealing gnv2-view-enter">
        <p className="gnv2-revealing-text">Kijken naar jullie avond…</p>
        <div className="gnv2-revealing-pulse" aria-hidden />
      </div>
    );
  }

  if (step === "results") {
    return (
      <div className="gnv2-select-panel gnv2-view-enter">
        <div className="gnv2-select-panel-header">
          <button
            type="button"
            onClick={() => setStep("preferences")}
            className="gnv2-preview-back"
          >
            Voorkeuren aanpassen
          </button>
          <p className="gnv2-select-heading">Voor vanavond</p>
        </div>

        {top3.length === 0 ? (
          <div className="gnv2-rec-empty">
            <p>Met {playerCount} spelers past er nu geen spel uit de kast.</p>
            <button
              type="button"
              onClick={() => {
                setDuration("any");
                setStep("preferences");
              }}
              className="gnv2-btn gnv2-btn-ghost"
            >
              Ruimer tijdsbereik
            </button>
            <button
              type="button"
              onClick={onBack}
              className="gnv2-preview-back"
            >
              Terug
            </button>
          </div>
        ) : (
          <div className="gnv2-rec-grid">
            {top3.map((r, i) => (
              <RecommendationCard
                key={r.game.id}
                ranked={r}
                primary={i === 0}
                onPick={() => onSelectGame(r.game)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="gnv2-select-panel gnv2-view-enter">
      <div className="gnv2-select-panel-header">
        <button type="button" onClick={onBack} className="gnv2-preview-back">
          Terug
        </button>
        <p className="gnv2-select-heading">Kies voor ons</p>
      </div>

      <div className="gnv2-pref-groups">
        <div className="gnv2-pref-group">
          <p className="gnv2-pref-label">Hoe lang?</p>
          <div className="gnv2-pref-chips">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDuration(opt.value)}
                className={`gnv2-chip-toggle ${duration === opt.value ? "gnv2-chip-toggle-selected" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="gnv2-pref-group">
          <p className="gnv2-pref-label">Waar hebben we zin in?</p>
          <div className="gnv2-pref-chips">
            {GAME_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`gnv2-chip-toggle ${selectedTags.has(tag) ? "gnv2-chip-toggle-selected" : ""}`}
              >
                {gameTagLabel(tag)}
              </button>
            ))}
          </div>
        </div>

        <div className="gnv2-pref-group">
          <p className="gnv2-pref-label">Moeilijkheid</p>
          <div className="gnv2-pref-chips">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                className={`gnv2-chip-toggle ${difficulty === opt.value ? "gnv2-chip-toggle-selected" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setStep("revealing")}
        className="gnv2-btn gnv2-btn-primary gnv2-pref-cta"
      >
        Toon voorstellen
      </button>
    </div>
  );
}
