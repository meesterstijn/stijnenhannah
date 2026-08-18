import { useMemo, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import type {
  GameDifficulty,
  GameNightGame,
  GameNightPlayer,
} from "@/lib/supabase";
import { useGameHistoryStats } from "@/features/game-night/hooks/useGameHistoryStats";
import {
  rankGameNightGames,
  type DurationPreference,
  type RankedGame,
} from "@/features/game-night/lib/rankGameNightGames";
import { GAME_TAGS, gameTagLabel } from "@/features/game-night/lib/gameTags";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";
import { GameParticipantSheet } from "@/features/game-night/components/GameParticipantSheet";

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

function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`gn-choice-chip ${selected ? "gn-choice-chip-selected" : ""}`}
    >
      {label}
    </button>
  );
}

function RecommendationCard({
  ranked,
  primary,
  onPlay,
}: {
  ranked: RankedGame;
  primary: boolean;
  onPlay: () => void;
}) {
  const { game, score, reasons } = ranked;
  const coverUrl = game.cover_storage_path
    ? getGameCoverUrl(game.cover_storage_path)
    : null;

  return (
    <div
      className={`gn-card flex w-full gap-3 p-3 ${primary ? "border-[var(--gn-brass)]" : ""}`}
      style={primary ? { borderWidth: 1.5 } : undefined}
    >
      <div className="gn-cover h-full w-16 shrink-0 overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-end p-1.5"
            style={{ background: placeholderCoverGradient(game.id) }}
            aria-hidden
          >
            <span className="gn-display text-lg font-semibold text-white/75">
              {game.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">{game.name}</p>
          <span className="gn-match-badge shrink-0">{score}%</span>
        </div>
        <ul className="gn-faint space-y-0.5 text-[11px] leading-snug">
          {reasons.slice(0, primary ? 4 : 2).map((reason) => (
            <li key={reason}>· {reason}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onPlay}
          className={
            primary
              ? "gn-plaque-action gn-plaque-action-primary mt-auto flex min-h-[52px] w-full items-center justify-center px-4 py-2.5"
              : "gn-plaque-action mt-auto flex min-h-[44px] w-full items-center justify-center px-4 py-2"
          }
        >
          <span className="gn-display text-sm font-semibold tracking-wide">
            SPELEN
          </span>
        </button>
      </div>
    </div>
  );
}

// "Kies voor ons" (Game Night V4, sectie 8-14): eerst harde filters (spel
// niet gearchiveerd + spelersaantal past bij de al-aanwezige spelers,
// nooit opnieuw gevraagd), dan een paar snelle tikken voor duur/stemming/
// moeilijkheid, dan de pure rankGameNightGames-engine. Eindigt altijd via
// dezelfde GameParticipantSheet + start_game_session-RPC als de rest van
// Game Night — geen tweede startpad.
export function KiesVoorOnsPanel({
  games,
  attendees,
  gameNightSessionId,
  onBack,
}: {
  games: GameNightGame[];
  attendees: GameNightPlayer[];
  gameNightSessionId: string;
  onBack: () => void;
}) {
  const { data: history } = useGameHistoryStats();
  const [step, setStep] = useState<"preferences" | "results">("preferences");
  const [duration, setDuration] = useState<DurationPreference>("any");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<GameDifficulty | null>(null);
  const [pickingGame, setPickingGame] = useState<GameNightGame | null>(null);

  const playerCount = attendees.length;

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

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  if (pickingGame) {
    return (
      <GameParticipantSheet
        game={pickingGame}
        attendees={attendees}
        gameNightSessionId={gameNightSessionId}
        onClose={() => setPickingGame(null)}
      />
    );
  }

  if (step === "results") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center gap-2.5">
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={() => setStep("preferences")}
            className="gn-muted inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voorkeuren aanpassen
          </button>
          <p className="gn-eyebrow">Kies voor ons</p>
        </div>

        {top3.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="gn-display text-lg font-semibold tracking-wide">
              Geen perfect passend spel gevonden
            </p>
            <p className="gn-muted max-w-xs text-xs">
              Met {playerCount} spelers past er nu geen spel uit de kast.
              Probeer een ruimer tijdsbereik of kies zelf.
            </p>
            <div className="flex w-full max-w-xs flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setDuration("any");
                  setStep("preferences");
                }}
                className="gn-plaque-action flex min-h-[48px] w-full items-center justify-center px-4"
              >
                <span className="gn-display text-sm font-semibold tracking-wide">
                  Ruimer tijdsbereik
                </span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="gn-muted min-h-[44px] px-4 py-2 text-xs underline"
              >
                Terug
              </button>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-1 min-h-0 flex-col gap-2.5 overflow-y-auto px-0.5 py-0.5">
            {top3.map((r, i) => (
              <RecommendationCard
                key={r.game.id}
                ranked={r}
                primary={i === 0}
                onPlay={() => setPickingGame(r.game)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="gn-muted inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug
        </button>
        <p className="gn-eyebrow">Kies voor ons</p>
      </div>

      {attendees.length > 0 && (
        <p className="gn-muted text-center text-xs">
          Vanavond met {attendees.length}{" "}
          {attendees.length === 1 ? "speler" : "spelers"} ·{" "}
          {attendees.map((p) => p.name).join(", ")}
        </p>
      )}

      <div className="w-full flex-1 min-h-0 space-y-3.5 overflow-y-auto px-0.5 py-1">
        <div>
          <p className="gn-faint mb-1.5 text-[11px] uppercase tracking-wide">
            Hoe lang?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <ChoiceChip
                key={opt.value}
                label={opt.label}
                selected={duration === opt.value}
                onClick={() => setDuration(opt.value)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="gn-faint mb-1.5 text-[11px] uppercase tracking-wide">
            Waar hebben we zin in?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {GAME_TAGS.map((tag) => (
              <ChoiceChip
                key={tag}
                label={gameTagLabel(tag)}
                selected={selectedTags.has(tag)}
                onClick={() => toggleTag(tag)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="gn-faint mb-1.5 text-[11px] uppercase tracking-wide">
            Moeilijkheid
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <ChoiceChip
                key={opt.label}
                label={opt.label}
                selected={difficulty === opt.value}
                onClick={() => setDifficulty(opt.value)}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setStep("results")}
        className="gn-plaque-action gn-plaque-action-primary flex min-h-[60px] w-full max-w-xs items-center justify-center gap-2 px-6 py-3.5"
      >
        <Sparkles className="h-5 w-5" style={{ color: "var(--gn-brass)" }} />
        <span className="gn-display text-lg font-semibold tracking-wide">
          Toon voorstellen
        </span>
      </button>
    </div>
  );
}
